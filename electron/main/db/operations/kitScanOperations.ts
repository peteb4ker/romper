import type {
  DbResult,
  Kit,
  KitScanResult,
  NewSample,
  Sample,
  Voice,
} from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { inferVoiceTypeFromFilename } from "@romper/shared/kitUtilsShared.js";
import { and, eq } from "drizzle-orm";
import * as path from "node:path";

import { type RomperDb, withDbTransaction } from "../utils/dbUtilities.js";

const { kits, samples, voices } = schema;

/** The Rample holds at most 12 samples per voice (slots 0-11). */
export const MAX_SLOTS_PER_VOICE = 12;

/** What a scan found on disk for one kit. */
export interface KitFolderScan {
  /** Voice-prefixed WAV filenames, keyed by voice 1-4, sorted by name */
  filesByVoice: Record<number, string[]>;
  kitPath: string;
}

/**
 * File-system access the merge needs. Injected so the merge stays pure and
 * testable, and so all reads happen inside the one transaction.
 */
export interface KitScanIo {
  fileExists: (filePath: string) => boolean;
  /** WAV metadata for a file, or null when it can't be read */
  readMetadata: (filePath: string) => null | WavMetadataFields;
}

export interface KitScanPlan {
  aliasUpdates: Array<{ alias: string; voiceNumber: number }>;
  inserts: NewSample[];
  metadataUpdates: Array<{ id: number; metadata: WavMetadataFields }>;
  result: KitScanResult;
}

export type WavMetadataFields = Pick<
  Sample,
  "wav_bit_depth" | "wav_bitrate" | "wav_channels" | "wav_sample_rate"
>;

/**
 * Merge a kit folder scan into the database in one transaction (RE-04).
 *
 * Nothing is deleted and no existing row is moved or edited except to fill
 * in missing WAV metadata. See planKitScanMerge for the rules. Any error
 * rolls the whole kit back.
 */
export function mergeKitScan(
  dbDir: string,
  kitName: string,
  folder: KitFolderScan,
  io: KitScanIo,
): DbResult<KitScanResult> {
  return withDbTransaction(dbDir, (db) =>
    mergeKitScanTx(db, kitName, folder, io),
  );
}

/** Merge a kit folder scan on the caller's transaction */
export function mergeKitScanTx(
  db: RomperDb,
  kitName: string,
  folder: KitFolderScan,
  io: KitScanIo,
): KitScanResult {
  const kit = db.select().from(kits).where(eq(kits.name, kitName)).get();
  if (!kit) {
    throw new Error(`Kit not found in database: ${kitName}`);
  }

  const existing = db
    .select()
    .from(samples)
    .where(eq(samples.kit_name, kitName))
    .all();
  const kitVoices = db
    .select()
    .from(voices)
    .where(eq(voices.kit_name, kitName))
    .all();

  const plan = planKitScanMerge({
    existing,
    folder,
    io,
    kit,
    voices: kitVoices,
  });

  for (const { id, metadata } of plan.metadataUpdates) {
    db.update(samples).set(metadata).where(eq(samples.id, id)).run();
  }

  for (const row of plan.inserts) {
    db.insert(samples).values(row).run();
  }

  for (const { alias, voiceNumber } of plan.aliasUpdates) {
    const hasVoiceRow = kitVoices.some((v) => v.voice_number === voiceNumber);
    if (hasVoiceRow) {
      db.update(voices)
        .set({ voice_alias: alias })
        .where(
          and(
            eq(voices.kit_name, kitName),
            eq(voices.voice_number, voiceNumber),
          ),
        )
        .run();
    } else {
      db.insert(voices)
        .values({
          kit_name: kitName,
          voice_alias: alias,
          voice_number: voiceNumber,
        })
        .run();
    }
  }

  if (plan.inserts.length > 0) {
    // New samples aren't on the SD card yet
    db.update(kits)
      .set({ modified_since_sync: true })
      .where(eq(kits.name, kitName))
      .run();
  }

  return plan.result;
}

/**
 * Decide what a kit scan changes. Pure apart from the injected io.
 *
 * - Locked kits: no changes at all.
 * - Existing rows are always kept with their slot, voice, gain, stereo flag
 *   and source path. A row whose file is gone is reported in
 *   `missingSamples`, not deleted: user samples are referenced from outside
 *   the store and may just be on an unmounted drive.
 * - Existing rows with missing WAV metadata get it filled in when the file
 *   is readable.
 * - A folder file is "already referenced" when any row in the kit (any
 *   voice, so in-app moves are respected) has that absolute source path.
 * - Unreferenced folder files are added to non-editable kits only, in the
 *   lowest free slot of the voice their filename prefix names, never beyond
 *   12 per voice. Editable kits own their sample list, so re-adding folder
 *   files would undo in-app deletions; those files are reported instead.
 * - New rows carry no stereo flag: stereo is a voice setting
 *   (`voices.stereo_mode`).
 * - Voice names are inferred from the voice's first sample only for voices
 *   that have no name, so user-set names survive.
 */
export function planKitScanMerge({
  existing,
  folder,
  io,
  kit,
  voices: kitVoices,
}: {
  existing: Sample[];
  folder: KitFolderScan;
  io: KitScanIo;
  kit: Pick<Kit, "editable" | "locked" | "name">;
  voices: Pick<Voice, "voice_alias" | "voice_number">[];
}): KitScanPlan {
  const allFiles = Object.values(folder.filesByVoice).flat();
  const result: KitScanResult = {
    addedSamples: 0,
    locked: kit.locked,
    metadataUpdated: 0,
    missingSamples: [],
    scannedSamples: allFiles.length,
    skippedFiles: [],
    updatedVoices: 0,
  };
  const plan: KitScanPlan = {
    aliasUpdates: [],
    inserts: [],
    metadataUpdates: [],
    result,
  };

  if (kit.locked) {
    return plan;
  }

  for (const row of existing) {
    if (!io.fileExists(row.source_path)) {
      result.missingSamples.push({
        filename: row.filename,
        slotNumber: row.slot_number,
        sourcePath: row.source_path,
        voiceNumber: row.voice_number,
      });
    } else if (hasMissingMetadata(row)) {
      const metadata = io.readMetadata(row.source_path);
      if (metadata) {
        plan.metadataUpdates.push({ id: row.id, metadata });
      }
    }
  }
  result.metadataUpdated = plan.metadataUpdates.length;

  const referenced = new Set(existing.map((row) => row.source_path));

  for (const [voiceKey, files] of Object.entries(folder.filesByVoice)) {
    const voiceNumber = Number.parseInt(voiceKey, 10);
    const usedSlots = new Set(
      existing
        .filter((row) => row.voice_number === voiceNumber)
        .map((row) => row.slot_number),
    );

    for (const filename of files) {
      const sourcePath = path.join(folder.kitPath, filename);
      if (referenced.has(sourcePath)) continue;

      if (kit.editable) {
        result.skippedFiles.push({
          filename,
          reason: "kit_editable",
          voiceNumber,
        });
        continue;
      }

      const slot = lowestFreeSlot(usedSlots);
      if (slot === null) {
        result.skippedFiles.push({
          filename,
          reason: "voice_full",
          voiceNumber,
        });
        continue;
      }

      usedSlots.add(slot);
      referenced.add(sourcePath);
      plan.inserts.push({
        filename,
        kit_name: kit.name,
        slot_number: slot,
        source_path: sourcePath,
        voice_number: voiceNumber,
        ...(io.readMetadata(sourcePath) ?? {}),
      });
    }
  }
  result.addedSamples = plan.inserts.length;

  plan.aliasUpdates = inferMissingVoiceAliases(
    [...existing, ...plan.inserts],
    kitVoices,
  );
  result.updatedVoices = plan.aliasUpdates.length;

  return plan;
}

function hasMissingMetadata(row: Sample): boolean {
  return (
    row.wav_sample_rate === null ||
    row.wav_bit_depth === null ||
    row.wav_channels === null
  );
}

function inferMissingVoiceAliases(
  rows: Array<Pick<NewSample, "filename" | "slot_number" | "voice_number">>,
  kitVoices: Pick<Voice, "voice_alias" | "voice_number">[],
): Array<{ alias: string; voiceNumber: number }> {
  const updates: Array<{ alias: string; voiceNumber: number }> = [];

  for (const voiceNumber of [1, 2, 3, 4]) {
    const currentAlias = kitVoices.find(
      (v) => v.voice_number === voiceNumber,
    )?.voice_alias;
    if (currentAlias?.trim()) continue;

    const first = rows
      .filter((row) => row.voice_number === voiceNumber)
      .sort((a, b) => a.slot_number - b.slot_number)[0];
    if (!first) continue;

    const inferred = inferVoiceTypeFromFilename(first.filename);
    if (inferred) {
      updates.push({ alias: inferred, voiceNumber });
    }
  }

  return updates;
}

function lowestFreeSlot(usedSlots: Set<number>): null | number {
  for (let slot = 0; slot < MAX_SLOTS_PER_VOICE; slot++) {
    if (!usedSlots.has(slot)) return slot;
  }
  return null;
}

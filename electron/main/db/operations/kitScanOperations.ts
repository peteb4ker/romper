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
import {
  planKitStereo,
  type StereoSampleState,
} from "@romper/shared/stereoLinkRules.js";
import { eq } from "drizzle-orm";
import * as path from "node:path";

import type { WavMetadataFields } from "./wavMetadataFields.js";

import { type RomperDb, withDbTransaction } from "../utils/dbUtilities.js";
import { flagKitModified } from "./kitSyncOperations.js";
import { linkVoicesAutomaticallyTx } from "./voiceCrudOperations.js";

export type { WavMetadataFields } from "./wavMetadataFields.js";

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
  /** Rows whose file is missing or can't be read, as the scan found (#537) */
  statusUpdates: Array<{ id: number; status: "missing" | "unreadable" }>;
}

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

/**
 * Merge a kit folder scan on the caller's transaction. A scan never changes
 * a stereo link: its result reports what the stereo rules will do (#537).
 * Setup passes `linkStereoVoices` to make the links rule 2 decides.
 */
export function mergeKitScanTx(
  db: RomperDb,
  kitName: string,
  folder: KitFolderScan,
  io: KitScanIo,
  options: { linkStereoVoices?: boolean } = {},
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

  for (const { id, status } of plan.statusUpdates) {
    db.update(samples)
      .set({ source_status: status })
      .where(eq(samples.id, id))
      .run();
  }

  for (const { id, metadata } of plan.metadataUpdates) {
    db.update(samples).set(metadata).where(eq(samples.id, id)).run();
  }

  for (const row of plan.inserts) {
    db.insert(samples).values(row).run();
  }

  // One row per voice (#510): name the voice's row, or add it if missing
  for (const { alias, voiceNumber } of plan.aliasUpdates) {
    db.insert(voices)
      .values({
        kit_name: kitName,
        voice_alias: alias,
        voice_number: voiceNumber,
      })
      .onConflictDoUpdate({
        set: { voice_alias: alias },
        target: [voices.kit_name, voices.voice_number],
      })
      .run();
  }

  // Setup links what rule 2 links (#537); a scan only reports it
  if (options.linkStereoVoices && plan.result.stereo) {
    linkVoicesAutomaticallyTx(db, kitName, plan.result.stereo.autoLinks);
  }

  if (plan.inserts.length > 0) {
    // New samples aren't on the SD card yet; the voice names a scan infers
    // never reach it (#566)
    flagKitModified(db, kitName);
  }

  return plan.result;
}

/**
 * Decide what a kit scan changes. Pure apart from the injected io.
 *
 * - Locked kits: no changes at all.
 * - Existing rows are always kept with their slot, voice, gain and source
 *   path. A row whose file is gone is reported in
 *   `missingSamples`, not deleted: user samples are referenced from outside
 *   the store and may just be on an unmounted drive.
 * - Existing rows with missing WAV metadata get it filled in when the file
 *   is readable. Each row's `source_status` records what the scan found:
 *   readable, a WAV it can't read, or missing (#537).
 * - A folder file is "already referenced" when any row in the kit (any
 *   voice, so in-app moves are respected) has that absolute source path.
 * - Unreferenced folder files are added to non-editable kits only, in the
 *   lowest free slot of the voice their filename prefix names, never beyond
 *   12 per voice. Editable kits own their sample list, so re-adding folder
 *   files would undo in-app deletions; those files are reported instead.
 * - New rows carry no stereo flag: stereo is a voice setting
 *   (`voices.stereo_mode`). No link is changed; `result.stereo` reports
 *   what the stereo rules will do (`planKitStereo`, #537): links made
 *   automatically at the next write, mixdowns and quarantine. A file whose
 *   header can't be read counts as unreadable.
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
  voices: Pick<
    Voice,
    "stereo_choice" | "stereo_mode" | "voice_alias" | "voice_number"
  >[];
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
    statusUpdates: [],
  };

  if (kit.locked) {
    return plan;
  }

  // Files whose WAV header can't be read (#537 rule 4)
  const unreadable = checkExistingFiles(existing, io, plan);
  result.metadataUpdated = plan.metadataUpdates.length;

  addUnreferencedFolderFiles({ existing, folder, io, kit, plan, unreadable });
  result.addedSamples = plan.inserts.length;

  plan.aliasUpdates = inferMissingVoiceAliases(
    [...existing, ...plan.inserts],
    kitVoices,
  );
  result.updatedVoices = plan.aliasUpdates.length;

  // What the stereo rules make of the kit once merged (#537)
  const filledIn = new Map(
    plan.metadataUpdates.map(({ id, metadata }) => [id, metadata]),
  );
  const merged: StereoSampleState[] = [
    ...existing.map((row) => ({
      filename: row.filename,
      unreadable: unreadable.has(row.source_path),
      voice_number: row.voice_number,
      wav_channels: filledIn.get(row.id)?.wav_channels ?? row.wav_channels,
    })),
    ...plan.inserts.map((row) => ({
      filename: row.filename,
      unreadable: unreadable.has(row.source_path),
      voice_number: row.voice_number,
      wav_channels: row.wav_channels,
    })),
  ];
  result.stereo = planKitStereo(kitVoices, merged);

  return plan;
}

/**
 * planKitScanMerge's folder pass: each folder file no row references is
 * planned as an insert in the lowest free slot of its voice, or reported
 * as skipped (editable kit, or voice full). A new file that can't be read
 * is added to `unreadable`.
 */
function addUnreferencedFolderFiles({
  existing,
  folder,
  io,
  kit,
  plan,
  unreadable,
}: {
  existing: Sample[];
  folder: KitFolderScan;
  io: KitScanIo;
  kit: Pick<Kit, "editable" | "name">;
  plan: KitScanPlan;
  unreadable: Set<string>;
}): void {
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
        plan.result.skippedFiles.push({
          filename,
          reason: "kit_editable",
          voiceNumber,
        });
        continue;
      }

      const slot = lowestFreeSlot(usedSlots);
      if (slot === null) {
        plan.result.skippedFiles.push({
          filename,
          reason: "voice_full",
          voiceNumber,
        });
        continue;
      }

      usedSlots.add(slot);
      referenced.add(sourcePath);
      const metadata = io.readMetadata(sourcePath);
      if (!metadata) unreadable.add(sourcePath);
      plan.inserts.push({
        filename,
        kit_name: kit.name,
        slot_number: slot,
        source_path: sourcePath,
        voice_number: voiceNumber,
        ...(metadata ?? { source_status: "unreadable" }),
      });
    }
  }
}

/**
 * Check the files of a kit's existing rows: a missing file is reported
 * and recorded as missing, and a file with no WAV details is read, its
 * details recorded, or recorded as unreadable (#537). Returns the source
 * paths of the files that couldn't be read.
 */
function checkExistingFiles(
  existing: Sample[],
  io: KitScanIo,
  plan: KitScanPlan,
): Set<string> {
  const unreadable = new Set<string>();
  for (const row of existing) {
    if (!io.fileExists(row.source_path)) {
      plan.result.missingSamples.push({
        filename: row.filename,
        slotNumber: row.slot_number,
        sourcePath: row.source_path,
        voiceNumber: row.voice_number,
      });
      if (row.source_status !== "missing") {
        plan.statusUpdates.push({ id: row.id, status: "missing" });
      }
    } else if (hasMissingMetadata(row)) {
      const metadata = io.readMetadata(row.source_path);
      if (metadata) {
        plan.metadataUpdates.push({ id: row.id, metadata });
      } else {
        unreadable.add(row.source_path);
        if (row.source_status !== "unreadable") {
          plan.statusUpdates.push({ id: row.id, status: "unreadable" });
        }
      }
    }
  }
  return unreadable;
}

/** The row's header hasn't been read successfully: missing metadata, or
 * a file last found missing or unreadable (#537) */
function hasMissingMetadata(row: Sample): boolean {
  return (
    row.wav_sample_rate === null ||
    row.wav_bit_depth === null ||
    row.wav_channels === null ||
    row.wav_format_tag === null ||
    row.source_status !== "readable"
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

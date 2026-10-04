import type { DbResult, NewSample, Sample } from "@romper/shared/db/schema.js";
import type { VoiceSnapshot } from "@romper/shared/undoTypes.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, eq, type SQL } from "drizzle-orm";

import {
  type RomperDb,
  withDb,
  withDbTransaction,
} from "../utils/dbUtilities.js";
import { flagKitModified } from "./kitSyncOperations.js";
import { performVoiceReindexing } from "./sampleManagementOps.js";

const { kits, samples } = schema;

/**
 * Add a sample to the database
 */
export function addSample(
  dbDir: string,
  sample: NewSample,
): DbResult<{ sampleId: number }> {
  return withDb(dbDir, (db) => addSampleTx(db, sample));
}

/** Insert a sample row on the caller's handle */
export function addSampleTx(
  db: RomperDb,
  sample: NewSample,
): { sampleId: number } {
  const result = db.insert(samples).values(sample).run();
  return { sampleId: result.lastInsertRowid as number };
}

/**
 * Helper function to build delete conditions for samples
 */
export function buildDeleteConditions(
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): SQL {
  const conditions = [eq(samples.kit_name, kitName)];

  if (filter?.voiceNumber !== undefined) {
    conditions.push(eq(samples.voice_number, filter.voiceNumber));
  }

  if (filter?.slotNumber !== undefined) {
    // Database stores 0-11 slot indices directly
    conditions.push(eq(samples.slot_number, filter.slotNumber));
  }

  if (conditions.length === 0) {
    throw new Error("No conditions provided to buildDeleteConditions");
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  const result = and(...conditions);
  if (!result) {
    throw new Error("Failed to combine conditions with AND operator");
  }

  return result;
}

/**
 * Delete samples and close the gaps they leave in their voices, in one
 * transaction (RE-28)
 */
export function deleteSamples(
  dbDir: string,
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }> {
  return withDbTransaction(dbDir, (db) => deleteSamplesTx(db, kitName, filter));
}

/** Delete samples and reindex their voices, on the caller's transaction */
export function deleteSamplesTx(
  db: RomperDb,
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): { affectedSamples: Sample[]; deletedSamples: Sample[] } {
  const { deletedSamples } = deleteSamplesWithoutReindexingTx(
    db,
    kitName,
    filter,
  );
  const affectedSamples = performVoiceReindexing(db, kitName, deletedSamples);
  return { affectedSamples, deletedSamples };
}

/**
 * Delete samples without automatic reindexing (for manual control)
 */
export function deleteSamplesWithoutReindexing(
  dbDir: string,
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): DbResult<{ deletedSamples: Sample[] }> {
  return withDbTransaction(dbDir, (db) =>
    deleteSamplesWithoutReindexingTx(db, kitName, filter),
  );
}

/** Delete samples, leaving their slots empty, on the caller's handle */
export function deleteSamplesWithoutReindexingTx(
  db: RomperDb,
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): { deletedSamples: Sample[] } {
  const whereCondition = buildDeleteConditions(kitName, filter);
  const deletedSamples = getSamplesToDelete(db, whereCondition);
  db.delete(samples).where(whereCondition).run();
  return { deletedSamples };
}

/**
 * Get all samples from the database
 */
export function getAllSamples(dbDir: string): DbResult<Sample[]> {
  return withDb(dbDir, (db) => {
    return db.select().from(samples).all();
  });
}

/**
 * Get all samples for a specific kit
 */
export function getKitSamples(
  dbDir: string,
  kitName: string,
): DbResult<Sample[]> {
  return withDb(dbDir, (db) => {
    return db.select().from(samples).where(eq(samples.kit_name, kitName)).all();
  });
}

/**
 * Helper function to get samples to delete
 */
export function getSamplesToDelete(
  db: RomperDb,
  whereCondition: SQL,
): Sample[] {
  return db.select().from(samples).where(whereCondition).all();
}

/**
 * Replace the file in an occupied slot with one in-place update, on the
 * caller's transaction (RE-26). The row keeps its id, slot and gain; its
 * file name, source path and WAV header columns become the new file's, and
 * the kit is flagged modified. Throws when the slot is empty.
 */
export function replaceSampleTx(
  db: RomperDb,
  kitName: string,
  voiceNumber: number,
  slotNumber: number,
  replacement: Partial<
    Pick<
      NewSample,
      | "source_status"
      | "wav_bit_depth"
      | "wav_bitrate"
      | "wav_channels"
      | "wav_sample_rate"
    >
  > &
    Pick<NewSample, "filename" | "source_path">,
): { replacedSample: Sample; sampleId: number } {
  const slot = and(
    eq(samples.kit_name, kitName),
    eq(samples.voice_number, voiceNumber),
    eq(samples.slot_number, slotNumber),
  );
  const replacedSample = db.select().from(samples).where(slot).get();
  if (!replacedSample) {
    throw new Error(
      `No sample in voice ${voiceNumber}, slot ${slotNumber + 1} to replace`,
    );
  }
  db.update(samples)
    .set({
      filename: replacement.filename,
      source_path: replacement.source_path,
      // What reading the new file found, not the old one's (#537)
      source_status: replacement.source_status ?? null,
      wav_bit_depth: replacement.wav_bit_depth ?? null,
      wav_bitrate: replacement.wav_bitrate ?? null,
      wav_channels: replacement.wav_channels ?? null,
      wav_sample_rate: replacement.wav_sample_rate ?? null,
    })
    .where(eq(samples.id, replacedSample.id))
    .run();
  flagKitModified(db, kitName);
  return { replacedSample, sampleId: replacedSample.id };
}

/**
 * Put voices back exactly as a snapshot had them, on the caller's
 * transaction (RE-86): each voice's current rows are deleted and the
 * snapshot's rows inserted with their slots, gain and WAV details, and the
 * kit is flagged modified. Undo uses it, so a restore is one unit of work
 * instead of a delete and an add per sample. Throws on a missing kit, a
 * voice outside 1-4, a slot outside 0-11 or a slot used twice.
 */
export function restoreVoicesTx(
  db: RomperDb,
  kitName: string,
  voices: VoiceSnapshot[],
): void {
  const kit = db
    .select({ name: kits.name })
    .from(kits)
    .where(eq(kits.name, kitName))
    .get();
  if (!kit) throw new Error(`Kit '${kitName}' not found`);

  for (const { samples: rows, voice } of voices) {
    if (!Number.isInteger(voice) || voice < 1 || voice > 4) {
      throw new Error(`Invalid voice ${voice}`);
    }
    const slots = new Set(rows.map((row) => row.slot_number));
    if (slots.size !== rows.length || !rows.every(isRestorableRow)) {
      throw new Error(`Invalid samples for voice ${voice}`);
    }

    db.delete(samples)
      .where(
        and(eq(samples.kit_name, kitName), eq(samples.voice_number, voice)),
      )
      .run();
    if (rows.length > 0) {
      db.insert(samples)
        .values(
          rows.map((row) => ({
            filename: row.filename,
            gain_db: row.gain_db,
            kit_name: kitName,
            slot_number: row.slot_number,
            source_path: row.source_path,
            source_status: row.source_status ?? null,
            voice_number: voice,
            wav_bit_depth: row.wav_bit_depth,
            wav_bitrate: row.wav_bitrate,
            wav_channels: row.wav_channels,
            wav_sample_rate: row.wav_sample_rate,
          })),
        )
        .run();
    }
  }
  flagKitModified(db, kitName);
}

/**
 * Update per-sample gain (dB trim). Gain is applied when the sample is
 * written, so the kit is marked modified in the same transaction (RE-35).
 */
export function updateSampleGain(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  slotNumber: number,
  gainDb: number,
): DbResult<void> {
  return withDbTransaction(dbDir, (db) => {
    const result = db
      .update(samples)
      .set({ gain_db: gainDb })
      .where(
        and(
          eq(samples.kit_name, kitName),
          eq(samples.voice_number, voiceNumber),
          eq(samples.slot_number, slotNumber),
        ),
      )
      .run();

    if (result.changes === 0) {
      throw new Error(
        `Sample not found: kit=${kitName}, voice=${voiceNumber}, slot=${slotNumber}`,
      );
    }
    flagKitModified(db, kitName);
  });
}

/**
 * Update sample WAV metadata
 */
export function updateSampleMetadata(
  dbDir: string,
  sampleId: number,
  updates: Partial<Sample>,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    const updateData: Partial<Sample> = {};

    // Only include metadata fields that exist in the Sample schema
    if (updates.filename !== undefined) updateData.filename = updates.filename;
    if (updates.source_path !== undefined)
      updateData.source_path = updates.source_path;

    // Handle WAV metadata fields that actually exist in the schema
    if (updates.wav_bit_depth !== undefined)
      updateData.wav_bit_depth = updates.wav_bit_depth;
    if (updates.wav_bitrate !== undefined)
      updateData.wav_bitrate = updates.wav_bitrate;
    if (updates.wav_channels !== undefined)
      updateData.wav_channels = updates.wav_channels;
    if (updates.wav_sample_rate !== undefined)
      updateData.wav_sample_rate = updates.wav_sample_rate;
    if (updates.gain_db !== undefined) updateData.gain_db = updates.gain_db;

    if (Object.keys(updateData).length === 0) {
      return; // Nothing to update
    }

    const result = db
      .update(samples)
      .set(updateData)
      .where(eq(samples.id, sampleId))
      .run();

    if (result.changes === 0) {
      throw new Error(`Sample with ID ${sampleId} not found`);
    }
  });
}

/**
 * Record what reading a sample's file found (#537): its source status,
 * and its WAV details when it could be read. On the caller's transaction.
 */
export function updateSampleSourceStatusTx(
  db: RomperDb,
  sampleId: number,
  fields: Partial<
    Pick<
      Sample,
      | "source_status"
      | "wav_bit_depth"
      | "wav_bitrate"
      | "wav_channels"
      | "wav_sample_rate"
    >
  >,
): void {
  db.update(samples).set(fields).where(eq(samples.id, sampleId)).run();
}

function isRestorableRow(row: VoiceSnapshot["samples"][number]): boolean {
  const optionalInt = (v: unknown) => v === null || Number.isInteger(v);
  return (
    typeof row?.filename === "string" &&
    typeof row.source_path === "string" &&
    Number.isInteger(row.slot_number) &&
    row.slot_number >= 0 &&
    row.slot_number <= 11 &&
    Number.isFinite(row.gain_db) &&
    (row.source_status == null ||
      ["missing", "readable", "unreadable"].includes(row.source_status)) &&
    optionalInt(row.wav_bit_depth) &&
    optionalInt(row.wav_bitrate) &&
    optionalInt(row.wav_channels) &&
    optionalInt(row.wav_sample_rate)
  );
}

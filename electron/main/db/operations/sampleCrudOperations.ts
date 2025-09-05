import type { DbResult, NewSample, Sample } from "@romper/shared/db/schema.js";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "@romper/shared/db/schema.js";
import { and, eq, type SQL } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";
import { performVoiceReindexing } from "./sampleManagementOps.js";

const { samples } = schema;

/**
 * Add a sample to the database
 */
export function addSample(
  dbDir: string,
  sample: NewSample,
): DbResult<{ sampleId: number }> {
  return withDb(dbDir, (db) => {
    const result = db.insert(samples).values(sample).run();
    return { sampleId: result.lastInsertRowid as number };
  });
}

/**
 * Helper function to build delete conditions for samples
 */
export function buildDeleteConditions(
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): SQL {
  let conditions = [eq(samples.kit_name, kitName)];

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
 * Delete samples with automatic voice reindexing
 */
export function deleteSamples(
  dbDir: string,
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }> {
  return withDb(dbDir, (db) => {
    const whereCondition = buildDeleteConditions(kitName, filter);
    const samplesToDelete = getSamplesToDelete(db, whereCondition);

    // Delete the samples
    db.delete(samples).where(whereCondition).run();

    const affectedSamples = performVoiceReindexing(
      dbDir,
      kitName,
      samplesToDelete,
    );

    return {
      affectedSamples,
      deletedSamples: samplesToDelete,
    };
  });
}

/**
 * Delete samples without automatic reindexing (for manual control)
 */
export function deleteSamplesWithoutReindexing(
  dbDir: string,
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): DbResult<{ deletedSamples: Sample[] }> {
  return withDb(dbDir, (db) => {
    const whereCondition = buildDeleteConditions(kitName, filter);
    const samplesToDelete = getSamplesToDelete(db, whereCondition);

    // Delete the samples without reindexing
    db.delete(samples).where(whereCondition).run();

    return {
      deletedSamples: samplesToDelete,
    };
  });
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
  db: BetterSQLite3Database<typeof schema>,
  whereCondition: SQL,
): Sample[] {
  return db.select().from(samples).where(whereCondition).all();
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
    if (updates.is_stereo !== undefined)
      updateData.is_stereo = updates.is_stereo;
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

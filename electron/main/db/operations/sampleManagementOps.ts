import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import {
  getInsertionDbSlotWithReindexing,
  reindexSamples,
} from "@romper/shared/slotUtils.js";
// Complex sample management operations: moving, reindexing, and shifting
import { and, eq } from "drizzle-orm";

// Type for samples that track their original position during moves
type SampleWithOriginalSlot = { original_slot_number: number } & Sample;

import * as schema from "@romper/shared/db/schema.js";

import { withDb, withDbTransaction } from "../utils/dbUtilities.js";

const { samples } = schema;

/**
 * Get the sample to move for move operations
 */
export function getSampleToMove(
  db: any,
  kitName: string,
  fromVoice: number,
  fromSlot: number,
): null | Sample {
  const sampleToMove = db
    .select()
    .from(samples)
    .where(
      and(
        eq(samples.kit_name, kitName),
        eq(samples.voice_number, fromVoice),
        eq(samples.slot_number, fromSlot),
      ),
    )
    .get();

  if (!sampleToMove) {
    console.log(
      `[Main] No sample found at voice ${fromVoice}, slot ${fromSlot}`,
    );
    return null;
  }

  return sampleToMove;
}

/**
 * Group samples by voice number for batch processing
 */
export function groupSamplesByVoice(
  samplesToDelete: Sample[],
): Map<number, Sample[]> {
  const groupedSamples = new Map<number, Sample[]>();
  for (const sample of samplesToDelete) {
    const voiceNum = sample.voice_number;
    if (!groupedSamples.has(voiceNum)) {
      groupedSamples.set(voiceNum, []);
    }
    groupedSamples.get(voiceNum)!.push(sample);
  }
  return groupedSamples;
}

/**
 * Task 22.2: Move sample with spaced slot system - SIMPLIFIED VERSION
 * Uses spaced slot numbering (100, 200, 300) to avoid unique constraint violations
 */
export function moveSample(
  dbDir: string,
  kitName: string,
  fromVoice: number,
  fromSlot: number,
  toVoice: number,
  toSlot: number,
  _mode: "insert" | "overwrite" = "overwrite",
): DbResult<{
  affectedSamples: SampleWithOriginalSlot[];
  movedSample: Sample;
  replacedSample: null | Sample;
}> {
  return withDbTransaction(dbDir, (db, _sqlite) => {
    const sampleToMove = getSampleToMove(db, kitName, fromVoice, fromSlot);
    if (!sampleToMove) {
      throw new Error(
        `No sample found at voice ${fromVoice}, slot ${fromSlot}`,
      );
    }

    let affectedSamples: SampleWithOriginalSlot[] = [];
    let replacedSample: null | Sample = null;

    // Get existing samples in the destination voice for insertion logic
    const existingSamples = db
      .select()
      .from(samples)
      .where(
        and(eq(samples.kit_name, kitName), eq(samples.voice_number, toVoice)),
      )
      .all();

    // Insert mode: find appropriate insertion slot using spaced numbering with auto-reindexing
    const displaySlot = toSlot / 100; // Convert database slot to display slot
    const insertionResult = getInsertionDbSlotWithReindexing(
      existingSamples,
      displaySlot,
    );

    const finalToSlot = insertionResult.insertionSlot;

    // If reindexing occurred, update all existing samples in the database
    if (insertionResult.wasReindexed && insertionResult.reindexedSamples) {
      console.log(
        `[moveSample] Reindexing ${insertionResult.reindexedSamples.length} samples in voice ${toVoice}`,
      );

      // Create a map from original slot to new slot for efficient lookup
      const slotMappings = new Map<number, number>();
      insertionResult.reindexedSamples.forEach((reindexed, index) => {
        const originalSample = existingSamples[index];
        if (originalSample) {
          slotMappings.set(originalSample.slot_number, reindexed.slot_number);
        }
      });

      // Update all samples to their new reindexed positions
      existingSamples.forEach((sample: Sample) => {
        const newSlot = slotMappings.get(sample.slot_number);
        if (newSlot !== undefined) {
          db.update(samples)
            .set({ slot_number: newSlot })
            .where(eq(samples.id, sample.id))
            .run();

          // Add to affected samples list for undo tracking
          affectedSamples.push({
            ...sample,
            original_slot_number: sample.slot_number,
            slot_number: newSlot,
          });
        }
      });
    }

    // Update the sample to its new position
    db.update(samples)
      .set({
        slot_number: finalToSlot,
        voice_number: toVoice,
      })
      .where(eq(samples.id, sampleToMove.id))
      .run();

    return {
      affectedSamples,
      movedSample: {
        ...sampleToMove,
        slot_number: finalToSlot,
        voice_number: toVoice,
      },
      replacedSample,
    };
  });
}

// Atomic helper functions removed - functionality integrated into main moveSample function

/**
 * Perform voice reindexing after sample deletion
 * This uses the proven reindexing algorithm to redistribute samples evenly
 */
export function performVoiceReindexing(
  dbDir: string,
  kitName: string,
  samplesToDelete: Sample[],
): Sample[] {
  const allAffectedSamples: Sample[] = [];

  // Group samples by voice to minimize database calls
  const samplesByVoice = groupSamplesByVoice(samplesToDelete);

  // Process each voice separately using reindexing
  for (const [voiceNum] of samplesByVoice) {
    const reindexResult = reindexVoiceAfterDeletion(dbDir, kitName, voiceNum);
    if (reindexResult.success && reindexResult.data) {
      allAffectedSamples.push(...reindexResult.data);
    }
  }

  return allAffectedSamples;
}

/**
 * Reindex a single voice after deletion by redistributing all remaining samples
 * This uses the unified reindexing algorithm to maintain even spacing
 */
function reindexVoiceAfterDeletion(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
): DbResult<Sample[]> {
  return withDb(dbDir, (db) => {
    // Get all remaining samples for this voice
    const remainingSamples = db
      .select()
      .from(samples)
      .where(
        and(
          eq(samples.kit_name, kitName),
          eq(samples.voice_number, voiceNumber),
        ),
      )
      .all() as Sample[];

    if (remainingSamples.length === 0) {
      return []; // No samples to reindex
    }

    // Use the proven reindexing algorithm to redistribute samples
    const reindexedSamples = reindexSamples(remainingSamples);

    // Update all samples with their new positions in a single transaction
    for (const reindexedSample of reindexedSamples) {
      db.update(samples)
        .set({ slot_number: reindexedSample.slot_number })
        .where(eq(samples.id, reindexedSample.id))
        .run();
    }

    return reindexedSamples;
  });
}

/**
 * DEPRECATED: Legacy functions removed
 * The atomic moveSample() function now handles moves without temporary slots
 * to avoid unique constraint violations.
 */

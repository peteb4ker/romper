import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, eq } from "drizzle-orm";

import { logger } from "../../utils/logger.js";
import { type RomperDb } from "../utils/dbUtilities.js";
import { moveSampleInsertOnly } from "./sampleMovement.js";

// Type for samples that track their original position during moves
type SampleWithOriginalSlot = { original_slot_number: number } & Sample;

const { samples } = schema;

/**
 * Get the sample to move for move operations
 */
export function getSampleToMove(
  db: RomperDb,
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
    logger.log(
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
 * Move sample with simple 1-12 slot system
 * Uses insert-only behavior with automatic reindexing for contiguity
 */
/**
 * Move sample using insert-only drag and drop behavior
 * Simplified API: frontend passes drag source and drop target, backend handles all complexity
 * Uses 0-based slot indexing throughout (0-11 for 12 slots per voice)
 */
export function moveSample(
  dbDir: string,
  kitName: string,
  fromVoice: number,
  fromSlot: number,
  toVoice: number,
  toSlot: number,
): DbResult<{
  affectedSamples: SampleWithOriginalSlot[];
  movedSample: Sample;
  replacedSample: null | Sample;
}> {
  const result = moveSampleInsertOnly(
    dbDir,
    kitName,
    fromVoice,
    fromSlot,
    toVoice,
    toSlot,
  );

  if (!result.success) {
    return {
      error: result.error,
      success: false,
    };
  }

  // Convert to expected return format for backward compatibility
  return {
    data: {
      affectedSamples: result.data!.affectedSamples.map((s) => ({
        ...s,
        original_slot_number: s.original_slot_number, // Keep same field name
      })) as SampleWithOriginalSlot[],
      movedSample: result.data!.movedSample,
      replacedSample: null, // Insert-only behavior never replaces samples
    },
    success: true,
  };
}

// Atomic helper functions removed - functionality integrated into main moveSample function

/**
 * Close the gaps a deletion left: each voice that lost samples gets its
 * remaining samples renumbered to contiguous slots from 0. Runs on the
 * caller's transaction, so the delete and the reindex commit together
 * (RE-28).
 */
export function performVoiceReindexing(
  db: RomperDb,
  kitName: string,
  samplesToDelete: Sample[],
): Sample[] {
  const allAffectedSamples: Sample[] = [];
  for (const [voiceNum] of groupSamplesByVoice(samplesToDelete)) {
    allAffectedSamples.push(...reindexVoiceTx(db, kitName, voiceNum));
  }
  return allAffectedSamples;
}

/**
 * Renumber a voice's samples to contiguous slots from 0, keeping their
 * order. Returns every sample in the voice with its new slot.
 */
export function reindexVoiceTx(
  db: RomperDb,
  kitName: string,
  voiceNumber: number,
): Sample[] {
  const remainingSamples = db
    .select()
    .from(samples)
    .where(
      and(eq(samples.kit_name, kitName), eq(samples.voice_number, voiceNumber)),
    )
    .orderBy(samples.slot_number)
    .all();

  // Lowest slots first, so a sample only ever moves down into a slot that
  // is already free
  remainingSamples.forEach((sample, index) => {
    if (sample.slot_number === index) return;
    db.update(samples)
      .set({ slot_number: index })
      .where(eq(samples.id, sample.id))
      .run();
  });

  return remainingSamples.map((sample, index) => ({
    ...sample,
    slot_number: index,
  }));
}

/**
 * DEPRECATED: Legacy functions removed
 * The atomic moveSample() function now handles moves without temporary slots
 * to avoid unique constraint violations.
 */

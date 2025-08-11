import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, eq } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";
import { moveSampleInsertOnly } from "./sampleMovement.js";

// Type for samples that track their original position during moves
type SampleWithOriginalSlot = { original_slot_number: number } & Sample;

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
    return result as any;
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
 * Perform voice reindexing after sample deletion
 * This redistributes samples to contiguous slots in 0-11 system
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
 * In 0-11 system, this simply assigns contiguous slots starting from 0
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

    // Sort samples by slot number and reassign to contiguous 0-based slots
    const sortedSamples = [...remainingSamples].sort(
      (a, b) => a.slot_number - b.slot_number,
    );
    const reindexedSamples = sortedSamples.map((sample, index) => ({
      ...sample,
      slot_number: index,
    }));

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

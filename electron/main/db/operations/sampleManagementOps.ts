import type { DbResult, Sample } from "@romper/shared/db/schema.js";

// Complex sample management operations: moving, compaction, and shifting
import { and, eq } from "drizzle-orm";

// Type for samples that track their original position during moves
type SampleWithOriginalSlot = { original_slot_number: number } & Sample;

import * as schema from "@romper/shared/db/schema.js";

import { withDb, withDbTransaction } from "../utils/dbUtilities.js";

const { samples } = schema;

/**
 * Parameters for executing a move operation
 */
interface MoveOperationParams {
  db: any;
  dbDir: string;
  fromSlot: number;
  fromVoice: number;
  kitName: string;
  mode: "insert" | "overwrite";
  moveContext: any;
  sampleToMove: Sample;
  toVoice: number;
}

/**
 * Task 22.1: Sample contiguity maintenance operations
 * Compact slots after a sample is deleted to maintain contiguity
 */
export function compactSlotsAfterDelete(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  deletedSlot: number,
): DbResult<Sample[]> {
  return withDb(dbDir, (db) => {
    // Get all samples in this voice with slot_number > deletedSlot
    const samplesToShift = db
      .select()
      .from(samples)
      .where(
        and(
          eq(samples.kit_name, kitName),
          eq(samples.voice_number, voiceNumber),
        ),
      )
      .all()
      .filter((sample: Sample) => sample.slot_number > deletedSlot)
      .sort((a: Sample, b: Sample) => a.slot_number - b.slot_number);

    // Shift each sample up by one slot
    const affectedSamples: SampleWithOriginalSlot[] = [];
    for (const sample of samplesToShift) {
      const newSlotNumber = sample.slot_number - 1;

      db.update(samples)
        .set({ slot_number: newSlotNumber })
        .where(eq(samples.id, sample.id))
        .run();

      // Track the updated sample for return
      affectedSamples.push({
        ...sample,
        slot_number: newSlotNumber,
      });
    }

    return affectedSamples;
  });
}

/**
 * Execute the core move operation
 */
export function executeMoveOperation(params: MoveOperationParams): {
  affectedSamples: SampleWithOriginalSlot[];
  movedSample: Sample;
  replacedSample: null | Sample;
} {
  const {
    db,
    fromSlot,
    fromVoice,
    kitName,
    mode,
    moveContext,
    sampleToMove,
    toVoice,
  } = params;

  const toSlot = moveContext.toSlot;

  // NOTE: This legacy executeMoveOperation function is deprecated.
  // The new atomic moveSample() function handles moves without temporary slots.

  let affectedSamples: SampleWithOriginalSlot[] = [];

  // Handle destination slot based on mode
  if (mode === "insert") {
    affectedSamples = handleInsertMode(db, kitName, toVoice, toSlot);
  } else {
    affectedSamples = handleOverwriteMode(
      db,
      kitName,
      toVoice,
      toSlot,
      moveContext,
    );
  }

  // Handle source slot compaction based on voice
  let sourceAffectedSamples: SampleWithOriginalSlot[] = [];
  if (fromVoice === toVoice) {
    // Same voice move - handle slot adjustment
    sourceAffectedSamples = handleSameVoiceCompaction(
      db,
      kitName,
      fromVoice,
      fromSlot,
      toSlot,
    );
  } else {
    // Cross-voice move - compact source voice
    sourceAffectedSamples = handlePostMoveCompaction(
      db,
      kitName,
      fromVoice,
      fromSlot,
    );
  }

  // Combine affected samples from both operations
  affectedSamples = affectedSamples.concat(sourceAffectedSamples);

  // Move the sample to its final position
  updateSamplePosition(db, sampleToMove.id, toSlot, toVoice);

  return {
    affectedSamples,
    movedSample: {
      ...sampleToMove,
      slot_number: toSlot,
      voice_number: toVoice,
    },
    replacedSample: moveContext.replacedSample,
  };
}

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
 * Handle insert mode by shifting existing samples
 */
export function handleInsertMode(
  db: any,
  kitName: string,
  toVoice: number,
  toSlot: number,
): SampleWithOriginalSlot[] {
  return handleSampleShifting(db, kitName, toVoice, toSlot);
}

/**
 * Handle overwrite mode by replacing existing sample
 */
export function handleOverwriteMode(
  db: any,
  kitName: string,
  toVoice: number,
  toSlot: number,
  moveContext: any,
): SampleWithOriginalSlot[] {
  handleOverwriteModeOperation(db, toVoice, toSlot, moveContext);
  return []; // No samples shifted in overwrite mode
}

/**
 * Handle overwrite mode operation by replacing existing sample
 */
export function handleOverwriteModeOperation(
  db: any,
  toVoice: number,
  toSlot: number,
  moveContext: any,
): void {
  const existingSample = db
    .select()
    .from(samples)
    .where(
      and(eq(samples.voice_number, toVoice), eq(samples.slot_number, toSlot)),
    )
    .get();

  if (existingSample) {
    moveContext.replacedSample = existingSample;
    db.delete(samples).where(eq(samples.id, existingSample.id)).run();
  }
}

/**
 * Handle post-move compaction after sample movement
 */
export function handlePostMoveCompaction(
  db: any,
  kitName: string,
  fromVoice: number,
  fromSlot: number,
): SampleWithOriginalSlot[] {
  // Get all samples in the from-voice with slot > fromSlot
  const samplesToShift = db
    .select()
    .from(samples)
    .where(
      and(eq(samples.kit_name, kitName), eq(samples.voice_number, fromVoice)),
    )
    .all()
    .filter((sample: Sample) => sample.slot_number > fromSlot)
    .sort((a: Sample, b: Sample) => a.slot_number - b.slot_number);

  const affectedSamples: SampleWithOriginalSlot[] = [];
  for (const sample of samplesToShift) {
    const newSlot = sample.slot_number - 1;
    db.update(samples)
      .set({ slot_number: newSlot })
      .where(eq(samples.id, sample.id))
      .run();

    affectedSamples.push({
      ...sample,
      original_slot_number: sample.slot_number,
      slot_number: newSlot,
    });
  }

  return affectedSamples;
}

/**
 * Handle same-voice move compaction
 */
export function handleSameVoiceCompaction(
  db: any,
  kitName: string,
  fromVoice: number,
  fromSlot: number,
  toSlot: number,
): SampleWithOriginalSlot[] {
  if (fromSlot < toSlot) {
    // Moving down: shift samples between fromSlot+1 and toSlot up by 1
    const samplesToShift = db
      .select()
      .from(samples)
      .where(
        and(eq(samples.kit_name, kitName), eq(samples.voice_number, fromVoice)),
      )
      .all()
      .filter(
        (sample: Sample) =>
          sample.slot_number > fromSlot && sample.slot_number <= toSlot,
      )
      .sort((a: Sample, b: Sample) => a.slot_number - b.slot_number);

    const affectedSamples: SampleWithOriginalSlot[] = [];
    for (const sample of samplesToShift) {
      const newSlot = sample.slot_number - 1;
      db.update(samples)
        .set({ slot_number: newSlot })
        .where(eq(samples.id, sample.id))
        .run();

      affectedSamples.push({
        ...sample,
        original_slot_number: sample.slot_number,
        slot_number: newSlot,
      });
    }
    return affectedSamples;
  } else {
    // Moving up: shift samples between toSlot and fromSlot-1 down by 1
    const samplesToShift = db
      .select()
      .from(samples)
      .where(
        and(eq(samples.kit_name, kitName), eq(samples.voice_number, fromVoice)),
      )
      .all()
      .filter(
        (sample: Sample) =>
          sample.slot_number >= toSlot && sample.slot_number < fromSlot,
      )
      .sort((a: Sample, b: Sample) => b.slot_number - a.slot_number);

    const affectedSamples: SampleWithOriginalSlot[] = [];
    for (const sample of samplesToShift) {
      const newSlot = sample.slot_number + 1;
      db.update(samples)
        .set({ slot_number: newSlot })
        .where(eq(samples.id, sample.id))
        .run();

      affectedSamples.push({
        ...sample,
        original_slot_number: sample.slot_number,
        slot_number: newSlot,
      });
    }
    return affectedSamples;
  }
}

/**
 * Handle sample shifting for insert mode
 */
export function handleSampleShifting(
  db: any,
  kitName: string,
  toVoice: number,
  toSlot: number,
): SampleWithOriginalSlot[] {
  // Get all samples in the target voice with slot >= toSlot
  const samplesToShift = db
    .select()
    .from(samples)
    .where(
      and(eq(samples.kit_name, kitName), eq(samples.voice_number, toVoice)),
    )
    .all()
    .filter((sample: Sample) => sample.slot_number >= toSlot)
    .sort((a: Sample, b: Sample) => b.slot_number - a.slot_number); // Reverse order to avoid conflicts

  const affectedSamples: SampleWithOriginalSlot[] = [];
  for (const sample of samplesToShift) {
    const newSlot = sample.slot_number + 1;
    db.update(samples)
      .set({ slot_number: newSlot })
      .where(eq(samples.id, sample.id))
      .run();

    affectedSamples.push({
      ...sample,
      original_slot_number: sample.slot_number,
      slot_number: newSlot,
    });
  }

  return affectedSamples;
}

/**
 * Initialize move context for tracking operation state
 */
export function initializeMoveContext(toSlot: number) {
  return {
    replacedSample: null,
    toSlot,
  };
}

/**
 * Task 22.2: Move sample with contiguity maintenance - ATOMIC VERSION
 * New transaction-based approach that avoids unique constraint violations
 */
export function moveSample(
  dbDir: string,
  kitName: string,
  fromVoice: number,
  fromSlot: number,
  toVoice: number,
  toSlot: number,
  mode: "insert" | "overwrite" = "overwrite",
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

    // Generate unique temporary slot numbers starting from a high value
    const baseTemp = 10000 + (Date.now() % 10000);
    let tempCounter = 0;

    let affectedSamples: SampleWithOriginalSlot[] = [];
    let replacedSample: null | Sample = null;

    // Step 1: Move the source sample to a temporary slot first to free up its position
    const sourceTempSlot = baseTemp + tempCounter++;
    // Move source sample to temporary slot to free up its position
    db.update(samples)
      .set({ slot_number: sourceTempSlot })
      .where(eq(samples.id, sampleToMove.id))
      .run();

    // Step 2: Handle destination preparations
    if (mode === "overwrite") {
      // Check if there's a sample to replace at destination
      const existingSample = db
        .select()
        .from(samples)
        .where(
          and(
            eq(samples.kit_name, kitName),
            eq(samples.voice_number, toVoice),
            eq(samples.slot_number, toSlot),
          ),
        )
        .get();

      if (existingSample) {
        replacedSample = existingSample;
        db.delete(samples).where(eq(samples.id, existingSample.id)).run();
      }
    } else if (mode === "insert") {
      // Get samples that need to be shifted in destination voice
      const samplesToShift = db
        .select()
        .from(samples)
        .where(
          and(eq(samples.kit_name, kitName), eq(samples.voice_number, toVoice)),
        )
        .all()
        .filter((sample: Sample) => sample.slot_number >= toSlot)
        .sort((a: Sample, b: Sample) => b.slot_number - a.slot_number); // Process high to low

      // Move each to temp slots first
      const tempSlots = samplesToShift.map((sample: Sample, _i: number) => {
        const tempSlot = baseTemp + tempCounter++;
        db.update(samples)
          .set({ slot_number: tempSlot })
          .where(eq(samples.id, sample.id))
          .run();
        return { finalSlot: sample.slot_number + 1, sample, tempSlot };
      });

      // Now move them to their final positions
      tempSlots.forEach(
        ({
          finalSlot,
          sample,
        }: {
          finalSlot: number;
          sample: Sample;
          tempSlot: number;
        }) => {
          db.update(samples)
            .set({ slot_number: finalSlot })
            .where(eq(samples.id, sample.id))
            .run();

          affectedSamples.push({
            ...sample,
            original_slot_number: sample.slot_number,
            slot_number: finalSlot,
          });
        },
      );
    }

    // Step 3: Handle source voice compaction (only needed for cross-voice moves)
    if (fromVoice !== toVoice) {
      // Cross-voice move: compact the source voice
      const sourceVoiceSamples = db
        .select()
        .from(samples)
        .where(
          and(
            eq(samples.kit_name, kitName),
            eq(samples.voice_number, fromVoice),
          ),
        )
        .all()
        .filter((sample: Sample) => sample.slot_number > fromSlot)
        .sort((a: Sample, b: Sample) => a.slot_number - b.slot_number);

      // Move to temp slots first
      const tempMoves = sourceVoiceSamples.map((sample: Sample, _i: number) => {
        const tempSlot = baseTemp + tempCounter++;
        db.update(samples)
          .set({ slot_number: tempSlot })
          .where(eq(samples.id, sample.id))
          .run();
        return { finalSlot: sample.slot_number - 1, sample, tempSlot };
      });

      // Move to final positions
      tempMoves.forEach(
        ({
          finalSlot,
          sample,
        }: {
          finalSlot: number;
          sample: Sample;
          tempSlot: number;
        }) => {
          db.update(samples)
            .set({ slot_number: finalSlot })
            .where(eq(samples.id, sample.id))
            .run();

          affectedSamples.push({
            ...sample,
            original_slot_number: sample.slot_number,
            slot_number: finalSlot,
          });
        },
      );
    }

    // Step 4: Finally, move the original sample to its destination
    db.update(samples)
      .set({
        slot_number: toSlot,
        voice_number: toVoice,
      })
      .where(eq(samples.id, sampleToMove.id))
      .run();

    return {
      affectedSamples,
      movedSample: {
        ...sampleToMove,
        slot_number: toSlot,
        voice_number: toVoice,
      },
      replacedSample,
    };
  });
}

// Atomic helper functions removed - functionality integrated into main moveSample function

/**
 * Perform voice compaction after sample deletion
 */
export function performVoiceCompaction(
  dbDir: string,
  kitName: string,
  samplesToDelete: Sample[],
): Sample[] {
  let allAffectedSamples: Sample[] = [];

  // Group samples by voice to minimize database calls
  const samplesByVoice = groupSamplesByVoice(samplesToDelete);

  // Process each voice separately
  for (const [voiceNum, voiceSamples] of samplesByVoice) {
    // Sort samples by slot_number to delete from highest slot first
    // This prevents slot number conflicts during deletion
    const sortedSamples = voiceSamples.sort(
      (a, b) => b.slot_number - a.slot_number,
    );

    for (const sample of sortedSamples) {
      const result = compactSlotsAfterDelete(
        dbDir,
        kitName,
        voiceNum,
        sample.slot_number,
      );
      if (result.success && result.data) {
        allAffectedSamples = allAffectedSamples.concat(result.data);
      }
    }
  }

  return allAffectedSamples;
}

/**
 * DEPRECATED: temporarilyMoveSample function removed
 * The atomic moveSample() function now handles moves without temporary slots
 * to avoid unique constraint violations.
 */

/**
 * Update sample position in database
 */
export function updateSamplePosition(
  db: any,
  sampleId: number,
  newSlot: number,
  newVoice: number,
): void {
  db.update(samples)
    .set({
      slot_number: newSlot,
      voice_number: newVoice,
    })
    .where(eq(samples.id, sampleId))
    .run();
}

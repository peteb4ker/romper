import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, eq, ne } from "drizzle-orm";

import { withDbTransaction } from "../utils/dbUtilities.js";

const { samples } = schema;

// Type for tracking original positions during moves
type SampleWithOriginalPosition = {
  original_slot_number: number;
  original_voice_number: number;
} & Sample;

/**
 * Validate voice can accept a new sample (not at 12-sample limit)
 */
export function canVoiceAcceptSample(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
): DbResult<boolean> {
  return withDbTransaction(dbDir, (db) => {
    const sampleCount = db
      .select()
      .from(samples)
      .where(
        and(
          eq(samples.kit_name, kitName),
          eq(samples.voice_number, voiceNumber),
        ),
      )
      .all().length;

    return sampleCount < 12;
  });
}

/**
 * Core drag and drop operation: Move sample using insert-only behavior
 * Implements the complete specification at the lowest database level
 * Frontend only needs to provide drag source and drop target
 */
export function moveSampleInsertOnly(
  dbDir: string,
  kitName: string,
  fromVoice: number,
  fromSlot: number,
  toVoice: number,
  toSlot: number,
): DbResult<{
  affectedSamples: SampleWithOriginalPosition[];
  movedSample: Sample;
}> {
  return withDbTransaction(dbDir, (db) => {
    // Validate inputs - 0-based indexing (0-11 slots)
    if (fromSlot < 0 || fromSlot >= 12 || toSlot < 0 || toSlot >= 12) {
      throw new Error(
        `Invalid slot numbers. Must be 0-11. Got from:${fromSlot}, to:${toSlot}`,
      );
    }

    if (fromVoice < 1 || fromVoice > 4 || toVoice < 1 || toVoice > 4) {
      throw new Error(
        `Invalid voice numbers. Must be 1-4. Got from:${fromVoice}, to:${toVoice}`,
      );
    }

    // Get sample to move
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
      throw new Error(
        `No sample found at voice ${fromVoice}, slot ${fromSlot}`,
      );
    }

    // No-op if moving to same position
    if (fromVoice === toVoice && fromSlot === toSlot) {
      return {
        affectedSamples: [],
        movedSample: sampleToMove,
      };
    }

    const affectedSamples: SampleWithOriginalPosition[] = [];

    if (fromVoice === toVoice) {
      // Same voice move: insert-only reordering
      affectedSamples.push(
        ...performSameVoiceMove(
          db,
          kitName,
          sampleToMove,
          fromSlot,
          toSlot,
          fromVoice,
        ),
      );
    } else {
      // Cross-voice move: insert-only between voices
      affectedSamples.push(
        ...performCrossVoiceMove(
          db,
          kitName,
          sampleToMove,
          fromSlot,
          toSlot,
          fromVoice,
          toVoice,
        ),
      );
    }

    // Get updated sample
    const movedSample = db
      .select()
      .from(samples)
      .where(eq(samples.id, sampleToMove.id))
      .get();

    const result = {
      affectedSamples,
      movedSample: movedSample || {
        ...sampleToMove,
        slot_number: toSlot,
        voice_number: toVoice,
      },
    };

    return result;
  });
}

/**
 * Compact samples to contiguous 0-based slots (0, 1, 2, ...)
 * Core utility for maintaining slot contiguity
 */
function compactToContiguousSlots(
  db: any,
  samplesToCompact: Sample[],
): SampleWithOriginalPosition[] {
  const affectedSamples: SampleWithOriginalPosition[] = [];

  for (let i = 0; i < samplesToCompact.length; i++) {
    const sample = samplesToCompact[i];
    const targetSlot = i; // 0-based: 0, 1, 2, ...

    if (sample.slot_number !== targetSlot) {
      db.update(samples)
        .set({ slot_number: targetSlot })
        .where(eq(samples.id, sample.id))
        .run();

      affectedSamples.push({
        ...sample,
        original_slot_number: sample.slot_number,
        original_voice_number: sample.voice_number,
        slot_number: targetSlot,
      });
    }
  }

  return affectedSamples;
}

/**
 * Insert sample at position, shifting existing samples to make room
 * Implements pure insert-only behavior
 */
function insertAtPositionWithShift(
  db: any,
  kitName: string,
  voiceNumber: number,
  insertSlot: number,
  sampleId: number,
): SampleWithOriginalPosition[] {
  const affectedSamples: SampleWithOriginalPosition[] = [];

  // Get samples at insertion point and after, sorted in descending order for safe shifting
  const samplesToShift = db
    .select()
    .from(samples)
    .where(
      and(eq(samples.kit_name, kitName), eq(samples.voice_number, voiceNumber)),
    )
    .all()
    .filter((s: Sample) => s.slot_number >= insertSlot)
    .sort((a: Sample, b: Sample) => b.slot_number - a.slot_number);

  // Shift samples one position to the right
  for (const sample of samplesToShift) {
    const newSlot = sample.slot_number + 1;

    // Validate we don't exceed 12-slot limit
    if (newSlot >= 12) {
      throw new Error(
        `Cannot shift sample beyond slot 11. Voice ${voiceNumber} would exceed 12-sample limit.`,
      );
    }

    db.update(samples)
      .set({ slot_number: newSlot })
      .where(eq(samples.id, sample.id))
      .run();

    affectedSamples.push({
      ...sample,
      original_slot_number: sample.slot_number,
      original_voice_number: sample.voice_number,
      slot_number: newSlot,
    });
  }

  // Place moved sample at target position
  db.update(samples)
    .set({
      slot_number: insertSlot,
      voice_number: voiceNumber,
    })
    .where(eq(samples.id, sampleId))
    .run();

  return affectedSamples;
}

/**
 * Handle cross-voice moves using insert-only behavior
 * Compacts source voice and inserts into destination voice
 */
function performCrossVoiceMove(
  db: any,
  kitName: string,
  sampleToMove: Sample,
  fromSlot: number,
  toSlot: number,
  fromVoice: number,
  toVoice: number,
): SampleWithOriginalPosition[] {
  const affectedSamples: SampleWithOriginalPosition[] = [];

  // Remove from source voice
  db.update(samples)
    .set({ slot_number: -1, voice_number: -1 })
    .where(eq(samples.id, sampleToMove.id))
    .run();

  // Compact source voice to remove gap
  const sourceVoiceSamples = db
    .select()
    .from(samples)
    .where(
      and(
        eq(samples.kit_name, kitName),
        eq(samples.voice_number, fromVoice),
        ne(samples.id, sampleToMove.id),
      ),
    )
    .orderBy(samples.slot_number)
    .all();

  const compactedSource = compactToContiguousSlots(db, sourceVoiceSamples);
  affectedSamples.push(...compactedSource);

  // Check if destination voice has room (max 12 samples, 0-11 slots)
  const destVoiceSampleCount = db
    .select()
    .from(samples)
    .where(
      and(eq(samples.kit_name, kitName), eq(samples.voice_number, toVoice)),
    )
    .all().length;

  if (destVoiceSampleCount >= 12) {
    // Restore sample to original position and throw error
    db.update(samples)
      .set({ slot_number: fromSlot, voice_number: fromVoice })
      .where(eq(samples.id, sampleToMove.id))
      .run();

    throw new Error(
      `Destination voice ${toVoice} is full (12 samples maximum)`,
    );
  }

  // Ensure target slot doesn't exceed destination voice capacity
  const adjustedToSlot = Math.min(toSlot, destVoiceSampleCount);

  // Insert into destination voice
  const insertedSamples = insertAtPositionWithShift(
    db,
    kitName,
    toVoice,
    adjustedToSlot,
    sampleToMove.id,
  );
  affectedSamples.push(...insertedSamples);

  return affectedSamples;
}

/**
 * Handle same-voice moves using insert-only behavior
 * Uses 0-based slot indexing throughout
 */
function performSameVoiceMove(
  db: any,
  kitName: string,
  sampleToMove: Sample,
  fromSlot: number,
  toSlot: number,
  voiceNumber: number,
): SampleWithOriginalPosition[] {
  const affectedSamples: SampleWithOriginalPosition[] = [];

  // Temporarily remove sample from slot sequence
  db.update(samples)
    .set({ slot_number: -1 })
    .where(eq(samples.id, sampleToMove.id))
    .run();

  // Get remaining samples in voice, sorted by slot
  const voiceSamples = db
    .select()
    .from(samples)
    .where(
      and(
        eq(samples.kit_name, kitName),
        eq(samples.voice_number, voiceNumber),
        ne(samples.id, sampleToMove.id),
      ),
    )
    .orderBy(samples.slot_number)
    .all()
    .filter((s: Sample) => s.slot_number >= 0); // Exclude our temporarily removed sample

  // Compact remaining samples to 0-based contiguous slots
  const compactedSamples = compactToContiguousSlots(db, voiceSamples);
  affectedSamples.push(...compactedSamples);

  // Adjust target slot if needed (account for removed sample in same voice)
  const adjustedToSlot = Math.min(toSlot, voiceSamples.length);

  // Insert at target position, shifting others as needed
  const insertedSamples = insertAtPositionWithShift(
    db,
    kitName,
    voiceNumber,
    adjustedToSlot,
    sampleToMove.id,
  );
  affectedSamples.push(...insertedSamples);

  return affectedSamples;
}

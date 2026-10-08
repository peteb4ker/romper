import type { Sample } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, eq } from "drizzle-orm";

import { type RomperDb } from "../utils/dbUtilities.js";

const { samples } = schema;

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

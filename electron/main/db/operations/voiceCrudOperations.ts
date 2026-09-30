import type { DbResult } from "@romper/shared/db/schema.js";
import type { VoiceSliceSettings } from "@romper/shared/sliceTypes.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, eq } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";

const { voices } = schema;

/**
 * Update voice alias
 */
export function updateVoiceAlias(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  alias: string,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.update(voices)
      .set({ voice_alias: alias })
      .where(
        and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
      )
      .run();
  });
}

/**
 * Update voice sample mode ("first" | "random" | "round-robin")
 */
export function updateVoiceSampleMode(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  sampleMode: string,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    ensureVoiceRow(db, kitName, voiceNumber);
    db.update(voices)
      .set({ sample_mode: sampleMode })
      .where(
        and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
      )
      .run();
  });
}

/**
 * Update voice slicer settings (slice mode toggle and roll settings).
 * Only the provided fields are changed.
 */
export function updateVoiceSliceSettings(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  settings: Partial<VoiceSliceSettings>,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    ensureVoiceRow(db, kitName, voiceNumber);
    const updates: Partial<typeof voices.$inferInsert> = {};
    if (settings.enabled !== undefined)
      updates.slice_enabled = settings.enabled;
    if (settings.maxLength !== undefined)
      updates.slice_max_length = settings.maxLength;
    if (settings.rollAmount !== undefined)
      updates.slice_roll_amount = settings.rollAmount;
    if (settings.varyLength !== undefined)
      updates.slice_vary_length = settings.varyLength;
    if (Object.keys(updates).length === 0) return;
    db.update(voices)
      .set(updates)
      .where(
        and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
      )
      .run();
  });
}

/**
 * Update voice stereo mode
 */
export function updateVoiceStereoMode(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  stereoMode: boolean,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    ensureVoiceRow(db, kitName, voiceNumber);
    db.update(voices)
      .set({ stereo_mode: stereoMode })
      .where(
        and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
      )
      .run();
  });
}

/**
 * Update voice volume (0-100)
 */
export function updateVoiceVolume(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  volume: number,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    ensureVoiceRow(db, kitName, voiceNumber);
    db.update(voices)
      .set({ voice_volume: volume })
      .where(
        and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
      )
      .run();
  });
}

/**
 * Ensure a voice row exists for the given kit/voice, creating it if needed.
 */
function ensureVoiceRow(
  db: Parameters<Parameters<typeof withDb>[1]>[0],
  kitName: string,
  voiceNumber: number,
): void {
  const existing = db
    .select({ id: voices.id })
    .from(voices)
    .where(
      and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
    )
    .get();
  if (!existing) {
    db.insert(voices)
      .values({ kit_name: kitName, voice_number: voiceNumber })
      .run();
  }
}

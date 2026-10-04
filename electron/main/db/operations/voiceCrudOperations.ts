import type { DbResult } from "@romper/shared/db/schema.js";
import type { VoiceSliceSettings } from "@romper/shared/sliceTypes.js";

import * as schema from "@romper/shared/db/schema.js";
import { checkStereoLink } from "@romper/shared/stereoLinkRules.js";
import { and, eq } from "drizzle-orm";

import { type RomperDb, withDbTransaction } from "../utils/dbUtilities.js";
import { flagKitModified } from "./kitSyncOperations.js";

const { samples, voices } = schema;

/**
 * Link voices automatically (#537 rule 2), on the caller's transaction:
 * setup and the write make the links `planKitStereo` decides. Only an
 * unlinked voice is linked, and its stereo choice stays unset, so the pair
 * shows as linked automatically. Nothing is ever unlinked here.
 */
export function linkVoicesAutomaticallyTx(
  db: RomperDb,
  kitName: string,
  voiceNumbers: readonly number[],
): void {
  for (const voiceNumber of voiceNumbers) {
    ensureVoiceRow(db, kitName, voiceNumber);
    db.update(voices)
      .set({ stereo_mode: true })
      .where(
        and(
          eq(voices.kit_name, kitName),
          eq(voices.voice_number, voiceNumber),
          eq(voices.stereo_mode, false),
        ),
      )
      .run();
  }
}

/**
 * Update voice alias. Renaming a voice is an edit to the kit, so a name
 * that actually changes marks the kit modified (RE-35); saving the same
 * name again doesn't.
 */
export function updateVoiceAlias(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  alias: string,
): DbResult<void> {
  return withDbTransaction(dbDir, (db) => {
    const voice = and(
      eq(voices.kit_name, kitName),
      eq(voices.voice_number, voiceNumber),
    );
    const current = db
      .select({ voice_alias: voices.voice_alias })
      .from(voices)
      .where(voice)
      .get();
    if (!current || (current.voice_alias ?? "") === (alias ?? "")) return;
    db.update(voices).set({ voice_alias: alias }).where(voice).run();
    flagKitModified(db, kitName);
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
  return withDbTransaction(dbDir, (db) => {
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
  return withDbTransaction(dbDir, (db) => {
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
 * Link a voice with the next one as a stereo pair, or unlink it. Linking or
 * unlinking changes what the next write puts on the card (an unlinked
 * voice's stereo files are mixed to mono), so the kit is marked modified.
 *
 * Linking is refused, with S8's message and no change, when checkStereoLink
 * refuses it (#541): voice 4, a voice already in a pair, and a voice whose
 * next voice has samples or is in a pair. The check and the update share
 * one transaction. Unlinking is always allowed. Either records the user's
 * choice (`stereo_choice`), which automatic linking respects (#537). An
 * unlink of a voice that isn't linked records "Keep mono" for it.
 */
export function updateVoiceStereoMode(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  stereoMode: boolean,
): DbResult<void> {
  const result = withDbTransaction(dbDir, (db): DbResult<void> => {
    if (stereoMode) {
      const check = checkStereoLink(
        voiceNumber,
        db
          .select({
            stereo_mode: voices.stereo_mode,
            voice_number: voices.voice_number,
          })
          .from(voices)
          .where(eq(voices.kit_name, kitName))
          .all(),
        db
          .select({ voice_number: samples.voice_number })
          .from(samples)
          .where(eq(samples.kit_name, kitName))
          .all(),
      );
      // Returned, not thrown: a refusal isn't a database error
      if (!check.canLink) return { error: check.message, success: false };
    }
    ensureVoiceRow(db, kitName, voiceNumber);
    db.update(voices)
      // A link or unlink by hand is the user's choice: Romper never links
      // a voice automatically once it was unlinked (#537 rule 2)
      .set({
        stereo_choice: stereoMode ? "stereo" : "mono",
        stereo_mode: stereoMode,
      })
      .where(
        and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
      )
      .run();
    flagKitModified(db, kitName);
    return { success: true };
  });
  if (!result.success) return { error: result.error, success: false };
  return result.data ?? { success: true };
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
  return withDbTransaction(dbDir, (db) => {
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
  db: RomperDb,
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

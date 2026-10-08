import type {
  Bank,
  DbResult,
  Sample,
  Voice,
} from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, count, eq, inArray, notInArray } from "drizzle-orm";

import { logger } from "../../utils/logger.js";
import { type RomperDb, withDb } from "../utils/dbUtilities.js";

const { banks, kits, samples, voices } = schema;

/** Everything planning a write to the card reads from the store */
export interface SyncPlanData {
  /** Every bank, named or not: a named bank's file goes on the card */
  banks: Bank[];
  kitCount: number;
  /** Every sample, by kit, voice and slot */
  samples: Sample[];
  /**
   * Each voice's stereo setting and the user's stereo choice, which decide
   * links made at write, mono conversion and quarantine (#537)
   */
  voices: Pick<
    Voice,
    "kit_name" | "stereo_choice" | "stereo_mode" | "voice_number"
  >[];
}

/**
 * Flag every kit in a bank as modified, on an open connection. A bank's
 * name file sits on the card beside its kits, so renaming the bank changes
 * what the next write puts on the card for each of them (RE-35, #566).
 */
export function flagBankKitsModified(db: RomperDb, bankLetter: string): void {
  db.update(kits)
    .set({ modified_since_sync: true })
    .where(eq(kits.bank_letter, bankLetter))
    .run();
}

/**
 * Flag kits as modified, on a connection the caller already has open, so
 * an edit and its flag cost one connection. It's a single update by primary
 * key, cheap enough for every gain step (RE-35); a move between kits flags
 * both in that one update.
 *
 * "Modified" means the next write will change this kit on the card (#566).
 * Every edit that changes what the write puts there calls this (or
 * `flagBankKitsModified`) once, in the edit's transaction: adding,
 * deleting, moving, replacing or restoring samples, a scan that adds
 * samples, gain (the written file is scaled), and a stereo link, unlink or
 * "Keep mono" (they decide which files are mixed to mono). Edits the card
 * never sees don't: voice names, the kit alias, BPM, steps, trigger
 * conditions, slicer data and settings, level and sample mode. A new or
 * duplicated kit's row starts flagged.
 */
export function flagKitModified(
  db: RomperDb,
  ...kitNames: [string, ...string[]]
): void {
  db.update(kits)
    .set({ modified_since_sync: true })
    .where(
      kitNames.length === 1
        ? eq(kits.name, kitNames[0])
        : inArray(kits.name, kitNames),
    )
    .run();
}

/**
 * Load what sync planning needs in one connection: banks, the kit count,
 * every sample and every voice's stereo setting. Planning used to load each
 * kit's samples and voices separately, about two connections per kit
 * (RE-82).
 */
export function getSyncPlanData(dbDir: string): DbResult<SyncPlanData> {
  return withDb(dbDir, (db) => ({
    banks: db.select().from(banks).all(),
    kitCount: db.select({ n: count() }).from(kits).get()?.n ?? 0,
    samples: db
      .select()
      .from(samples)
      .orderBy(samples.kit_name, samples.voice_number, samples.slot_number)
      .all(),
    voices: db
      .select({
        kit_name: voices.kit_name,
        stereo_choice: voices.stereo_choice,
        stereo_mode: voices.stereo_mode,
        voice_number: voices.voice_number,
      })
      .from(voices)
      .all(),
  }));
}

/**
 * After a completed write, clear the flag on every kit except the ones
 * the write left behind. The card then mirrors the store, so a kit with
 * no samples (a renamed voice, a renamed bank, a new kit) is in step with
 * it too, not only the kits that had files to write (RE-35).
 */
export function markAllKitsAsSyncedExcept(
  dbDir: string,
  stillModified: string[],
): DbResult<number> {
  return withDb(dbDir, (db) => markAllKitsAsSyncedExceptTx(db, stillModified));
}

/** markAllKitsAsSyncedExcept on the caller's transaction */
export function markAllKitsAsSyncedExceptTx(
  db: RomperDb,
  stillModified: string[],
): number {
  const modified = eq(kits.modified_since_sync, true);
  const result = db
    .update(kits)
    .set({ modified_since_sync: false })
    .where(
      stillModified.length > 0
        ? and(modified, notInArray(kits.name, stillModified))
        : modified,
    )
    .run();
  return result.changes;
}

/**
 * Mark a kit as modified (sets modified_since_sync = true)
 */
export function markKitAsModified(
  dbDir: string,
  kitName: string,
): DbResult<void> {
  return withDb(dbDir, (db) => flagKitModified(db, kitName));
}

/**
 * Mark a kit as synced (sets modified_since_sync = false)
 */
export function markKitAsSynced(
  dbDir: string,
  kitName: string,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.update(kits)
      .set({
        modified_since_sync: false,
      })
      .where(eq(kits.name, kitName))
      .run();
  });
}

/**
 * Mark multiple kits as synced
 */
export function markKitsAsSynced(
  dbDir: string,
  kitNames: string[],
): DbResult<void> {
  return withDb(dbDir, (db) => markKitsAsSyncedTx(db, kitNames));
}

/** Mark kits as synced on the caller's handle */
export function markKitsAsSyncedTx(db: RomperDb, kitNames: string[]): void {
  logger.log(
    `[markKitsAsSynced] Attempting to mark ${kitNames.length} kits as synced:`,
    kitNames,
  );

  if (kitNames.length === 0) {
    logger.log("[markKitsAsSynced] Successfully updated 0/0 kits");
    return;
  }

  const result = db
    .update(kits)
    .set({
      modified_since_sync: false,
    })
    .where(inArray(kits.name, kitNames))
    .run();

  if (result.changes !== kitNames.length) {
    console.warn(
      `[markKitsAsSynced] Expected to update ${kitNames.length} kits but updated ${result.changes}`,
    );
  }

  logger.log(
    `[markKitsAsSynced] Successfully updated ${result.changes}/${kitNames.length} kits`,
  );
}

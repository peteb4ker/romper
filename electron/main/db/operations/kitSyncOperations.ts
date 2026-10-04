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
 * Flag every kit in a bank as changed since the last write, on an open
 * connection. A bank's name file sits on the card beside its kits, so
 * renaming the bank is a change to each of them (RE-35).
 */
export function flagBankKitsModified(db: RomperDb, bankLetter: string): void {
  db.update(kits)
    .set({ modified_since_sync: true })
    .where(eq(kits.bank_letter, bankLetter))
    .run();
}

/**
 * Flag a kit as changed since the last write, on a connection the caller
 * already has open, so an edit and its flag cost one connection. It's a
 * single update by primary key, cheap enough for every gain step (RE-35).
 */
export function flagKitModified(db: RomperDb, kitName: string): void {
  db.update(kits)
    .set({ modified_since_sync: true })
    .where(eq(kits.name, kitName))
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
  return withDb(dbDir, (db) => {
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
  });
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

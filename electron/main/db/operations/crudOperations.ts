import type { Bank, DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { eq } from "drizzle-orm";

import { withDb, withDbTransaction } from "../utils/dbUtilities.js";
import { flagBankKitsModified } from "./kitSyncOperations.js";

// Re-export operations from extracted modules
export {
  addKit,
  addKitTx,
  copyKit,
  deleteKit,
  getFavoriteKits,
  getFavoriteKitsCount,
  getKit,
  getKitDeleteSummary,
  getKits,
  getKitsMetadata,
  getSyncPlanData,
  markAllKitsAsSyncedExcept,
  markKitAsModified,
  markKitAsSynced,
  markKitsAsSynced,
  markKitsAsSyncedTx,
  toggleKitFavorite,
  updateKit,
} from "./kitCrudOperations.js";

export { mergeKitScan, mergeKitScanTx } from "./kitScanOperations.js";

export { flagKitModified } from "./kitSyncOperations.js";

export {
  addSample,
  addSampleTx,
  buildDeleteConditions,
  deleteSamples,
  deleteSamplesTx,
  deleteSamplesWithoutReindexing,
  deleteSamplesWithoutReindexingTx,
  getAllSamples,
  getKitSamples,
  getSamplesToDelete,
  replaceSampleTx,
  restoreVoicesTx,
  updateSampleGain,
  updateSampleMetadata,
  updateSampleSourceStatusTx,
} from "./sampleCrudOperations.js";

export {
  linkVoicesAutomaticallyTx,
  updateVoiceAlias,
  updateVoiceSampleMode,
  updateVoiceSliceSettings,
  updateVoiceStereoMode,
  updateVoiceVolume,
} from "./voiceCrudOperations.js";

const { banks } = schema;

/**
 * Get all banks from the database
 */
export function getAllBanks(dbDir: string): DbResult<Bank[]> {
  return withDb(dbDir, (db) => {
    return db.select().from(banks).all();
  });
}

/**
 * Update bank information.
 *
 * A bank's name is written to the card as an RTF file beside its kits, so
 * renaming or clearing it marks every kit in the bank modified (RE-35).
 * A bank scan passes `source: "scan"`: it reads names back from the
 * store's own RTF files, which already match the card, so it changes
 * nothing the next write would.
 */
export function updateBank(
  dbDir: string,
  bankLetter: string,
  updates: Partial<Bank>,
  { source = "edit" }: { source?: "edit" | "scan" } = {},
): DbResult<void> {
  return withDbTransaction(dbDir, (db) => {
    const updateData: Partial<Bank> = {};

    // Only include allowed fields
    if (updates.artist !== undefined) updateData.artist = updates.artist;
    if (updates.rtf_filename !== undefined)
      updateData.rtf_filename = updates.rtf_filename;
    if (updates.scanned_at !== undefined)
      updateData.scanned_at = updates.scanned_at;

    if (Object.keys(updateData).length === 0) {
      return; // Nothing to update
    }

    const before =
      source === "edit" && updateData.artist !== undefined
        ? db
            .select({ artist: banks.artist })
            .from(banks)
            .where(eq(banks.letter, bankLetter))
            .get()
        : undefined;

    const result = db
      .update(banks)
      .set(updateData)
      .where(eq(banks.letter, bankLetter))
      .run();

    if (result.changes === 0) {
      throw new Error(`Bank '${bankLetter}' not found`);
    }

    if (before && (before.artist || null) !== (updateData.artist || null)) {
      flagBankKitsModified(db, bankLetter);
    }
  });
}

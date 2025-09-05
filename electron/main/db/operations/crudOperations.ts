import type { Bank, DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { eq } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";

// Re-export operations from extracted modules
export {
  addKit,
  getFavoriteKits,
  getFavoriteKitsCount,
  getKit,
  getKits,
  getKitsMetadata,
  markKitAsModified,
  markKitAsSynced,
  markKitsAsSynced,
  toggleKitFavorite,
  updateKit,
} from "./kitCrudOperations.js";

export {
  addSample,
  buildDeleteConditions,
  deleteSamples,
  deleteSamplesWithoutReindexing,
  getAllSamples,
  getKitSamples,
  getSamplesToDelete,
  updateSampleMetadata,
} from "./sampleCrudOperations.js";

export { updateVoiceAlias } from "./voiceCrudOperations.js";

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
 * Update bank information
 */
export function updateBank(
  dbDir: string,
  bankLetter: string,
  updates: Partial<Bank>,
): DbResult<void> {
  return withDb(dbDir, (db) => {
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

    const result = db
      .update(banks)
      .set(updateData)
      .where(eq(banks.letter, bankLetter))
      .run();

    if (result.changes === 0) {
      throw new Error(`Bank '${bankLetter}' not found`);
    }
  });
}

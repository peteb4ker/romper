import type {
  DbResult,
  KitWithRelations,
  NewKit,
  NewSample,
  Sample,
} from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
// Basic CRUD operations for database entities
import { and, count, eq, inArray } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";
import { performVoiceReindexing } from "./sampleManagementOps.js";

const { banks, kits, samples, voices } = schema;

/**
 * Add a new kit to the database with default voices
 */
export function addKit(dbDir: string, kit: NewKit): DbResult<void> {
  return withDb(dbDir, (db) => {
    // Insert kit directly
    db.insert(kits).values(kit).run();

    // Create the 4 voices
    db.insert(voices)
      .values(
        Array.from({ length: 4 }, (_, i) => ({
          kit_name: kit.name,
          voice_alias: null,
          voice_number: i + 1,
        })),
      )
      .run();
  });
}

/**
 * Add a new sample to the database
 */
export function addSample(
  dbDir: string,
  sample: NewSample,
): DbResult<{ sampleId: number }> {
  return withDb(dbDir, (db) => {
    const result = db
      .insert(samples)
      .values(sample)
      .returning({ id: samples.id })
      .get();
    if (!result) {
      throw new Error("Failed to insert sample record");
    }
    return { sampleId: result.id };
  });
}

/**
 * Helper function to build delete conditions for samples
 */
export function buildDeleteConditions(
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
) {
  let conditions = [eq(samples.kit_name, kitName)];

  if (filter?.voiceNumber !== undefined) {
    conditions.push(eq(samples.voice_number, filter.voiceNumber));
  }

  if (filter?.slotNumber !== undefined) {
    // Database stores 0-11 slot indices directly
    conditions.push(eq(samples.slot_number, filter.slotNumber));
  }

  return and(...conditions);
}

/**
 * Delete samples with automatic voice reindexing
 */
export function deleteSamples(
  dbDir: string,
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }> {
  return withDb(dbDir, (db) => {
    const whereCondition = buildDeleteConditions(kitName, filter);
    const samplesToDelete = getSamplesToDelete(db, whereCondition);

    // Delete the samples
    db.delete(samples).where(whereCondition).run();

    const affectedSamples = performVoiceReindexing(
      dbDir,
      kitName,
      samplesToDelete,
    );

    return {
      affectedSamples,
      deletedSamples: samplesToDelete,
    };
  });
}

/**
 * Delete samples without automatic reindexing (for manual control)
 */
export function deleteSamplesWithoutReindexing(
  dbDir: string,
  kitName: string,
  filter?: { slotNumber?: number; voiceNumber?: number },
): DbResult<{ deletedSamples: Sample[] }> {
  return withDb(dbDir, (db) => {
    const whereCondition = buildDeleteConditions(kitName, filter);
    const samplesToDelete = getSamplesToDelete(db, whereCondition);

    // Delete the samples without reindexing
    db.delete(samples).where(whereCondition).run();

    return {
      deletedSamples: samplesToDelete,
    };
  });
}

/**
 * Get all banks from the database
 */
export function getAllBanks(dbDir: string): DbResult<any[]> {
  return withDb(dbDir, (db) => db.select().from(banks).all());
}

/**
 * Get all samples from the database
 */
export function getAllSamples(dbDir: string): DbResult<any[]> {
  return withDb(dbDir, (db) => db.select().from(samples).all());
}

/**
 * Get favorite kits with their relations
 */
export function getFavoriteKits(dbDir: string): DbResult<KitWithRelations[]> {
  return withDb(dbDir, (db) => {
    const favoriteKits = db
      .select()
      .from(kits)
      .where(eq(kits.is_favorite, true))
      .all();

    const kitsWithRelations = favoriteKits.map((kit: any) => ({
      ...kit,
      bank: null,
      samples: [],
      voices: [],
    }));

    return kitsWithRelations;
  });
}

/**
 * Get count of favorite kits
 */
export function getFavoriteKitsCount(dbDir: string): DbResult<number> {
  return withDb(dbDir, (db) => {
    // Use Drizzle's built-in count function
    const result = db
      .select({ count: count() })
      .from(kits)
      .where(eq(kits.is_favorite, true))
      .get();

    return result?.count ?? 0;
  });
}

/**
 * Get a specific kit by name with bank information
 */
export function getKit(
  dbDir: string,
  kitName: string,
): DbResult<KitWithRelations | null> {
  return withDb(dbDir, (db) => {
    const kit = db.select().from(kits).where(eq(kits.name, kitName)).get();

    if (!kit) {
      return null;
    }

    const bank = kit.bank_letter
      ? db.select().from(banks).where(eq(banks.letter, kit.bank_letter)).get()
      : null;

    // Load voices for this kit
    const kitVoices = db
      .select()
      .from(voices)
      .where(eq(voices.kit_name, kit.name))
      .orderBy(voices.voice_number)
      .all();

    // Load samples for this kit
    const kitSamples = db
      .select()
      .from(samples)
      .where(eq(samples.kit_name, kit.name))
      .orderBy(samples.voice_number, samples.slot_number)
      .all();

    return {
      ...kit,
      bank,
      samples: kitSamples,
      voices: kitVoices,
    };
  });
}

/**
 * Get all kits with their relations
 */
export function getKits(dbDir: string): DbResult<KitWithRelations[]> {
  return withDb(dbDir, (db) => {
    const allKits = db.select().from(kits).all();
    const kitsWithRelations = allKits.map((kit: any) => {
      // Load bank relation
      const bank = kit.bank_letter
        ? db.select().from(banks).where(eq(banks.letter, kit.bank_letter)).get()
        : null;

      // Load voices for this kit
      const kitVoices = db
        .select()
        .from(voices)
        .where(eq(voices.kit_name, kit.name))
        .orderBy(voices.voice_number)
        .all();

      // Load samples for this kit
      const kitSamples = db
        .select()
        .from(samples)
        .where(eq(samples.kit_name, kit.name))
        .orderBy(samples.voice_number, samples.slot_number)
        .all();

      return {
        ...kit,
        bank,
        samples: kitSamples,
        voices: kitVoices,
      };
    });

    return kitsWithRelations;
  });
}

/**
 * Get all samples for a specific kit
 */
export function getKitSamples(dbDir: string, kitName: string): DbResult<any[]> {
  return withDb(dbDir, (db) => {
    const result = db
      .select()
      .from(samples)
      .where(eq(samples.kit_name, kitName))
      .orderBy(samples.voice_number, samples.slot_number)
      .all();

    return result;
  });
}

/**
 * Helper function to get samples to delete
 */
export function getSamplesToDelete(db: any, whereCondition: any): Sample[] {
  return db.select().from(samples).where(whereCondition).all();
}

/**
 * Task 5.3.1: Mark kit as modified when sample operations are performed
 */
export function markKitAsModified(
  dbDir: string,
  kitName: string,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.update(kits)
      .set({
        modified_since_sync: true,
        updated_at: new Date().toISOString(),
      })
      .where(eq(kits.name, kitName))
      .run();
  });
}

/**
 * Task 8.3.2: Clear modified flag after successful sync
 */
export function markKitAsSynced(
  dbDir: string,
  kitName: string,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.update(kits)
      .set({ modified_since_sync: false })
      .where(eq(kits.name, kitName))
      .run();
  });
}

/**
 * Task 8.3.2: Clear modified flag for multiple kits after successful sync
 */
export function markKitsAsSynced(
  dbDir: string,
  kitNames: string[],
): DbResult<void> {
  return withDb(dbDir, (db) => {
    console.log(
      `[markKitsAsSynced] Attempting to mark ${kitNames.length} kits as synced:`,
      kitNames,
    );

    try {
      // Use single SQL UPDATE with WHERE IN for better performance
      const result = db
        .update(kits)
        .set({ modified_since_sync: false })
        .where(inArray(kits.name, kitNames))
        .run();

      console.log(
        `[markKitsAsSynced] Successfully updated ${result.changes}/${kitNames.length} kits`,
      );

      if (result.changes !== kitNames.length) {
        console.warn(
          `[markKitsAsSynced] Expected to update ${kitNames.length} kits but updated ${result.changes}`,
        );
      }
    } catch (error) {
      console.error(`[markKitsAsSynced] Failed to update kits:`, error);
      throw error; // Re-throw to fail the entire operation
    }
  });
}

/**
 * Task 20.1.1: Set kit favorite status
 */
export function setKitFavorite(
  dbDir: string,
  kitName: string,
  isFavorite: boolean,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    const result = db
      .update(kits)
      .set({
        is_favorite: isFavorite,
        updated_at: new Date().toISOString(),
      })
      .where(eq(kits.name, kitName))
      .run();

    if (result.changes === 0) {
      throw new Error(`Kit '${kitName}' not found`);
    }
  });
}

/**
 * Task 20.1.1: Toggle kit favorite status
 */
export function toggleKitFavorite(
  dbDir: string,
  kitName: string,
): DbResult<{ isFavorite: boolean }> {
  return withDb(dbDir, (db) => {
    // Get current favorite status
    const kit = db.select().from(kits).where(eq(kits.name, kitName)).get();

    if (!kit) {
      throw new Error(`Kit '${kitName}' not found`);
    }

    const newFavoriteStatus = !kit.is_favorite;

    // Update the favorite status
    db.update(kits)
      .set({
        is_favorite: newFavoriteStatus,
        updated_at: new Date().toISOString(),
      })
      .where(eq(kits.name, kitName))
      .run();

    return { isFavorite: newFavoriteStatus };
  });
}

/**
 * Update bank information
 */
export function updateBank(
  dbDir: string,
  bankLetter: string,
  updates: {
    artist?: string;
    rtf_filename?: string;
    scanned_at?: Date;
  },
): DbResult<void> {
  return withDb(dbDir, (db) => {
    const result = db
      .update(banks)
      .set({
        ...updates,
      })
      .where(eq(banks.letter, bankLetter))
      .run();

    if (result.changes === 0) {
      throw new Error(`Bank '${bankLetter}' not found`);
    }
  });
}

/**
 * Update kit information
 */
export function updateKit(
  dbDir: string,
  kitName: string,
  updates: {
    bank_letter?: string;
    bpm?: number;
    description?: string;
    editable?: boolean;
    is_favorite?: boolean;
    modified?: boolean;
    name?: string;
    step_pattern?: null | number[][];
  },
): DbResult<void> {
  return withDb(dbDir, (db) => {
    const result = db
      .update(kits)
      .set({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .where(eq(kits.name, kitName))
      .run();

    if (result.changes === 0) {
      throw new Error(`Kit '${kitName}' not found`);
    }
  });
}

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
    const result = db
      .update(voices)
      .set({
        updated_at: new Date().toISOString(),
        voice_alias: alias,
      })
      .where(
        and(eq(voices.kit_name, kitName), eq(voices.voice_number, voiceNumber)),
      )
      .run();

    if (result.changes === 0) {
      throw new Error(`Voice ${voiceNumber} for kit '${kitName}' not found`);
    }
  });
}

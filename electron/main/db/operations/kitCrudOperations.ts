import type {
  DbResult,
  Kit,
  KitWithRelations,
  NewKit,
} from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { eq } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";
import {
  combineKitWithRelations,
  createKitLookups,
  fetchKitRelatedData,
} from "./kitRelationalHelpers.js";

// Re-export operations from extracted modules
export {
  getFavoriteKits,
  getFavoriteKitsCount,
  toggleKitFavorite,
} from "./kitFavoritesOperations.js";

export {
  markKitAsModified,
  markKitAsSynced,
  markKitsAsSynced,
} from "./kitSyncOperations.js";

const { banks, kits, samples, voices } = schema;

/**
 * Add a new kit to the database with default voices
 */
export function addKit(dbDir: string, kit: NewKit): DbResult<void> {
  return withDb(dbDir, (db) => {
    // Insert kit directly
    db.insert(kits).values(kit).run();

    // Create the 4 voices
    const voiceData = Array.from({ length: 4 }, (_, i) => ({
      kit_name: kit.name,
      voice_alias: null,
      voice_number: i + 1,
    }));

    db.insert(voices).values(voiceData).run();
  });
}

/**
 * Get a single kit by name with its samples and voices
 * Uses efficient synchronous queries to avoid N+1 problem
 */
export function getKit(
  dbDir: string,
  kitName: string,
): DbResult<KitWithRelations | null> {
  return withDb(dbDir, (db) => {
    // Get the kit first
    const kit = db.select().from(kits).where(eq(kits.name, kitName)).get();

    if (!kit) {
      return null;
    }

    // Get related data using efficient synchronous queries
    const bank = kit.bank_letter
      ? db.select().from(banks).where(eq(banks.letter, kit.bank_letter)).get()
      : null;

    const kitVoices = db
      .select()
      .from(voices)
      .where(eq(voices.kit_name, kitName))
      .orderBy(voices.voice_number)
      .all();

    const kitSamples = db
      .select()
      .from(samples)
      .where(eq(samples.kit_name, kitName))
      .orderBy(samples.voice_number, samples.slot_number)
      .all();

    // Combine into relational structure
    const result: KitWithRelations = {
      ...kit,
      bank,
      samples: kitSamples,
      voices: kitVoices,
    };

    return result;
  });
}

/**
 * Get all kits with their samples and voices
 * Uses efficient manual batch queries to eliminate N+1 problem
 */
export function getKits(dbDir: string): DbResult<KitWithRelations[]> {
  return withDb(dbDir, (db) => {
    // Get all kits
    const allKits = db.select().from(kits).all();

    if (allKits.length === 0) {
      return [];
    }

    // Get all related data efficiently using helper functions
    const kitNames = allKits.map((k) => k.name);
    const relatedData = fetchKitRelatedData(db, kitNames);
    const lookups = createKitLookups(relatedData);

    // Combine into relational structure using helper function
    return allKits.map((kit) => combineKitWithRelations(kit, lookups));
  });
}

/**
 * Get metadata for all kits (name, bank_letter, etc. but no samples/voices)
 */
export function getKitsMetadata(dbDir: string): DbResult<Partial<Kit>[]> {
  return withDb(dbDir, (db) => {
    return db
      .select({
        alias: kits.alias,
        artist: kits.artist,
        bank_letter: kits.bank_letter,
        bpm: kits.bpm,
        editable: kits.editable,
        is_favorite: kits.is_favorite,
        locked: kits.locked,
        modified_since_sync: kits.modified_since_sync,
        name: kits.name,
        step_pattern: kits.step_pattern,
      })
      .from(kits)
      .all();
  });
}

/**
 * Update kit properties
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
      })
      .where(eq(kits.name, kitName))
      .run();

    if (result.changes === 0) {
      throw new Error(`Kit '${kitName}' not found`);
    }
  });
}

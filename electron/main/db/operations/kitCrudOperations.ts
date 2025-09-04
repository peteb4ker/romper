import type {
  DbResult,
  Kit,
  KitWithRelations,
  NewKit,
} from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { count, eq, inArray } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";

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
 * Get favorite kits with their related samples and voices
 * Uses efficient manual batch queries to eliminate N+1 problem
 */
export function getFavoriteKits(dbDir: string): DbResult<KitWithRelations[]> {
  return withDb(dbDir, (db) => {
    // Get favorite kits
    const favoriteKits = db
      .select()
      .from(kits)
      .where(eq(kits.is_favorite, true))
      .all();

    if (favoriteKits.length === 0) {
      return [];
    }

    // Get all related data efficiently for these kits
    const kitNames = favoriteKits.map((k) => k.name);

    const allBanks = db.select().from(banks).all();
    const allVoices = db
      .select()
      .from(voices)
      .where(inArray(voices.kit_name, kitNames))
      .orderBy(voices.voice_number)
      .all();
    const allSamples = db
      .select()
      .from(samples)
      .where(inArray(samples.kit_name, kitNames))
      .orderBy(samples.voice_number, samples.slot_number)
      .all();

    // Create lookups for efficient joining
    const bankLookup = new Map(allBanks.map((b) => [b.letter, b]));
    const voicesLookup = new Map<string, typeof allVoices>();
    const samplesLookup = new Map<string, typeof allSamples>();

    allVoices.forEach((v) => {
      if (!voicesLookup.has(v.kit_name)) voicesLookup.set(v.kit_name, []);
      voicesLookup.get(v.kit_name)!.push(v);
    });

    allSamples.forEach((s) => {
      if (!samplesLookup.has(s.kit_name)) samplesLookup.set(s.kit_name, []);
      samplesLookup.get(s.kit_name)!.push(s);
    });

    // Combine into relational structure
    return favoriteKits.map((kit) => ({
      ...kit,
      bank: kit.bank_letter ? bankLookup.get(kit.bank_letter) || null : null,
      samples: samplesLookup.get(kit.name) || [],
      voices: voicesLookup.get(kit.name) || [],
    }));
  });
}

/**
 * Get count of favorite kits
 */
export function getFavoriteKitsCount(dbDir: string): DbResult<number> {
  return withDb(dbDir, (db) => {
    const result = db
      .select({ count: count() })
      .from(kits)
      .where(eq(kits.is_favorite, true))
      .get();

    if (!result) {
      return 0;
    }

    return result.count || 0;
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

    // Get all related data efficiently for these kits
    const kitNames = allKits.map((k) => k.name);

    const allBanks = db.select().from(banks).all();
    const allVoices = db
      .select()
      .from(voices)
      .where(inArray(voices.kit_name, kitNames))
      .orderBy(voices.voice_number)
      .all();
    const allSamples = db
      .select()
      .from(samples)
      .where(inArray(samples.kit_name, kitNames))
      .orderBy(samples.voice_number, samples.slot_number)
      .all();

    // Create lookups for efficient joining
    const bankLookup = new Map(allBanks.map((b) => [b.letter, b]));
    const voicesLookup = new Map<string, typeof allVoices>();
    const samplesLookup = new Map<string, typeof allSamples>();

    allVoices.forEach((v) => {
      if (!voicesLookup.has(v.kit_name)) voicesLookup.set(v.kit_name, []);
      voicesLookup.get(v.kit_name)!.push(v);
    });

    allSamples.forEach((s) => {
      if (!samplesLookup.has(s.kit_name)) samplesLookup.set(s.kit_name, []);
      samplesLookup.get(s.kit_name)!.push(s);
    });

    // Combine into relational structure
    return allKits.map((kit) => ({
      ...kit,
      bank: kit.bank_letter ? bankLookup.get(kit.bank_letter) || null : null,
      samples: samplesLookup.get(kit.name) || [],
      voices: voicesLookup.get(kit.name) || [],
    }));
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
 * Mark a kit as modified (sets modified_since_sync = true)
 */
export function markKitAsModified(
  dbDir: string,
  kitName: string,
): DbResult<void> {
  return withDb(dbDir, (db) => {
    db.update(kits)
      .set({
        modified_since_sync: true,
      })
      .where(eq(kits.name, kitName))
      .run();
  });
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
  return withDb(dbDir, (db) => {
    console.log(
      `[markKitsAsSynced] Attempting to mark ${kitNames.length} kits as synced:`,
      kitNames,
    );

    if (kitNames.length === 0) {
      console.log("[markKitsAsSynced] Successfully updated 0/0 kits");
      return;
    }

    try {
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

      console.log(
        `[markKitsAsSynced] Successfully updated ${result.changes}/${kitNames.length} kits`,
      );
    } catch (error) {
      console.error("[markKitsAsSynced] Failed to update kits:", error);
      throw error;
    }
  });
}

/**
 * Toggle favorite status of a kit
 */
export function toggleKitFavorite(
  dbDir: string,
  kitName: string,
): DbResult<{ isFavorite: boolean }> {
  return withDb(dbDir, (db) => {
    // First get current state
    const currentKit = db
      .select({ is_favorite: kits.is_favorite })
      .from(kits)
      .where(eq(kits.name, kitName))
      .get();

    if (!currentKit) {
      throw new Error(`Kit '${kitName}' not found`);
    }

    const newFavoriteState = !currentKit.is_favorite;

    // Update the kit
    db.update(kits)
      .set({ is_favorite: newFavoriteState })
      .where(eq(kits.name, kitName))
      .run();

    return { isFavorite: newFavoriteState };
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

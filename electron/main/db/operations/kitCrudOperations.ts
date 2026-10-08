import type {
  DbResult,
  Kit,
  KitWithRelations,
  NewKit,
} from "@romper/shared/db/schema.js";
import type { SliceStep } from "@romper/shared/sliceTypes.js";

import * as schema from "@romper/shared/db/schema.js";
import { isKitQuarantined } from "@romper/shared/stereoLinkRules.js";
import { eq } from "drizzle-orm";

import {
  type RomperDb,
  withDb,
  withDbTransaction,
} from "../utils/dbUtilities.js";
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
  getSyncPlanData,
  markAllKitsAsSyncedExcept,
  markAllKitsAsSyncedExceptTx,
  markKitAsModified,
  markKitAsSynced,
  markKitsAsSynced,
  markKitsAsSyncedTx,
} from "./kitSyncOperations.js";

const { banks, kits, samples, voices } = schema;

/**
 * Add a new kit with its four voices, in one transaction (RE-28)
 */
export function addKit(dbDir: string, kit: NewKit): DbResult<void> {
  return withDbTransaction(dbDir, (db) => addKitTx(db, kit));
}

/** Insert a kit and its four voices on the caller's transaction */
export function addKitTx(db: RomperDb, kit: NewKit): void {
  db.insert(kits).values(kit).run();
  db.insert(voices)
    .values(
      Array.from({ length: 4 }, (_, i) => ({
        kit_name: kit.name,
        stereo_mode: false, // Default to mono mode
        voice_alias: null,
        voice_number: i + 1,
      })),
    )
    .run();
}

/**
 * Copy a kit and all its child records (voices, samples) atomically.
 *
 * Copies every user-editable field — bpm, trigger_conditions, step_pattern,
 * voice aliases/volumes/modes, per-sample gain and full WAV metadata — and
 * resets the lifecycle flags (editable on, locked/favorite/synced off).
 * Runs in a single transaction so a mid-copy failure leaves no partial kit.
 */
export function copyKit(
  dbDir: string,
  sourceKitName: string,
  destKitName: string,
): DbResult<void> {
  return withDbTransaction(dbDir, (db) => {
    const source = db
      .select()
      .from(kits)
      .where(eq(kits.name, sourceKitName))
      .get();
    if (!source) {
      throw new Error("Source kit does not exist.");
    }

    const existing = db
      .select()
      .from(kits)
      .where(eq(kits.name, destKitName))
      .get();
    if (existing) {
      throw new Error("Destination kit already exists.");
    }

    db.insert(kits)
      .values({
        ...source,
        bank_letter: destKitName.charAt(0),
        editable: true, // Duplicated kits are editable by default
        is_favorite: false,
        locked: false,
        // The copy isn't on the card yet: the next write adds it (RE-35)
        modified_since_sync: true,
        name: destKitName,
      })
      .run();

    const sourceVoices = db
      .select()
      .from(voices)
      .where(eq(voices.kit_name, sourceKitName))
      .orderBy(voices.voice_number)
      .all();
    // Strip the autoincrement id and retarget the kit; everything else is
    // copied wholesale so new columns are picked up automatically.
    const cloneForDest = <T extends { id: number }>(row: T) => {
      const rest: { id?: number } & Omit<T, "id"> = { ...row };
      delete rest.id;
      return { ...rest, kit_name: destKitName };
    };

    const voiceRows =
      sourceVoices.length > 0
        ? sourceVoices.map(cloneForDest)
        : Array.from({ length: 4 }, (_, i) => ({
            kit_name: destKitName,
            stereo_mode: false,
            voice_alias: null,
            voice_number: i + 1,
          }));
    db.insert(voices).values(voiceRows).run();

    const sourceSamples = db
      .select()
      .from(samples)
      .where(eq(samples.kit_name, sourceKitName))
      .all();
    for (const sample of sourceSamples) {
      db.insert(samples).values(cloneForDest(sample)).run();
    }
  });
}

/**
 * Delete a kit and all its child records (samples, voices) atomically
 */
export function deleteKit(dbDir: string, kitName: string): DbResult<void> {
  return withDbTransaction(dbDir, (db) => {
    // Delete children first (no CASCADE rules)
    db.delete(samples).where(eq(samples.kit_name, kitName)).run();
    db.delete(voices).where(eq(voices.kit_name, kitName)).run();

    const result = db.delete(kits).where(eq(kits.name, kitName)).run();
    if (result.changes === 0) {
      throw new Error(`Kit '${kitName}' not found`);
    }
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
      // Rule 4 (#537): the kit editor shows it
      quarantined: isKitQuarantined(kitVoices, kitSamples),
      samples: kitSamples,
      voices: kitVoices,
    };

    return result;
  });
}

/**
 * Update kit properties
 */
/**
 * Get summary of what would be deleted for a kit (for confirmation dialog)
 */
export function getKitDeleteSummary(
  dbDir: string,
  kitName: string,
): DbResult<{
  kitName: string;
  locked: boolean;
  sampleCount: number;
  voiceCount: number;
}> {
  return withDb(dbDir, (db) => {
    const kit = db.select().from(kits).where(eq(kits.name, kitName)).get();
    if (!kit) {
      throw new Error(`Kit '${kitName}' not found`);
    }

    const voiceCount = db
      .select()
      .from(voices)
      .where(eq(voices.kit_name, kitName))
      .all().length;

    const sampleCount = db
      .select()
      .from(samples)
      .where(eq(samples.kit_name, kitName))
      .all().length;

    return {
      kitName: kit.name,
      locked: kit.locked,
      sampleCount,
      voiceCount,
    };
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
 * Update a kit's own fields. None of the fields callers change (the alias,
 * editable, BPM, steps, trigger conditions, slicer data) is written to the
 * card, so the kit isn't marked modified (#566).
 */
export function updateKit(
  dbDir: string,
  kitName: string,
  updates: {
    alias?: null | string;
    bank_letter?: string;
    bpm?: number;
    editable?: boolean;
    is_favorite?: boolean;
    name?: string;
    slice_steps?: (null | SliceStep)[][] | null;
    slicer_division?: number;
    step_pattern?: null | number[][];
    trigger_conditions?: (null | string)[][] | null;
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

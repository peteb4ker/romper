import type { DbResult, KitWithRelations } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { count, eq } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";
import {
  combineKitWithRelations,
  createKitLookups,
  fetchKitRelatedData,
} from "./kitRelationalHelpers.js";

const { kits } = schema;

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

    // Get all related data efficiently using helper functions
    const kitNames = favoriteKits.map((k) => k.name);
    const relatedData = fetchKitRelatedData(db, kitNames);
    const lookups = createKitLookups(relatedData);

    // Combine into relational structure using helper function
    return favoriteKits.map((kit) => combineKitWithRelations(kit, lookups));
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

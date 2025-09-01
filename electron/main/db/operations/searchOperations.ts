import type { DbResult } from "@romper/shared/db/schema.js";
import type {
  KitWithRelations,
  SearchParams,
} from "@romper/shared/db/types.js";

import * as schema from "@romper/shared/db/schema.js";

import { withDb } from "../utils/dbUtilities.js";

const { kits } = schema;

// Use shared SearchParams type
export type SearchKitsParams = SearchParams;

export interface SearchKitsResult {
  kits: KitWithRelations[];
  queryTime: number;
  totalCount: number;
}

/**
 * Get all kits from database for client-side filtering
 * Search filtering is now handled client-side for better performance
 */
// Simple function to get all kits - search filtering now done client-side
export function getAllKits(
  dbDir: string,
  limit: number = 1000,
): DbResult<SearchKitsResult> {
  const startTime = performance.now();

  return withDb(dbDir, (db) => {
    try {
      const allKits = db
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
        .orderBy(kits.name)
        .limit(limit);

      const results = allKits.all() as KitWithRelations[];
      const endTime = performance.now();
      const queryTime = Math.round(endTime - startTime);

      return {
        kits: results,
        queryTime,
        totalCount: results.length,
      };
    } catch (error) {
      const endTime = performance.now();
      const queryTime = Math.round(endTime - startTime);

      return {
        error: `Failed to load kits: ${error instanceof Error ? error.message : String(error)}`,
        kits: [],
        queryTime,
        totalCount: 0,
      };
    }
  });
}

// Legacy search function kept for backward compatibility during migration
// This now just calls getAllKits since search filtering is done client-side
export function searchKits(
  dbDir: string,
  params: SearchKitsParams,
): DbResult<SearchKitsResult> {
  return getAllKits(dbDir, params.limit || 100);
}

import type { DbResult, KitWithRelations } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, desc, eq, exists, ilike, or, sql } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";

const { banks, kits, samples } = schema;

export interface SearchKitsParams {
  limit?: number;
  query: string;
}

export interface SearchKitsResult {
  kits: KitWithRelations[];
  queryTime: number;
  totalCount: number;
}

/**
 * Search for kits across multiple fields with relevance scoring
 * Searches kit names, aliases, artist names, and sample filenames
 */
export function searchKits(
  dbDir: string,
  params: SearchKitsParams,
): DbResult<SearchKitsResult> {
  const startTime = performance.now();
  const { limit = 100, query } = params;

  // Minimum query length validation
  if (query.length < 2) {
    return {
      data: { kits: [], queryTime: 0, totalCount: 0 },
      success: true,
    };
  }

  return withDb(dbDir, (db) => {
    // Sanitize query for LIKE operations
    const sanitizedQuery = query.toLowerCase().replace(/[%_]/g, "\\$&");
    const likePattern = `%${sanitizedQuery}%`;
    const prefixPattern = `${sanitizedQuery}%`;

    try {
      const searchResults = db
        .select({
          alias: kits.alias,
          artist: kits.artist,
          bank_letter: kits.bank_letter,
          bpm: kits.bpm,
          editable: kits.editable,
          is_favorite: kits.is_favorite,
          locked: kits.locked,
          modified_since_sync: kits.modified_since_sync,
          // Kit data
          name: kits.name,
          // Relevance scoring for result ranking
          relevance_score: sql<number>`
            CASE 
              WHEN LOWER(${kits.name}) = ${sanitizedQuery} THEN 100
              WHEN LOWER(${kits.alias}) = ${sanitizedQuery} THEN 90
              WHEN LOWER(${banks.artist}) = ${sanitizedQuery} THEN 80
              WHEN LOWER(${kits.name}) LIKE ${prefixPattern} THEN 70
              WHEN LOWER(${kits.alias}) LIKE ${prefixPattern} THEN 60
              WHEN LOWER(${kits.name}) LIKE ${likePattern} THEN 50
              WHEN LOWER(${kits.alias}) LIKE ${likePattern} THEN 40
              WHEN LOWER(${banks.artist}) LIKE ${likePattern} THEN 30
              WHEN EXISTS(
                SELECT 1 FROM ${samples} s 
                WHERE s.kit_name = ${kits.name} 
                AND LOWER(s.filename) LIKE ${likePattern}
              ) THEN 20
              ELSE 0
            END
          `,
          step_pattern: kits.step_pattern,
        })
        .from(kits)
        .leftJoin(banks, eq(kits.bank_letter, banks.letter))
        .where(
          or(
            ilike(kits.name, likePattern),
            ilike(kits.alias, likePattern),
            ilike(banks.artist, likePattern),
            exists(
              db
                .select()
                .from(samples)
                .where(
                  and(
                    eq(samples.kit_name, kits.name),
                    ilike(samples.filename, likePattern),
                  ),
                ),
            ),
          ),
        )
        .orderBy(desc(sql`relevance_score`), kits.name)
        .limit(limit);

      const results = searchResults.all() as ({
        relevance_score: number;
      } & KitWithRelations)[];

      // Remove relevance_score from final results (it's only for ordering)
      const cleanResults: KitWithRelations[] = results.map(
        ({ relevance_score: _relevance_score, ...kit }) => kit,
      );

      const endTime = performance.now();
      const queryTime = Math.round(endTime - startTime);

      return {
        kits: cleanResults,
        queryTime,
        totalCount: cleanResults.length,
      };
    } catch (error) {
      const endTime = performance.now();
      const queryTime = Math.round(endTime - startTime);

      return {
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
        kits: [],
        queryTime,
        totalCount: 0,
      };
    }
  });
}

/**
 * Multi-term search with AND logic
 * Splits query by spaces and requires all terms to match
 */
export function searchKitsMultiTerm(
  dbDir: string,
  params: SearchKitsParams,
): DbResult<SearchKitsResult> {
  const { query } = params;

  // Split query into terms and filter out empty strings
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  if (terms.length === 0 || terms.some((term) => term.length < 2)) {
    return {
      data: { kits: [], queryTime: 0, totalCount: 0 },
      success: true,
    };
  }

  if (terms.length === 1) {
    // Single term - use regular search
    return searchKits(dbDir, params);
  }

  const startTime = performance.now();

  return withDb(dbDir, (db) => {
    try {
      // Build WHERE conditions for each term (AND logic)
      const termConditions = terms.map((term) => {
        const likePattern = `%${term.replace(/[%_]/g, "\\$&")}%`;

        return or(
          ilike(kits.name, likePattern),
          ilike(kits.alias, likePattern),
          ilike(banks.artist, likePattern),
          exists(
            db
              .select()
              .from(samples)
              .where(
                and(
                  eq(samples.kit_name, kits.name),
                  ilike(samples.filename, likePattern),
                ),
              ),
          ),
        );
      });

      const searchResults = db
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
          // Simplified relevance for multi-term
          relevance_score: sql<number>`
            (CASE WHEN LOWER(${kits.name}) LIKE ${"%" + terms[0] + "%"} THEN 10 ELSE 0 END +
             CASE WHEN LOWER(${kits.alias}) LIKE ${"%" + terms[0] + "%"} THEN 8 ELSE 0 END +
             CASE WHEN LOWER(${banks.artist}) LIKE ${"%" + terms[0] + "%"} THEN 6 ELSE 0 END)
          `,
          step_pattern: kits.step_pattern,
        })
        .from(kits)
        .leftJoin(banks, eq(kits.bank_letter, banks.letter))
        .where(and(...termConditions))
        .orderBy(desc(sql`relevance_score`), kits.name)
        .limit(params.limit || 100);

      const results = searchResults.all() as ({
        relevance_score: number;
      } & KitWithRelations)[];

      const cleanResults: KitWithRelations[] = results.map(
        ({ relevance_score: _relevance_score, ...kit }) => kit,
      );

      const endTime = performance.now();
      const queryTime = Math.round(endTime - startTime);

      return {
        kits: cleanResults,
        queryTime,
        totalCount: cleanResults.length,
      };
    } catch (error) {
      const endTime = performance.now();
      const queryTime = Math.round(endTime - startTime);

      return {
        error: `Multi-term search failed: ${error instanceof Error ? error.message : String(error)}`,
        kits: [],
        queryTime,
        totalCount: 0,
      };
    }
  });
}

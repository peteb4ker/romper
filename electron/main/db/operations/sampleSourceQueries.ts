import type { DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { and, eq, inArray, sql } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";

const { samples } = schema;

/**
 * The source file of the sample in one slot, or null for an empty slot.
 * One row by the slot's unique index, rather than the whole kit (RE-83).
 */
export function getSlotSourcePath(
  dbDir: string,
  kitName: string,
  voiceNumber: number,
  slotNumber: number,
): DbResult<null | string> {
  return withDb(
    dbDir,
    (db) =>
      db
        .select({ sourcePath: samples.source_path })
        .from(samples)
        .where(
          and(
            eq(samples.kit_name, kitName),
            eq(samples.voice_number, voiceNumber),
            eq(samples.slot_number, slotNumber),
          ),
        )
        .get()?.sourcePath ?? null,
  );
}

/**
 * Whether any sample's source file is one of `sourcePaths`: a
 * `SELECT 1 ... LIMIT 1` that stops at the first match and returns no rows
 * to JavaScript, so the path check that falls back to it doesn't load the
 * whole samples table (RE-85).
 */
export function isSourcePathReferenced(
  dbDir: string,
  sourcePaths: readonly string[],
): DbResult<boolean> {
  if (sourcePaths.length === 0) return { data: false, success: true };
  return withDb(
    dbDir,
    (db) =>
      db
        .select({ found: sql<number>`1` })
        .from(samples)
        .where(inArray(samples.source_path, [...sourcePaths]))
        .limit(1)
        .get() !== undefined,
  );
}

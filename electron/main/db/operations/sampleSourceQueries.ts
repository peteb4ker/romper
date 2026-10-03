import type { DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { inArray, sql } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";

const { samples } = schema;

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

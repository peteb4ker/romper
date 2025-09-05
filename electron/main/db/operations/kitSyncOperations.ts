import type { DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { eq, inArray } from "drizzle-orm";

import { withDb } from "../utils/dbUtilities.js";

const { kits } = schema;

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

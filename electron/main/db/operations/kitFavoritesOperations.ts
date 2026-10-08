import type { DbResult } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { eq } from "drizzle-orm";

import { withDbTransaction } from "../utils/dbUtilities.js";

const { kits } = schema;

/**
 * Toggle favorite status of a kit
 */
export function toggleKitFavorite(
  dbDir: string,
  kitName: string,
): DbResult<{ isFavorite: boolean }> {
  return withDbTransaction(dbDir, (db) => {
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

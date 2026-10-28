import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import * as schema from "@romper/shared/db/schema.js";
import { compareKitSlots } from "@romper/shared/kitUtilsShared.js";
import { eq } from "drizzle-orm";

import { type RomperDb, withDb } from "../utils/dbUtilities.js";

const { kits, samples, voices } = schema;

/** A kit's voices and sample rows, as the store check reads them (#812) */
export interface KitRowsToCheck {
  /** Whether the kit is editable; a read-only kit's folder is checked too (#820) */
  editable: boolean;
  samples: Sample[];
  voices: (typeof voices.$inferSelect)[];
}

/** Every kit's name in slot order (A0, A1, ... B0), for the store check (#812) */
export function getKitNamesForCheck(dbDir: string): DbResult<string[]> {
  return withDb(dbDir, (db) =>
    db
      .select({ name: kits.name })
      .from(kits)
      .all()
      .map(({ name }) => name)
      .sort(compareKitSlots),
  );
}

/**
 * One kit's flag, voices and sample rows (three indexed queries) on the caller's
 * handle, so the store check reads what it checks and what it found in the
 * same transaction (#812)
 */
export function readKitRowsToCheck(
  db: RomperDb,
  kitName: string,
): KitRowsToCheck {
  const kit = db
    .select({ editable: kits.editable })
    .from(kits)
    .where(eq(kits.name, kitName))
    .get();
  return {
    // A kit deleted meanwhile has no folder to check
    editable: kit?.editable ?? true,
    samples: db
      .select()
      .from(samples)
      .where(eq(samples.kit_name, kitName))
      .all(),
    voices: db.select().from(voices).where(eq(voices.kit_name, kitName)).all(),
  };
}

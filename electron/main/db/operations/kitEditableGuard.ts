import * as schema from "@romper/shared/db/schema.js";
import { eq, inArray } from "drizzle-orm";

import type { RomperDb } from "../utils/dbUtilities.js";

const { kits } = schema;

/**
 * Why main refused to change a kit that isn't editable (RE-71, #572). The
 * stereo-link refusal adds what to do about it.
 */
export function kitNotEditableError(kitName: string): string {
  return `Kit ${kitName} isn't editable.`;
}

/**
 * Throw unless each kit exists and is editable, on the caller's
 * transaction, so the edit that follows is rolled back with it (#572).
 * Main refuses the edits the kit editor refuses on a read-only kit:
 * adding, moving and deleting samples, undoing those, gain and
 * voice names. Sequencer settings work on a read-only kit and don't call
 * this. One query, however many kits. Removing missing samples is the one
 * exception (`requireKitForMissingSampleRemovalTx`, D5).
 */
export function requireEditableKitTx(
  db: RomperDb,
  ...kitNames: string[]
): void {
  const rows = db
    .select({ editable: kits.editable, name: kits.name })
    .from(kits)
    .where(inArray(kits.name, kitNames))
    .all();
  for (const kitName of kitNames) {
    const kit = rows.find((row) => row.name === kitName);
    if (!kit) throw new Error(`Kit ${kitName} not found`);
    if (!kit.editable) throw new Error(kitNotEditableError(kitName));
  }
}

/**
 * The one exception to `requireEditableKitTx` (D5 of
 * docs/developer/store-check.md, #822): removing a kit's missing samples,
 * and putting them back on undo, are allowed on a read-only kit. A sample
 * whose file is gone can't be played or written, and an imported kit is
 * read-only, so without this its missing samples could never go. Only the
 * two operations in `missingSampleOperations.ts` call this; every other
 * sample edit still calls `requireEditableKitTx`. Throws unless the kit
 * exists, on the caller's transaction.
 */
export function requireKitForMissingSampleRemovalTx(
  db: RomperDb,
  kitName: string,
): void {
  const kit = db
    .select({ name: kits.name })
    .from(kits)
    .where(eq(kits.name, kitName))
    .get();
  if (!kit) throw new Error(`Kit ${kitName} not found`);
}

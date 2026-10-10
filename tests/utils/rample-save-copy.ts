/**
 * A copy of the card's `_save` folder in a local store
 * (`.romperdb/rample-save/<date-time>-<reason>/`), as stage 2 of #786
 * names them,
 * for the e2e specs and the manual's screenshots of the kit editor's "On
 * the Rample" section (#800). The files are synthetic (built by the codec's
 * encoder), matching what a Rample on firmware 2.00 writes.
 */
import type { RampleRawValue } from "@romper/shared/rampleSave";

import fs from "fs-extra";
import path from "node:path";

import { encodeCbor } from "../../electron/main/rample/cbor";
import { RAMPLE_SAVE_BACKUP_FOLDER } from "../../electron/main/rample/rampleSaveBackup";
import {
  syntheticGlobalAssign,
  syntheticKitSave,
  syntheticSettings,
} from "../factories/rampleSave.factory";

/** The copy's folder name, and so when it was taken */
export const RAMPLE_SAVE_COPY_NAME = "2026-10-09T04-12-58-000Z-setup";

/**
 * Write a copy holding `<kit>.rpl` for each kit given (with its overrides
 * of the synthetic kit file's keys), plus settings.rpl and
 * global_assign.rpl. Returns the copy's folder.
 */
export async function seedRampleSaveCopy(
  localStorePath: string,
  kits: Record<string, Record<string, RampleRawValue>>,
): Promise<string> {
  const copy = path.join(
    localStorePath,
    ".romperdb",
    RAMPLE_SAVE_BACKUP_FOLDER,
    RAMPLE_SAVE_COPY_NAME,
  );
  await fs.ensureDir(copy);
  for (const [kitName, overrides] of Object.entries(kits)) {
    await fs.writeFile(
      path.join(copy, `${kitName}.rpl`),
      encodeCbor(syntheticKitSave(overrides)),
    );
  }
  await fs.writeFile(
    path.join(copy, "settings.rpl"),
    encodeCbor(syntheticSettings()),
  );
  await fs.writeFile(
    path.join(copy, "global_assign.rpl"),
    encodeCbor(syntheticGlobalAssign()),
  );
  return copy;
}

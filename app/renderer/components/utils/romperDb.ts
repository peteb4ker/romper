// The setup wizard's database calls: create the new store's database and
// import its kit folders and bank names. Main does the work (RE-34, #564,
// #567).

import type { KitScanResult } from "@romper/shared/db/schema.js";
import type { RampleSaveBackupResult } from "@romper/shared/rampleSave.js";

import { createLogger } from "../../utils/logger";

const log = createLogger("Renderer");

/**
 * Keep a copy of the card's `_save` folder in the store setup is creating
 * (#786, stage 2). Main reads the card and logs what it did. Never throws:
 * a copy that fails mustn't stop setup, so a failure comes back as
 * `status: "failed"`.
 */
export async function backupSetupRampleSave(
  dbDir: string,
  cardPath: string,
): Promise<RampleSaveBackupResult> {
  try {
    if (!globalThis.electronAPI?.setupBackupRampleSave) {
      throw new Error("IPC not available");
    }
    const result = await globalThis.electronAPI.setupBackupRampleSave(
      dbDir,
      cardPath,
    );
    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to copy the card's _save folder");
    }
    return result.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn("Couldn't copy the card's _save folder:", message);
    return { cardNotResponding: false, error: message, status: "failed" };
  }
}

export async function createRomperDb(dbDir: string) {
  if (!globalThis.electronAPI?.createRomperDb) {
    log.error("Romper DB creation not available");
    throw new Error("Romper DB creation not available");
  }
  const result = await globalThis.electronAPI.createRomperDb(dbDir);
  if (!result.success) {
    log.error("Failed to create Romper DB:", result.error);
    throw new Error(result.error || "Failed to create Romper DB");
  }
  log.info("Romper DB created at:", result.dbPath);
  return result.dbPath;
}

/**
 * Import the bank names in `sourcePath` into the store setup is creating:
 * the card setup is copying from (#564), or the store the factory archive
 * was extracted into (#567). Main reads the folder's
 * `<letter> - <name>.rtf` files.
 */
export async function importSetupBankNames(
  dbDir: string,
  sourcePath: string,
): Promise<number> {
  if (!globalThis.electronAPI?.setupImportBankNames) {
    throw new Error("IPC not available");
  }
  const result = await globalThis.electronAPI.setupImportBankNames(
    dbDir,
    sourcePath,
  );
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to import the card's bank names");
  }
  return result.data.importedBanks;
}

/**
 * Import one kit folder into the store setup is creating. Main adds the
 * kit, its samples (12 per voice), WAV metadata and voice names (RE-34).
 */
export async function importSetupKit(
  dbDir: string,
  kitName: string,
): Promise<KitScanResult> {
  if (!globalThis.electronAPI?.setupImportKit) {
    throw new Error("IPC not available");
  }
  const result = await globalThis.electronAPI.setupImportKit(dbDir, kitName);
  if (!result.success || !result.data) {
    throw new Error(result.error || `Failed to import kit ${kitName}`);
  }
  return result.data;
}

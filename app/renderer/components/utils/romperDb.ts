// The setup wizard's database calls: create the new store's database and
// import its kit folders and the card's bank names. Main does the work
// (RE-34, #564).

import type { KitScanResult } from "@romper/shared/db/schema.js";

import { createLogger } from "../../utils/logger";

const log = createLogger("Renderer");

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
 * Import the bank names at the root of the card setup is copying from into
 * the store setup is creating (#564). Main reads the card's
 * `<letter> - <name>.rtf` files.
 */
export async function importSetupBankNames(
  dbDir: string,
  cardPath: string,
): Promise<number> {
  if (!globalThis.electronAPI?.setupImportBankNames) {
    throw new Error("IPC not available");
  }
  const result = await globalThis.electronAPI.setupImportBankNames(
    dbDir,
    cardPath,
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

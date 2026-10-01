import type { DbResult, KitScanResult } from "@romper/shared/db/schema.js";

import {
  groupSamplesByVoice,
  isValidKit,
} from "@romper/shared/kitUtilsShared.js";
import * as fs from "node:fs";
import * as path from "node:path";

import { mergeKitScan } from "../db/operations/kitScanOperations.js";
import {
  addKit,
  createRomperDbFile,
  markKitsAsSynced,
} from "../db/romperDbCoreORM.js";
import { logger } from "../utils/logger.js";
import { readWavMetadata } from "./scanService.js";

const ROMPER_DB_DIR = ".romperdb";

export const EXISTING_LOCAL_STORE_MESSAGE =
  'This folder already contains a Romper local store (.romperdb). Setting up here would overwrite it. To open that store, use "Choose Existing Store"; to create a new store, choose a different folder.';

/**
 * Guards the first-run setup wizard's database lifecycle (RE-10).
 *
 * Setup must never touch a local store it did not create:
 * - a target folder that already holds a store is refused before anything
 *   is written;
 * - the main process records every `.romperdb` directory that setup creates,
 *   and cleanup after a failed setup acts only on those. The renderer passes
 *   a target path, but cannot make main touch a store this process did not
 *   create.
 *
 * Cleanup renames the failed database aside (`.romperdb.failed-<timestamp>`)
 * rather than deleting it, so even a bookkeeping bug cannot destroy data. A
 * retry still starts fresh because `.romperdb` is gone.
 *
 * A setup that never finished (the app quit mid-import, for example after
 * Cancel on first run) is cleaned up on quit (RE-66), so the next launch can
 * set up the same folder. Saving the store as the local store marks its
 * setup finished.
 */
export class LocalStoreSetupService {
  private readonly createdDbDirs = new Set<string>();

  /**
   * Move a `.romperdb` created by this process's setup out of the way after
   * the setup failed. Refuses anything setup did not create, and the store
   * currently configured as the local store.
   */
  cleanupFailedSetup(
    targetPath: string,
    configuredLocalStorePath?: null | string,
  ): { error?: string; movedTo?: string; removed: boolean } {
    const dbDir = path.resolve(targetPath, ROMPER_DB_DIR);

    if (!this.createdDbDirs.has(dbDir)) {
      console.warn(
        `[Setup] Refusing to clean up ${dbDir}: this setup did not create it`,
      );
      return {
        error:
          "Refusing to clean up a local store that this setup did not create",
        removed: false,
      };
    }

    if (
      configuredLocalStorePath &&
      path.resolve(configuredLocalStorePath) === path.resolve(targetPath)
    ) {
      return {
        error: "Refusing to clean up the configured local store",
        removed: false,
      };
    }

    this.createdDbDirs.delete(dbDir);

    try {
      if (!fs.existsSync(dbDir)) {
        return { removed: true };
      }
      const movedTo = `${dbDir}.failed-${Date.now()}`;
      fs.renameSync(dbDir, movedTo);
      logger.log(`[Setup] Moved failed setup database aside to ${movedTo}`);
      return { movedTo, removed: true };
    } catch (error) {
      return {
        error: `Failed to clean up the partial local store: ${error instanceof Error ? error.message : String(error)}`,
        removed: false,
      };
    }
  }

  /**
   * Clean up every store this process's setup created and never finished,
   * except the configured local store. Runs when the app quits.
   */
  cleanupUnfinishedSetups(configuredLocalStorePath?: null | string): Array<{
    error?: string;
    movedTo?: string;
    removed: boolean;
    targetPath: string;
  }> {
    const configured = configuredLocalStorePath
      ? path.resolve(configuredLocalStorePath)
      : null;
    return [...this.createdDbDirs]
      .map((dbDir) => path.dirname(dbDir))
      .filter((targetPath) => targetPath !== configured)
      .map((targetPath) => ({
        ...this.cleanupFailedSetup(targetPath, configuredLocalStorePath),
        targetPath,
      }));
  }

  /**
   * Create the database for a new local store. Refuses a directory that
   * already holds anything, and records the directory so a failed setup can
   * clean it up.
   */
  createSetupDatabase(dbDir: string): {
    dbPath?: string;
    error?: string;
    success: boolean;
  } {
    const resolved = path.resolve(dbDir);
    if (!isEmptyOrMissingDirectory(resolved)) {
      // Whatever is there is not ours; never let a later cleanup touch it
      this.createdDbDirs.delete(resolved);
      return { error: EXISTING_LOCAL_STORE_MESSAGE, success: false };
    }
    // Record before creating so a half-created database is still cleanable
    this.createdDbDirs.add(resolved);
    return createRomperDbFile(resolved);
  }

  /**
   * Whether `targetPath` already contains a local store. An empty `.romperdb`
   * directory holds no data and does not count.
   */
  hasExistingLocalStore(targetPath: string): {
    error?: string;
    exists: boolean;
  } {
    const dbDir = path.resolve(targetPath, ROMPER_DB_DIR);
    if (isEmptyOrMissingDirectory(dbDir)) {
      return { exists: false };
    }
    return { error: EXISTING_LOCAL_STORE_MESSAGE, exists: true };
  }

  /**
   * Import one kit folder into the store this setup is creating (RE-34).
   *
   * The kit is added, then its folder is merged the way a rescan merges it
   * (`mergeKitScan`, one transaction): up to 12 samples per voice in card
   * order, WAV metadata, and voice names inferred from file names. Files
   * over the 12-per-voice limit come back as `voice_full` skips, which the
   * wizard reports. Like every imported kit, it starts with nothing to
   * write to the card ("modified since sync" off).
   *
   * Refuses any store this process's setup didn't create, and any name
   * that isn't a kit folder name, so the renderer can't point it elsewhere.
   */
  importSetupKit(dbDir: string, kitName: string): DbResult<KitScanResult> {
    const resolved = path.resolve(dbDir);
    if (!this.createdDbDirs.has(resolved)) {
      return {
        error: "Setup can only import kits into the store it is creating",
        success: false,
      };
    }
    if (!isValidKit(kitName)) {
      return { error: `Not a kit folder name: ${kitName}`, success: false };
    }

    const kitPath = path.join(path.dirname(resolved), kitName);
    let wavFiles: string[];
    try {
      wavFiles = fs
        .readdirSync(kitPath)
        .filter((file) => file.toLowerCase().endsWith(".wav"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        error: `Can't read kit folder ${kitPath}: ${message}`,
        success: false,
      };
    }

    const added = addKit(resolved, {
      bank_letter: kitName.charAt(0),
      editable: false,
      name: kitName,
    });
    if (!added.success) {
      return { error: added.error, success: false };
    }

    const merged = mergeKitScan(
      resolved,
      kitName,
      { filesByVoice: groupSamplesByVoice(wavFiles), kitPath },
      { fileExists: fs.existsSync, readMetadata: readWavMetadata },
    );
    if (!merged.success) {
      return merged;
    }

    // The merge flags kits it adds samples to as changed since the last
    // write, which is right for a rescan but not for a fresh import
    const cleared = markKitsAsSynced(resolved, [kitName]);
    if (!cleared.success) {
      return { error: cleared.error, success: false };
    }
    return merged;
  }

  /**
   * The store at `targetPath` is now the local store: its setup finished, so
   * nothing may clean it up any more.
   */
  markSetupComplete(targetPath: string): void {
    this.createdDbDirs.delete(path.resolve(targetPath, ROMPER_DB_DIR));
  }
}

// Anything we cannot inspect counts as occupied, so setup refuses it
function isEmptyOrMissingDirectory(dirPath: string): boolean {
  try {
    const stats = fs.lstatSync(dirPath);
    return stats.isDirectory() && fs.readdirSync(dirPath).length === 0;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
}

export const localStoreSetupService = new LocalStoreSetupService();

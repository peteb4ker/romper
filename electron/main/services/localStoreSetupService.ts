import type { DbResult, KitScanResult } from "@romper/shared/db/schema.js";

import {
  groupSamplesByVoice,
  isValidKit,
} from "@romper/shared/kitUtilsShared.js";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  addKitTx,
  closeDbConnection,
  createRomperDbFile,
  markKitsAsSyncedTx,
  mergeKitScanTx,
  withDbTransaction,
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
 *
 * Setup can be cancelled (RE-66): `cancelSetup` aborts the download or
 * extraction in progress, and the wizard stops between steps. Cleanup also
 * removes the kit folders this setup extracted or copied into the target
 * (only entries that weren't there before), so a retry starts clean.
 */
export class LocalStoreSetupService {
  /**
   * The signal for the setup work running now. `cancelSetup` aborts it;
   * work started afterwards gets a fresh one.
   */
  get setupSignal(): AbortSignal {
    return this.setupAbort.signal;
  }
  private readonly createdDbDirs = new Set<string>();
  /** Target folder → top-level entries this process's setup created in it */
  private readonly createdEntries = new Map<string, Set<string>>();

  private setupAbort = new AbortController();

  /** Stop the setup download or extraction in progress (RE-66). */
  cancelSetup(): void {
    this.setupAbort.abort(new SetupCancelledError());
    this.setupAbort = new AbortController();
  }

  /**
   * Move a `.romperdb` created by this process's setup out of the way after
   * the setup failed. Refuses anything setup did not create, and the store
   * currently configured as the local store.
   */
  cleanupFailedSetup(
    targetPath: string,
    configuredLocalStorePath?: null | string,
  ): {
    error?: string;
    movedTo?: string;
    removed: boolean;
    removedEntries?: number;
  } {
    const target = path.resolve(targetPath);
    const dbDir = path.join(target, ROMPER_DB_DIR);
    const createdDb = this.createdDbDirs.has(dbDir);
    const entries = this.createdEntries.get(target);

    if (!createdDb && !entries) {
      // Nothing of this setup's to remove: a no-op, not a problem (a setup
      // that failed before writing anything still asks)
      logger.log(
        `[Setup] Nothing to clean up in ${target}: this setup created nothing there`,
      );
      return {
        error:
          "Refusing to clean up a local store that this setup did not create",
        removed: false,
      };
    }

    if (
      configuredLocalStorePath &&
      path.resolve(configuredLocalStorePath) === target
    ) {
      return {
        error: "Refusing to clean up the configured local store",
        removed: false,
      };
    }

    this.createdDbDirs.delete(dbDir);
    this.createdEntries.delete(target);
    // An open database can't be renamed on Windows
    closeDbConnection(dbDir);

    try {
      // Kit folders this setup extracted or copied: they came from the
      // archive or the card, so they can simply be made again
      for (const entry of entries ?? []) {
        fs.rmSync(entry, { force: true, recursive: true });
      }
      const removed = entries ? { removedEntries: entries.size } : {};
      if (!createdDb || !fs.existsSync(dbDir)) {
        return { removed: true, ...removed };
      }
      const movedTo = `${dbDir}.failed-${Date.now()}`;
      fs.renameSync(dbDir, movedTo);
      logger.log(`[Setup] Moved failed setup database aside to ${movedTo}`);
      return { movedTo, removed: true, ...removed };
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
    const targets = new Set([
      ...[...this.createdDbDirs].map((dbDir) => path.dirname(dbDir)),
      ...this.createdEntries.keys(),
    ]);
    return [...targets]
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
   * (`mergeKitScan`), all in one transaction: up to 12 samples per voice in card
   * order, WAV metadata, voice names inferred from file names, and stereo
   * pairs for voices holding stereo samples where they can be linked
   * (`stereo.autoLinks` says which, #537 stereo rule 2). Files
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

    // The kit, its voices and samples go in together, or not at all (RE-28)
    return withDbTransaction(resolved, (db) => {
      addKitTx(db, {
        bank_letter: kitName.charAt(0),
        editable: false,
        name: kitName,
      });
      const merged = mergeKitScanTx(
        db,
        kitName,
        { filesByVoice: groupSamplesByVoice(wavFiles), kitPath },
        { fileExists: fs.existsSync, readMetadata: readWavMetadata },
        // Link stereo voices automatically, by stereo rule 2 (#537)
        { linkStereoVoices: true },
      );
      // The merge flags kits it adds samples to as changed since the last
      // write, which is right for a rescan but not for a fresh import
      markKitsAsSyncedTx(db, [kitName]);
      return merged;
    });
  }

  /**
   * The store at `targetPath` is now the local store: its setup finished, so
   * nothing may clean it up any more.
   */
  markSetupComplete(targetPath: string): void {
    this.createdDbDirs.delete(path.resolve(targetPath, ROMPER_DB_DIR));
    this.createdEntries.delete(path.resolve(targetPath));
  }

  /**
   * Run setup work that writes into `targetPath` (extracting the archive,
   * copying a kit from the card) and record the top-level entries it
   * created, even when it fails part way, so cleanup can remove them.
   * Entries that were there before are never recorded.
   */
  async trackCreatedEntries<T>(
    targetPath: string,
    work: () => Promise<T> | T,
  ): Promise<T> {
    const target = path.resolve(targetPath);
    const before = new Set(listEntries(target));
    try {
      return await work();
    } finally {
      const created = listEntries(target).filter((name) => !before.has(name));
      if (created.length > 0) {
        const record = this.createdEntries.get(target) ?? new Set<string>();
        for (const name of created) record.add(path.join(target, name));
        this.createdEntries.set(target, record);
      }
    }
  }
}

/** Setup was cancelled by the user (RE-66). */
export class SetupCancelledError extends Error {
  constructor() {
    super("Setup cancelled");
    this.name = "SetupCancelledError";
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

function listEntries(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

export const localStoreSetupService = new LocalStoreSetupService();

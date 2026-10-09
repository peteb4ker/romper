// Keeps a copy of the Rample's `_save` folder in the local store (#802,
// stage 2 of #786): at setup from a card (UC-01) and before every write to
// the card (UC-34). The copy is opaque, byte for byte; nothing here decodes it, and
// nothing here writes to the card. See
// docs/developer/rample-save-integration.md, "Stage 2".
//
// The card is only read, asynchronously and under the card watchdog: a card
// whose driver stopped responding (#653, #724) gives up after the
// watchdog's limit instead of blocking main. A backup that fails never
// throws; it says why, and setup or the write carries on.
//
// Only regular files directly in `_save` are copied, each no bigger than a
// save file can be (the reader's limit), up to a file count and a total.
// Links, folders and anything else are listed as skipped, never followed.

import type {
  RampleSaveBackupReason,
  RampleSaveBackupResult,
  RampleSaveBackupSkip,
} from "@romper/shared/rampleSave.js";

import { isDeviceSaveFolderName } from "@romper/shared/rampleCardLayout.js";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  CardNotRespondingError,
  withCardWatchdog,
} from "../services/cardWatchdog.js";
import { logger } from "../utils/logger.js";
import { DEFAULT_CBOR_LIMITS } from "./cbor.js";

/** The copies' folder, inside the store's `.romperdb` folder */
export const RAMPLE_SAVE_BACKUP_FOLDER = "rample-save";

/**
 * How many copies taken before a write are kept (the newest ones), beside
 * the setup copy, which is always kept. A proposal awaiting Pete's
 * confirmation on #802: the roadmap says "the latest few", and a copy is a
 * few hundred bytes per kit.
 */
export const RAMPLE_SAVE_WRITE_BACKUPS_KEPT = 10;

/** What a copy may hold, so a damaged card can't fill the store */
export const RAMPLE_SAVE_BACKUP_LIMITS = {
  /** A file bigger than a save file can be isn't copied */
  maxFileBytes: DEFAULT_CBOR_LIMITS.maxBytes,
  /** More than one file per kit slot, settings and autosave, with room */
  maxFiles: 4096,
  /** All the files together; a full card's folder is under 1 MB */
  maxTotalBytes: 8 * 1024 * 1024,
};

interface CardFile {
  bytes: Uint8Array;
  name: string;
}

/** A whole copy's folder name; group 1 is when it was taken */
const BACKUP_NAME =
  /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-(setup|write)(?:-\d+)?$/;

/**
 * Copy the card's `_save` folder into `<dbDir>/rample-save/<date-time>-<reason>/`,
 * then remove older copies taken before a write beyond the newest
 * {@link RAMPLE_SAVE_WRITE_BACKUPS_KEPT}. A card without `_save` has
 * nothing to copy. Never throws, and never writes to the card.
 */
export async function backupRampleSaveFolder(options: {
  cardPath: string;
  dbDir: string;
  keep?: number;
  now?: Date;
  reason: RampleSaveBackupReason;
}): Promise<RampleSaveBackupResult> {
  const { cardPath, dbDir, reason } = options;
  let read: { files: CardFile[]; skipped: RampleSaveBackupSkip[] } | null;
  try {
    read = await readCardSaveFolder(cardPath);
  } catch (error) {
    return failed(error, "Couldn't read the card's _save folder");
  }
  if (!read) return { status: "missing" };

  const root = path.join(dbDir, RAMPLE_SAVE_BACKUP_FOLDER);
  let backupPath: string;
  try {
    backupPath = await storeCopy(
      root,
      backupName(options.now ?? new Date(), reason),
      read.files,
    );
  } catch (error) {
    return failed(error, "Couldn't store the copy of the card's _save folder");
  }

  const retention = await removeOldBackups(
    root,
    path.basename(backupPath),
    options.keep ?? RAMPLE_SAVE_WRITE_BACKUPS_KEPT,
  );
  return {
    backupPath,
    files: read.files.map(({ name }) => name),
    skipped: read.skipped,
    status: "copied",
    ...retention,
  };
}

/**
 * Log what a backup did, for troubleshooting: a failure, a skipped entry
 * or a retention problem as a warning, which stays visible in production.
 * No user-facing message yet: its wording is Pete's call (#802).
 */
export function logRampleSaveBackup(
  result: RampleSaveBackupResult,
  when: string,
): void {
  switch (result.status) {
    case "copied":
      logger.log(
        `[RampleSave] ${when}: copied ${result.files.length} files from the card's _save folder to ${result.backupPath}`,
      );
      if (result.skipped.length > 0) {
        console.warn(
          `[RampleSave] ${when}: left out of the copy:`,
          result.skipped.map(({ name, reason }) => `${name} (${reason})`),
        );
      }
      if (result.retentionError) {
        console.warn(
          `[RampleSave] ${when}: couldn't remove older copies: ${result.retentionError}`,
        );
      }
      return;
    case "failed":
      console.warn(`[RampleSave] ${when}: ${result.error}`);
      return;
    default:
      logger.log(`[RampleSave] ${when}: the card has no _save folder to copy`);
  }
}

/** `2026-10-08T21-46-58-123Z-write`: sorts by time, and is a valid file name everywhere */
function backupName(now: Date, reason: RampleSaveBackupReason): string {
  return `${now.toISOString().replaceAll(/[:.]/g, "-")}-${reason}`;
}

/** Byte order, so the copy lists files as the reader does */
function compareBytes(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function failed(error: unknown, context: string): RampleSaveBackupResult {
  const cardNotResponding = error instanceof CardNotRespondingError;
  const message = error instanceof Error ? error.message : String(error);
  return {
    cardNotResponding,
    error: `${context}: ${message}`,
    status: "failed",
  };
}

/**
 * The regular files directly in the card's `_save` folder, read, and what
 * was skipped. Null when the card has no `_save` folder. Every card
 * operation is asynchronous and under the watchdog, one at a time, so a
 * card that stops responding ties up one thread, not many.
 */
async function readCardSaveFolder(
  cardPath: string,
): Promise<{ files: CardFile[]; skipped: RampleSaveBackupSkip[] } | null> {
  const rootEntries = await withCardWatchdog(
    fs.promises.readdir(cardPath, { withFileTypes: true }),
  );
  // The device's own spelling first, then any other case of it (FAT32
  // ignores case; a test folder might not)
  const saveEntry = rootEntries
    .filter((entry) => isDeviceSaveFolderName(entry.name))
    .sort((a, b) => compareBytes(a.name, b.name))[0];
  if (!saveEntry) return null;
  if (!saveEntry.isDirectory()) {
    // A link or a file named _save: never followed
    throw new Error(`${saveEntry.name} on the card isn't a folder`);
  }

  const saveDir = path.join(cardPath, saveEntry.name);
  const entries = await withCardWatchdog(
    fs.promises.readdir(saveDir, { withFileTypes: true }),
  );
  entries.sort((a, b) => compareBytes(a.name, b.name));

  const files: CardFile[] = [];
  const skipped: RampleSaveBackupSkip[] = [];
  let totalBytes = 0;
  const limits = RAMPLE_SAVE_BACKUP_LIMITS;
  for (const entry of entries) {
    const { name } = entry;
    if (!entry.isFile()) {
      skipped.push({ name, reason: "not a regular file" });
      continue;
    }
    if (files.length >= limits.maxFiles) {
      skipped.push({ name, reason: `more than ${limits.maxFiles} files` });
      continue;
    }
    const filePath = path.join(saveDir, name);
    // lstat, not stat: a link is never followed, even if it changed since
    // the folder was listed
    const stats = await withCardWatchdog(fs.promises.lstat(filePath)); // NOSONAR: sequential on purpose (#724)
    const tooBig = sizeProblem(stats, totalBytes);
    if (tooBig) {
      skipped.push({ name, reason: tooBig });
      continue;
    }
    const bytes = new Uint8Array(
      await withCardWatchdog(fs.promises.readFile(filePath)), // NOSONAR: sequential on purpose (#724)
    );
    // The file grew between lstat and the read
    if (bytes.length > limits.maxFileBytes) {
      skipped.push({ name, reason: "it grew while it was read" });
      continue;
    }
    totalBytes += bytes.length;
    files.push({ bytes, name });
  }
  return { files, skipped };
}

/**
 * Remove copies taken before a write, oldest first, beyond the newest
 * `keep`. The setup copy and the copy just made (`newest`) are never
 * removed, whatever the clock said when the others were taken. Folders
 * not named like a whole copy (a `.partial` one a crash left behind,
 * anything else) are left alone. A failure here is reported, not thrown:
 * the new copy is fine.
 */
async function removeOldBackups(
  root: string,
  newest: string,
  keep: number,
): Promise<{ removedBackups: string[]; retentionError?: string }> {
  const removedBackups: string[] = [];
  try {
    const entries = await fs.promises.readdir(root, { withFileTypes: true });
    const writeCopies = entries
      .filter(
        (entry) =>
          entry.isDirectory() && BACKUP_NAME.exec(entry.name)?.[1] === "write",
      )
      .map((entry) => entry.name)
      .sort(compareBytes);
    const kept = new Set(writeCopies.slice(-Math.max(1, keep)));
    kept.add(newest);
    for (const name of writeCopies.filter((copy) => !kept.has(copy))) {
      // NOSONAR: sequential on purpose, a handful of small folders
      await fs.promises.rm(path.join(root, name), {
        force: true,
        recursive: true,
      });
      removedBackups.push(name);
    }
    return { removedBackups };
  } catch (error) {
    return {
      removedBackups,
      retentionError: error instanceof Error ? error.message : String(error),
    };
  }
}

function sizeProblem(stats: fs.Stats, totalBytes: number): null | string {
  const limits = RAMPLE_SAVE_BACKUP_LIMITS;
  if (!stats.isFile()) return "not a regular file";
  if (stats.size > limits.maxFileBytes) {
    return `${stats.size} bytes, more than a save file can be`;
  }
  if (totalBytes + stats.size > limits.maxTotalBytes) {
    return `the copy would be more than ${limits.maxTotalBytes} bytes`;
  }
  return null;
}

/**
 * Write the files into a new folder named `name` under `root`, by way of a
 * `.partial` folder renamed into place once every file is written, so a
 * half-made copy never looks like a whole one. Returns the copy's folder.
 */
async function storeCopy(
  root: string,
  name: string,
  files: CardFile[],
): Promise<string> {
  // Never recursive: the store's .romperdb folder must already be there, so
  // a setup cleaned up meanwhile (its folder moved aside) gets no new one
  await fs.promises.mkdir(root).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
  const finalName = await unusedName(root, name);
  const partial = path.join(root, `${finalName}.partial`);
  try {
    for (const { bytes, name: fileName } of files) {
      // NOSONAR: sequential on purpose, small files in the store
      await fs.promises.writeFile(path.join(partial, fileName), bytes, {
        flag: "wx",
      });
    }
    const backupPath = path.join(root, finalName);
    await fs.promises.rename(partial, backupPath);
    return backupPath;
  } catch (error) {
    await fs.promises.rm(partial, { force: true, recursive: true });
    throw error;
  }
}

/**
 * `name`, or `name-2`, `name-3`... when two copies are taken in the same
 * millisecond: the first whose copy and `.partial` folder don't exist. Its
 * `.partial` folder is made here, so no other copy can take the name.
 */
async function unusedName(root: string, name: string): Promise<string> {
  for (let n = 1; n < 100; n++) {
    const candidate = n === 1 ? name : `${name}-${n}`;
    const taken = await fs.promises
      .lstat(path.join(root, candidate))
      .then(() => true)
      .catch(() => false); // NOSONAR: retried only on a name clash
    if (taken) continue;
    try {
      await fs.promises.mkdir(path.join(root, `${candidate}.partial`)); // NOSONAR: retried only on a name clash
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error(`Too many copies named ${name}`);
}

import type { DbResult, Sample } from "@romper/shared/db/schema.js";
import type {
  RestoredMissingFile,
  RestoreMissingFileResult,
} from "@romper/shared/electronApi.js";

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  readKitSampleTx,
  repointSampleTx,
  updateSampleSourceStatusTx,
  withDb,
  withDbTransaction,
} from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { withCardWatchdog } from "./cardWatchdog.js";
import {
  fileNameOf,
  isInStore,
  missingFileSearch,
} from "./missingFileSearch.js";
import { stillMissing } from "./missingSampleRemoval.js";
import { checkSampleFile } from "./scanService.js";
import { storeCheckSettings } from "./storeCheckService.js";

/** A copy Romper made, as it was when made: undo deletes only that */
interface MadeCopy {
  createdFolder: null | string;
  ino: number;
  kitName: string;
  mtimeMs: number;
  sampleId: number;
  size: number;
}

/**
 * Errors from `link` that mean the filesystem has no hard links (FAT,
 * exFAT, some network shares): the copy is made in place instead, still
 * never over a file
 */
const NO_LINKS = new Set(["EINVAL", "ENOSYS", "ENOTSUP", "EPERM", "EXDEV"]);

/** The copies Romper made this session, by path: what undo may delete */
const madeCopies = new Map<string, MadeCopy>();

/**
 * The samples Romper pointed at a found file this session, and where each
 * pointed before: undo points a sample back only to that
 */
const madeRepoints = new Map<string, string>();

const limit = <T>(operation: Promise<T>) =>
  withCardWatchdog(operation, storeCheckSettings.operationTimeoutMs);

/** Forget the copies made and the samples pointed elsewhere (tests) */
export function forgetMadeCopies(): void {
  madeCopies.clear();
  madeRepoints.clear();
}

/**
 * Put back a found file for a missing sample (#823, stage 6 of
 * docs/developer/store-check.md, D2). Main checks again first: the row
 * must still read missing, its file must still be gone on a drive that is
 * connected (D6), and the found file must be one the search offered for
 * it and still a plain file.
 *
 * - Old place in the store: the found file is copied there. The copy is
 *   made under a hidden temporary name in the same folder and linked into
 *   place, which fails if a file is already there; on a filesystem
 *   without links it is copied with `COPYFILE_EXCL`. Never overwrites.
 *   The row isn't changed, so a read-only kit allows it.
 * - Old place outside the store: the sample is pointed at the found file,
 *   without copying (Q-03). That is a sample edit, refused on a read-only
 *   kit.
 *
 * Either way the sample's file is then checked as any other.
 */
export async function restoreMissingFile(
  localStorePath: string,
  kitName: string,
  sampleId: number,
  foundPath: string,
): Promise<DbResult<RestoreMissingFileResult>> {
  const dbDir = ServicePathManager.getDbPath(localStorePath);
  const read = withDb(dbDir, (db) => readKitSampleTx(db, kitName, sampleId));
  if (!read.success) return { error: read.error, success: false };
  const row = read.data;
  if (!row)
    return { error: `Sample not found in kit ${kitName}`, success: false };
  if (!missingFileSearch.offeredFile(localStorePath, sampleId, foundPath)) {
    return {
      error: `Access denied: ${foundPath} wasn't found for this sample`,
      success: false,
    };
  }
  const missing =
    row.source_status === "missing" && (await stillMissing([row])).length > 0;
  if (!missing) {
    return {
      error: `${fileNameOf(row)} isn't missing any more`,
      success: false,
    };
  }
  try {
    const found = await limit(fs.promises.lstat(foundPath));
    if (!found.isFile()) throw new Error(`${foundPath} isn't a file`);
  } catch (error) {
    return { error: errorText(error), success: false };
  }

  try {
    const restored = (await isInStore(localStorePath, row.source_path))
      ? await copyBack(localStorePath, kitName, row, foundPath)
      : repoint(dbDir, kitName, row, foundPath);
    if (restored.kind === "repoint") {
      madeRepoints.set(
        repointKey(localStorePath, kitName, restored),
        restored.from,
      );
    }
    await recordFileCheck(dbDir, {
      ...row,
      source_path: currentPath(restored),
    });
    return { data: { changed: false, restored }, success: true };
  } catch (error) {
    return { error: errorText(error), success: false };
  }
}

/**
 * Undo `restoreMissingFile`. A copy is deleted only if it is one Romper
 * made this session for this sample and its size, modification time and
 * inode are still what Romper wrote; otherwise it is left and `changed`
 * says so. A sample pointed elsewhere is pointed back.
 */
export async function undoRestoreMissingFile(
  localStorePath: string,
  kitName: string,
  restored: RestoredMissingFile,
): Promise<DbResult<RestoreMissingFileResult>> {
  const dbDir = ServicePathManager.getDbPath(localStorePath);
  try {
    if (restored.kind === "repoint") {
      const key = repointKey(localStorePath, kitName, restored);
      if (madeRepoints.get(key) !== restored.from) {
        return {
          error: `Romper didn't point the sample at ${restored.to}`,
          success: false,
        };
      }
      const pointed = withDbTransaction(dbDir, (db) =>
        repointSampleTx(db, kitName, restored.sampleId, {
          from: restored.to,
          onlyIfMissing: false,
          to: restored.from,
        }),
      );
      if (!pointed.success) return { error: pointed.error, success: false };
      madeRepoints.delete(key);
      await recheckRow(dbDir, kitName, restored.sampleId);
      return { data: { changed: false, restored: null }, success: true };
    }
    const changed = await deleteCopy(localStorePath, kitName, restored);
    await recheckRow(dbDir, kitName, restored.sampleId);
    return { data: { changed, restored: null }, success: true };
  } catch (error) {
    return { error: errorText(error), success: false };
  }
}

/** Copy the found file to the sample's old place in the store, never over a file */
async function copyBack(
  localStorePath: string,
  kitName: string,
  row: Sample,
  foundPath: string,
): Promise<RestoredMissingFile> {
  const target = row.source_path;
  const folder = path.dirname(target);
  const createdFolder =
    (await limit(fs.promises.mkdir(folder, { recursive: true }))) ?? null;
  const temp = path.join(folder, `.romper-restore-${randomUUID()}.tmp`);
  try {
    await withCardWatchdog(
      fs.promises.copyFile(foundPath, temp, fs.constants.COPYFILE_EXCL),
    );
    try {
      await limit(fs.promises.link(temp, target));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "";
      if (code === "EEXIST") throw new Error(`A file is already at ${target}`);
      if (!NO_LINKS.has(code)) throw error;
      await withCardWatchdog(
        fs.promises.copyFile(foundPath, target, fs.constants.COPYFILE_EXCL),
      ).catch((copyError: unknown) => {
        throw (copyError as NodeJS.ErrnoException).code === "EEXIST"
          ? new Error(`A file is already at ${target}`)
          : copyError;
      });
    }
  } catch (error) {
    if (createdFolder) await removeEmptyFolders(folder, createdFolder);
    throw error;
  } finally {
    await fs.promises.rm(temp, { force: true }).catch(() => undefined);
  }
  const made = await limit(fs.promises.stat(target));
  madeCopies.set(copyKey(localStorePath, target), {
    createdFolder,
    ino: made.ino,
    kitName,
    mtimeMs: made.mtimeMs,
    sampleId: row.id,
    size: made.size,
  });
  return {
    fileName: fileNameOf(row),
    foundPath,
    kind: "copy",
    path: target,
    sampleId: row.id,
  };
}

function copyKey(localStorePath: string, target: string): string {
  return `${path.resolve(localStorePath)}\0${path.resolve(target)}`;
}

/** The file the sample points at after `restored` */
function currentPath(restored: RestoredMissingFile): string {
  return restored.kind === "copy" ? restored.path : restored.to;
}

/**
 * Delete a copy Romper made, if unchanged. Returns true when it changed
 * and was left. A copy that is gone already needs nothing.
 */
async function deleteCopy(
  localStorePath: string,
  kitName: string,
  restored: Extract<RestoredMissingFile, { kind: "copy" }>,
): Promise<boolean> {
  const key = copyKey(localStorePath, restored.path);
  const made = madeCopies.get(key);
  if (made?.kitName !== kitName || made.sampleId !== restored.sampleId) {
    throw new Error(`Romper didn't copy ${restored.path}`);
  }
  let now: fs.Stats;
  try {
    now = await limit(fs.promises.lstat(restored.path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    madeCopies.delete(key);
    return false;
  }
  madeCopies.delete(key);
  const unchanged =
    now.isFile() &&
    now.size === made.size &&
    now.mtimeMs === made.mtimeMs &&
    now.ino === made.ino;
  if (!unchanged) return true;
  await limit(fs.promises.unlink(restored.path));
  if (made.createdFolder) {
    await removeEmptyFolders(path.dirname(restored.path), made.createdFolder);
  }
  return false;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Check the sample's file again and record it, as the store check does */
async function recheckRow(
  dbDir: string,
  kitName: string,
  sampleId: number,
): Promise<void> {
  const read = withDb(dbDir, (db) => readKitSampleTx(db, kitName, sampleId));
  if (read.success && read.data) await recordFileCheck(dbDir, read.data);
}

/**
 * Check `row`'s file and record what was found, only while the row still
 * points at that file (an edit since wins)
 */
async function recordFileCheck(dbDir: string, row: Sample): Promise<void> {
  const check = await checkSampleFile(row, limit);
  withDbTransaction(dbDir, (db) =>
    updateSampleSourceStatusTx(db, row.id, check.fields, row.source_path),
  );
}

/**
 * Remove the folders a copy created, from `folder` up to `top`, while
 * they are empty
 */
async function removeEmptyFolders(folder: string, top: string): Promise<void> {
  let current = folder;
  for (;;) {
    try {
      await limit(fs.promises.rmdir(current)); // NOSONAR: one fs operation at a time on purpose
    } catch {
      return;
    }
    if (path.resolve(current) === path.resolve(top)) return;
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

/** Point the sample at the found file, outside the store (D2) */
function repoint(
  dbDir: string,
  kitName: string,
  row: Sample,
  foundPath: string,
): RestoredMissingFile {
  const result = withDbTransaction(dbDir, (db) =>
    repointSampleTx(db, kitName, row.id, {
      from: row.source_path,
      onlyIfMissing: true,
      to: foundPath,
    }),
  );
  if (!result.success) throw new Error(result.error);
  return {
    fileName: fileNameOf(row),
    from: row.source_path,
    kind: "repoint",
    sampleId: row.id,
    to: foundPath,
  };
}

/** A sample pointed at a found file, as `madeRepoints` keys it */
function repointKey(
  localStorePath: string,
  kitName: string,
  restored: Extract<RestoredMissingFile, { kind: "repoint" }>,
): string {
  return [
    path.resolve(localStorePath),
    kitName,
    restored.sampleId,
    restored.to,
  ].join("\0");
}

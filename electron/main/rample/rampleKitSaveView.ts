// The kit editor's view of a kit's saved Rample settings (#800, stage 3 of
// #786): the kit's `<kit>.rpl` from the latest copy of the card's `_save`
// folder in the store, read with the stage 1b reader. Read-only: nothing
// here writes to the store or a card. See docs/developer/
// rample-save-integration.md, "Stage 3".

import type { DbResult } from "@romper/shared/db/schema.js";
import type {
  RampleDisplayValue,
  RampleKitSaveView,
  RampleOtherValue,
  RampleSaveCopyInfo,
} from "@romper/shared/rampleKitSaveView.js";
import type {
  RampleKitSaveFile,
  RampleRawValue,
  RampleSaveFolder,
} from "@romper/shared/rampleSave.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import { isKitName } from "@romper/shared/rampleCardLayout.js";
import { RAMPLE_KIT_SAVE_KEYS } from "@romper/shared/rampleSave.js";
import * as fs from "node:fs";
import * as path from "node:path";

import { isOpaqueItem } from "./cbor.js";
import { readRampleSaveFolder } from "./rampleSaveReader.js";

/**
 * The store's copies of the card's `_save` folder, one folder per copy,
 * under `.romperdb` (decision D2 on #786; stage 2 takes them).
 */
export const RAMPLE_SAVE_COPIES_FOLDER = "rample-save";

/** A copy of the card's `_save` folder in the store. */
export interface RampleSaveCopy extends RampleSaveCopyInfo {
  path: string;
}

/**
 * A copy's folder name starts with when it was taken, in UTC, with dashes
 * for colons (file names can't hold colons on Windows): stage 2 names
 * copies `2026-10-09T04-12-58-123Z-setup`. The milliseconds are optional.
 */
const STAMPED_NAME =
  /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?Z/;

const KNOWN_KIT_KEYS: ReadonlySet<string> = new Set<string>(
  Object.values(RAMPLE_KIT_SAVE_KEYS),
);

/**
 * The latest copy of the card's `_save` folder in the store, or null when
 * there's none. Copies are named so their names sort in the order they
 * were taken; the last folder by name is the latest.
 */
export async function findLatestRampleSaveCopy(
  dbDir: string,
): Promise<null | RampleSaveCopy> {
  const copiesDir = path.join(dbDir, RAMPLE_SAVE_COPIES_FOLDER);
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(copiesDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const latest = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort(compareBytes)
    .at(-1);
  if (latest === undefined) return null;

  const copyPath = path.join(copiesDir, latest);
  const takenAt =
    takenAtFromFolderName(latest) ??
    (await fs.promises.stat(copyPath)).mtime.toISOString();
  return { folderName: latest, path: copyPath, takenAt };
}

/**
 * The kit editor's view of a kit's file in a decoded copy of `_save`. The
 * kit name is compared ignoring case, as the device's file names are.
 */
export function kitSaveViewOf(
  kitName: string,
  folder: RampleSaveFolder,
  copy: RampleSaveCopyInfo,
): RampleKitSaveView {
  const firmware = folder.firmware;
  const wanted = kitName.toUpperCase();
  const file = folder.files.find(
    (candidate): candidate is RampleKitSaveFile =>
      candidate.kind === "kit" && candidate.kitName === wanted,
  );
  if (!file) return { copy, firmware, kitName, status: "noFile" };
  // A file that decodes but isn't a map of settings has nothing to show
  // per voice, so it's shown as unreadable too, with the reader's reason
  const reason = file.unreadable
    ? file.unreadable.message
    : !(file.raw instanceof Map) && (file.problems[0] ?? "Not a map");
  if (reason) {
    return {
      copy,
      fileName: file.fileName,
      firmware,
      kitName,
      reason,
      status: "unreadable",
    };
  }
  return {
    copy,
    fileName: file.fileName,
    firmware,
    kitName,
    missingKeys: file.missingKeys,
    otherValues: otherValuesOf(file),
    status: "found",
    values: file.values,
  };
}

/**
 * Read a kit's saved Rample settings from the store's latest copy of the
 * card's `_save` folder. Only that copy is read; the card isn't.
 */
export async function readKitRampleSave(
  localStorePath: string,
  kitName: string,
): Promise<DbResult<RampleKitSaveView>> {
  if (!isKitName(kitName)) {
    return { error: `Not a kit name: ${String(kitName)}`, success: false };
  }
  try {
    const dbDir = path.join(localStorePath, ".romperdb");
    const copy = await findLatestRampleSaveCopy(dbDir);
    if (!copy) return { data: { kitName, status: "noCopy" }, success: true };
    const folder = await readRampleSaveFolder(copy.path);
    const info: RampleSaveCopyInfo = {
      folderName: copy.folderName,
      takenAt: copy.takenAt,
    };
    return { data: kitSaveViewOf(kitName, folder, info), success: true };
  } catch (error) {
    return {
      error: `Couldn't read the Rample's saved settings: ${getErrorMessage(error)}`,
      success: false,
    };
  }
}

/**
 * When a copy was taken, from a folder name that starts with a date and
 * time (see {@link STAMPED_NAME}), as ISO 8601; undefined otherwise.
 */
export function takenAtFromFolderName(name: string): string | undefined {
  const match = STAMPED_NAME.exec(name);
  if (!match) return undefined;
  const [, day, hour, minute, second, ms = "000"] = match;
  const date = new Date(`${day}T${hour}:${minute}:${second}.${ms}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** A decoded value as plain data that can cross IPC. */
export function toRampleDisplayValue(
  value: RampleRawValue,
): RampleDisplayValue {
  if (value instanceof Map) {
    return {
      entries: [...value].map(([key, item]) => [
        key,
        toRampleDisplayValue(item),
      ]),
    };
  }
  if (Array.isArray(value)) return value.map(toRampleDisplayValue);
  if (isOpaqueItem(value)) {
    return {
      opaque: { majorType: value.majorType, size: value.bytes.length },
    };
  }
  return value;
}

/**
 * The item at a key path the reader reports (`zz_test`,
 * `assignments[1].extra`), or undefined when the path doesn't lead to one.
 */
export function valueAtKeyPath(
  root: RampleRawValue | undefined,
  keyPath: string,
): RampleRawValue | undefined {
  let item = root;
  for (const [, key, index] of keyPath.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) {
    if (index !== undefined) {
      item = Array.isArray(item) ? item[Number(index)] : undefined;
    } else {
      item = item instanceof Map ? item.get(key) : undefined;
    }
    if (item === undefined) return undefined;
  }
  return item;
}

/** Byte order, as the device orders names; not `localeCompare` */
function compareBytes(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Unknown keys, then known keys the reader couldn't read as the shape the
 * device writes, each with its value, so nothing in the file is hidden.
 */
function otherValuesOf(file: RampleKitSaveFile): RampleOtherValue[] {
  const other: RampleOtherValue[] = [];
  for (const key of file.unknownKeys) {
    const value = valueAtKeyPath(file.raw, key);
    if (value !== undefined) {
      other.push({
        key,
        unexpectedShape: false,
        value: toRampleDisplayValue(value),
      });
    }
  }
  if (file.raw instanceof Map) {
    const read = new Set<string>(
      Object.entries(RAMPLE_KIT_SAVE_KEYS)
        .filter(([field]) => file.values[field as keyof typeof file.values])
        .map(([, key]) => key),
    );
    for (const [key, value] of file.raw) {
      if (KNOWN_KIT_KEYS.has(key) && !read.has(key)) {
        other.push({
          key,
          unexpectedShape: true,
          value: toRampleDisplayValue(value),
        });
      }
    }
  }
  return other;
}

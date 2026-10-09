import {
  BANK_NAME_FILE_PATTERN,
  DEVICE_SAVE_FOLDER,
  isDeviceSaveFolderName,
  kitNameOfCardFolder,
} from "@romper/shared/rampleCardLayout.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";

import { CardNotRespondingError, withCardWatchdog } from "./cardWatchdog.js";

/**
 * What a sync leaves on the card: for each kit folder the file names it
 * should hold, and the bank name files at the root.
 */
export interface CardContents {
  bankFiles: Iterable<string>;
  /**
   * Kits whose folder on the card is left exactly as it is: quarantined
   * kits, which aren't written (#537 rule 4). Nothing in them is stale.
   */
  keepKits?: Iterable<string>;
  kits: ReadonlyMap<string, Iterable<string>>;
}

export interface RemoveCardEntriesOptions {
  /**
   * Called after each entry is removed, with the count so far and the
   * number it will remove (refused entries aren't counted)
   */
  onRemoved?: (removed: number, total: number) => void;
  /** Checked before each entry: true stops the removal there (Cancel) */
  shouldStop?: () => boolean;
}

/** What {@link removeCardEntries} did with the entries it was given. */
export interface RemoveCardEntriesResult {
  /**
   * Entries it refused to remove, as given: the device's `_save` folder,
   * anything in it, or a path that holds it (#787). None of them is touched.
   */
  refused: string[];
  /** How many entries it removed */
  removed: number;
}

export interface SdCardTargetCheck {
  ok: boolean;
  reason?: string;
}

/**
 * The Rample content on the card that `contents` doesn't account for, as
 * paths relative to the card: kit folders for kits that aren't in the
 * store (or have no samples), anything else inside a kit folder, and bank
 * name files for banks without a name. Everything else on the card (any
 * other file or folder) is left out, and so is a kept kit's folder
 * (`keepKits`) with everything in it. The Rample's own `_save` folder is
 * skipped by name, whatever the kit and bank patterns match (#787).
 *
 * Names are compared ignoring case: FAT32 cards and macOS volumes are case
 * insensitive, so a file sync just overwrote may keep its old case.
 */
export async function findStaleCardEntries(
  sdCardPath: string,
  contents: CardContents,
): Promise<string[]> {
  // Read asynchronously: a card can be slow, and the write summary runs
  // this on the main process (RE-82)
  const stats = await fs.promises.stat(sdCardPath).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  });
  if (!stats?.isDirectory()) return [];

  const kits = new Map<string, Set<string>>();
  for (const [kitName, fileNames] of contents.kits) {
    kits.set(kitName.toUpperCase(), lowerCaseSet(fileNames));
  }
  const bankFiles = lowerCaseSet(contents.bankFiles);
  const keepKits = new Set(
    [...(contents.keepKits ?? [])].map((kit) => kit.toUpperCase()),
  );

  const stale: string[] = [];
  const kitFolders: { keep: Set<string>; name: string }[] = [];
  const entries = await fs.promises.readdir(sdCardPath, {
    withFileTypes: true,
  });
  for (const entry of entries) {
    // The device's settings, never Romper's to remove
    if (isDeviceSaveFolderName(entry.name)) continue;
    const kitName = kitOfFolder(entry);
    if (kitName) {
      if (keepKits.has(kitName)) continue;
      const keep = kits.get(kitName);
      if (keep) {
        kitFolders.push({ keep, name: entry.name });
      } else {
        stale.push(entry.name);
      }
    } else if (isStaleBankFile(entry, bankFiles)) {
      stale.push(entry.name);
    }
  }
  // The kit folders are independent, so they're read together
  const kitContents = await Promise.all(
    kitFolders.map(({ name }) =>
      fs.promises.readdir(path.join(sdCardPath, name)),
    ),
  );
  kitFolders.forEach(({ keep, name }, i) => {
    for (const fileName of kitContents[i]) {
      if (!keep.has(fileName.toLowerCase())) {
        stale.push(path.join(name, fileName));
      }
    }
  });
  return stale.sort((a, b) => a.localeCompare(b));
}

/**
 * Where the SD card folder picker should open: the platform's removable
 * volume folder when there is one, so the user starts near their card
 * instead of inside their home folder.
 */
export function getSdCardDialogDefaultPath(): string {
  const candidates: string[] = [];
  if (process.platform === "darwin") {
    candidates.push("/Volumes");
  } else if (process.platform === "linux") {
    const user = os.userInfo().username;
    candidates.push(`/media/${user}`, `/run/media/${user}`, "/media");
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return os.homedir();
}

/**
 * True when writing or removing `cardPath` could change the device's
 * `_save` folder (#787): the path is the folder or inside it, compared
 * ignoring case as FAT32 does, or it is the card itself or outside the
 * card, so it holds the folder. `cardPath` is absolute, or relative to the
 * card.
 */
export function reachesDeviceSaveFolder(
  sdCardPath: string,
  cardPath: string,
): boolean {
  const card = path.resolve(sdCardPath);
  const relative = path.relative(card, path.resolve(card, cardPath));
  const first = relative.split(/[\\/]/)[0];
  return (
    relative === "" ||
    first === ".." ||
    path.isAbsolute(relative) ||
    isDeviceSaveFolderName(first)
  );
}

/**
 * Remove the AppleDouble file (`._<name>`) macOS made beside a file just
 * written to the card (#653). On a FAT or exFAT card, macOS keeps a file's
 * extended attributes in a `._` file next to it, and it tags every file a
 * downloaded app creates with `com.apple.provenance`, which can't be
 * removed. So each sample written got a 4 KB `._` file, which the Rample
 * doesn't need and the write's stale-entry removal then deleted, one by
 * one, at the end. Removing it as each file is written keeps the card
 * clean, even after a cancelled write. Only macOS makes these files.
 */
export async function removeAppleDoubleCompanion(
  cardFilePath: string,
): Promise<void> {
  if (process.platform !== "darwin") return;
  await fs.promises.rm(
    path.join(path.dirname(cardFilePath), `._${path.basename(cardFilePath)}`),
    { force: true },
  );
}

/**
 * Delete entries (paths relative to the card) found by
 * {@link findStaleCardEntries}. Folders are removed with their contents;
 * symlinks are removed, never followed.
 *
 * Whatever list it's given, it refuses any entry that
 * {@link reachesDeviceSaveFolder}: the device's `_save` folder, anything in
 * it, or the card itself (#787). Refused entries are checked before
 * anything is removed, left alone, and returned in `refused`.
 *
 * Removal is asynchronous, one entry at a time, yielding between entries
 * (#653): deleting kit folders on a slow card blocked the main process,
 * froze the window and kept Cancel from being handled. Each entry has the
 * card watchdog's time limit, so a card that stops responding fails the
 * write instead of leaving it waiting.
 */
export async function removeCardEntries(
  sdCardPath: string,
  entries: readonly string[],
  options: RemoveCardEntriesOptions = {},
): Promise<RemoveCardEntriesResult> {
  const refused: string[] = [];
  const removable: string[] = [];
  for (const entry of entries) {
    (reachesDeviceSaveFolder(sdCardPath, entry) ? refused : removable).push(
      entry,
    );
  }
  if (refused.length > 0) {
    console.warn(
      `Refused to remove ${refused.length} card entries that would change the Rample's ${DEVICE_SAVE_FOLDER} folder:`,
      refused,
    );
  }

  let removed = 0;
  for (const entry of removable) {
    if (options.shouldStop?.()) break;
    // One at a time, so Cancel and the watchdog act between entries
    const removal = fs.promises.rm(path.join(sdCardPath, entry), {
      force: true,
      recursive: true,
    });
    await withCardWatchdog(removal); // NOSONAR: sequential on purpose (#653)
    removed++;
    options.onRemoved?.(removed, removable.length);
    await yieldToEventLoop(); // NOSONAR: yields between entries on purpose (#653)
  }
  return { refused, removed };
}

/**
 * Check that a sync target is safe to write to (and, if asked, to clear).
 * Refuses the system root, the home folder and anything above it, and any
 * folder that is, contains or sits inside a local store.
 *
 * The write runs this first, so resolving the card's path is asynchronous
 * and under the card watchdog: a card that stopped responding fails the
 * write instead of freezing the window (#656).
 */
export async function validateSdCardTarget(
  sdCardPath: string,
  protectedStorePaths: readonly string[],
): Promise<SdCardTargetCheck> {
  if (!sdCardPath || !path.isAbsolute(sdCardPath)) {
    return { ok: false, reason: "No SD card folder selected" };
  }

  const target = await canonicalize(sdCardPath, withCardWatchdog);

  if (target === (await systemRoot())) {
    return {
      ok: false,
      reason: `Refusing to use the system root (${sdCardPath}) as the SD card`,
    };
  }

  const home = await canonicalize(os.homedir());
  if (isSameOrInside(home, target)) {
    return {
      ok: false,
      reason: `Refusing to use your home folder, or a folder above it (${sdCardPath}), as the SD card`,
    };
  }

  for (const storePath of protectedStorePaths) {
    if (!storePath) continue;
    const store = await canonicalize(storePath);
    if (isSameOrInside(target, store) || isSameOrInside(store, target)) {
      return {
        ok: false,
        reason: `The SD card folder (${sdCardPath}) overlaps the local store (${storePath}). Choose the SD card itself.`,
      };
    }
  }

  return { ok: true };
}

/**
 * Resolve symlinks where the path exists; normalise case on
 * case-insensitive platforms. `guard` wraps the lookup (the card watchdog,
 * for the card's path).
 */
async function canonicalize(
  p: string,
  guard: <T>(lookup: Promise<T>) => Promise<T> = (lookup) => lookup,
): Promise<string> {
  let resolved: string;
  try {
    resolved = await guard(fs.promises.realpath(p));
  } catch (error) {
    // A card that stopped responding fails the write
    if (error instanceof CardNotRespondingError) throw error;
    resolved = path.resolve(p);
  }
  return process.platform === "darwin" || process.platform === "win32"
    ? resolved.toLowerCase()
    : resolved;
}

/** True if `child` is `parent` or is inside it. Both must be canonical. */
function isSameOrInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (relative.split(path.sep)[0] !== ".." && !path.isAbsolute(relative))
  );
}

/** A bank name file at the card root for a bank that no longer has that name */
function isStaleBankFile(
  entry: fs.Dirent,
  bankFiles: ReadonlySet<string>,
): boolean {
  return (
    entry.isFile() &&
    BANK_NAME_FILE_PATTERN.test(entry.name) &&
    !bankFiles.has(entry.name.toLowerCase())
  );
}

/**
 * The kit a card-root entry holds, by the rule setup imports by (#573): a
 * folder `a5` is kit A5's. Null for anything else.
 */
function kitOfFolder(entry: fs.Dirent): null | string {
  return entry.isDirectory() ? kitNameOfCardFolder(entry.name) : null;
}

function lowerCaseSet(names: Iterable<string>): Set<string> {
  return new Set([...names].map((name) => name.toLowerCase()));
}

async function systemRoot(): Promise<string> {
  if (process.platform === "win32") {
    const systemDrive = process.env.SystemDrive || "C:";
    return canonicalize(`${systemDrive}\\`);
  }
  return "/";
}

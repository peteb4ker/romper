import { BANK_NAME_FILE_PATTERN } from "@romper/shared/rampleCardLayout.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";

import { withCardWatchdog } from "./cardWatchdog.js";

/**
 * Kit folders the Rample reads at the card root: a bank letter followed by
 * a slot number (A0 to Z99).
 */
const KIT_FOLDER_PATTERN = /^[A-Z]\d{1,2}$/i;

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
  /** Called after each entry is removed, with the count so far */
  onRemoved?: (removed: number, total: number) => void;
  /** Checked before each entry: true stops the removal there (Cancel) */
  shouldStop?: () => boolean;
}

export interface SdCardTargetCheck {
  ok: boolean;
  reason?: string;
}

/**
 * The Rample content on the card that `contents` doesn't account for, as
 * paths relative to the card: kit folders for kits that aren't in the
 * store (or have no samples), anything else inside a kit folder, and bank
 * name files for banks without a name. Everything else on the card (the
 * Rample's own `_save` folder, any other file or folder) is left out, and
 * so is a kept kit's folder (`keepKits`) with everything in it.
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
    if (entry.isDirectory() && KIT_FOLDER_PATTERN.test(entry.name)) {
      if (keepKits.has(entry.name.toUpperCase())) continue;
      const keep = kits.get(entry.name.toUpperCase());
      if (keep) {
        kitFolders.push({ keep, name: entry.name });
      } else {
        stale.push(entry.name);
      }
    } else if (
      entry.isFile() &&
      BANK_NAME_FILE_PATTERN.test(entry.name) &&
      !bankFiles.has(entry.name.toLowerCase())
    ) {
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
 * Removal is asynchronous, one entry at a time, yielding between entries
 * (#653): deleting kit folders on a slow card blocked the main process,
 * froze the window and kept Cancel from being handled. Each entry has the
 * card watchdog's time limit, so a card that stops responding fails the
 * write instead of leaving it waiting. Returns how many were removed.
 */
export async function removeCardEntries(
  sdCardPath: string,
  entries: readonly string[],
  options: RemoveCardEntriesOptions = {},
): Promise<number> {
  let removed = 0;
  for (const entry of entries) {
    if (options.shouldStop?.()) break;
    // One at a time, so Cancel and the watchdog act between entries
    const removal = fs.promises.rm(path.join(sdCardPath, entry), {
      force: true,
      recursive: true,
    });
    await withCardWatchdog(removal); // NOSONAR: sequential on purpose (#653)
    removed++;
    options.onRemoved?.(removed, entries.length);
    await yieldToEventLoop(); // NOSONAR: yields between entries on purpose (#653)
  }
  return removed;
}

/**
 * Check that a sync target is safe to write to (and, if asked, to clear).
 * Refuses the system root, the home folder and anything above it, and any
 * folder that is, contains or sits inside a local store.
 */
export function validateSdCardTarget(
  sdCardPath: string,
  protectedStorePaths: readonly string[],
): SdCardTargetCheck {
  if (!sdCardPath || !path.isAbsolute(sdCardPath)) {
    return { ok: false, reason: "No SD card folder selected" };
  }

  const target = canonicalize(sdCardPath);

  if (target === systemRoot()) {
    return {
      ok: false,
      reason: `Refusing to use the system root (${sdCardPath}) as the SD card`,
    };
  }

  const home = canonicalize(os.homedir());
  if (isSameOrInside(home, target)) {
    return {
      ok: false,
      reason: `Refusing to use your home folder, or a folder above it (${sdCardPath}), as the SD card`,
    };
  }

  for (const storePath of protectedStorePaths) {
    if (!storePath) continue;
    const store = canonicalize(storePath);
    if (isSameOrInside(target, store) || isSameOrInside(store, target)) {
      return {
        ok: false,
        reason: `The SD card folder (${sdCardPath}) overlaps the local store (${storePath}). Choose the SD card itself.`,
      };
    }
  }

  return { ok: true };
}

/** Resolve symlinks where the path exists; normalise case on case-insensitive platforms. */
function canonicalize(p: string): string {
  let resolved: string;
  try {
    resolved = fs.realpathSync.native(p);
  } catch {
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

function lowerCaseSet(names: Iterable<string>): Set<string> {
  return new Set([...names].map((name) => name.toLowerCase()));
}

function systemRoot(): string {
  if (process.platform === "win32") {
    const systemDrive = process.env.SystemDrive || "C:";
    return canonicalize(`${systemDrive}\\`);
  }
  return "/";
}

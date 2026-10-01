import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Kit folders the Rample reads at the card root: a bank letter followed by
 * a slot number (A0 to Z99).
 */
const KIT_FOLDER_PATTERN = /^[A-Z]\d{1,2}$/i;

/** Bank name files the Rample reads at the card root: "{L} - {Artist}.rtf". */
const BANK_RTF_PATTERN = /^[A-Z] - .+\.rtf$/i;

/**
 * What a sync leaves on the card: for each kit folder the file names it
 * should hold, and the bank name files at the root.
 */
export interface CardContents {
  bankFiles: Iterable<string>;
  kits: ReadonlyMap<string, Iterable<string>>;
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
 * Rample's own `_save` folder, any other file or folder) is left out.
 *
 * Names are compared ignoring case: FAT32 cards and macOS volumes are case
 * insensitive, so a file sync just overwrote may keep its old case.
 */
export function findStaleCardEntries(
  sdCardPath: string,
  contents: CardContents,
): string[] {
  const stats = fs.statSync(sdCardPath, { throwIfNoEntry: false });
  if (!stats?.isDirectory()) return [];

  const kits = new Map<string, Set<string>>();
  for (const [kitName, fileNames] of contents.kits) {
    kits.set(kitName.toUpperCase(), lowerCaseSet(fileNames));
  }
  const bankFiles = lowerCaseSet(contents.bankFiles);

  const stale: string[] = [];
  for (const entry of fs.readdirSync(sdCardPath, { withFileTypes: true })) {
    if (entry.isDirectory() && KIT_FOLDER_PATTERN.test(entry.name)) {
      const keep = kits.get(entry.name.toUpperCase());
      if (!keep) {
        stale.push(entry.name);
        continue;
      }
      const kitPath = path.join(sdCardPath, entry.name);
      for (const name of fs.readdirSync(kitPath)) {
        if (!keep.has(name.toLowerCase())) {
          stale.push(path.join(entry.name, name));
        }
      }
    } else if (
      entry.isFile() &&
      BANK_RTF_PATTERN.test(entry.name) &&
      !bankFiles.has(entry.name.toLowerCase())
    ) {
      stale.push(entry.name);
    }
  }
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
 * Delete entries (paths relative to the card) found by
 * {@link findStaleCardEntries}. Folders are removed with their contents;
 * symlinks are removed, never followed.
 */
export function removeCardEntries(
  sdCardPath: string,
  entries: readonly string[],
): void {
  for (const entry of entries) {
    fs.rmSync(path.join(sdCardPath, entry), { force: true, recursive: true });
  }
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

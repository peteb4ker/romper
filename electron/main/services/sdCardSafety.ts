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

export interface SdCardTargetCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Remove the Rample content Romper manages from the root of an SD card:
 * kit folders (A0 to Z99) and bank name RTF files. Everything else on the
 * card is left alone, and symlinks are never followed or removed.
 *
 * This replaces the old behaviour of deleting every entry at the chosen
 * path, which would erase any folder the user picked by mistake.
 */
export function clearRampleContent(sdCardPath: string): { removed: string[] } {
  const stats = fs.statSync(sdCardPath, { throwIfNoEntry: false });
  if (!stats) {
    throw new Error(`SD card path does not exist: ${sdCardPath}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`SD card path is not a folder: ${sdCardPath}`);
  }

  const removed: string[] = [];
  for (const entry of fs.readdirSync(sdCardPath, { withFileTypes: true })) {
    const entryPath = path.join(sdCardPath, entry.name);
    if (entry.isDirectory() && KIT_FOLDER_PATTERN.test(entry.name)) {
      fs.rmSync(entryPath, { force: true, recursive: true });
      removed.push(entry.name);
    } else if (entry.isFile() && BANK_RTF_PATTERN.test(entry.name)) {
      fs.unlinkSync(entryPath);
      removed.push(entry.name);
    }
  }
  return { removed };
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

function systemRoot(): string {
  if (process.platform === "win32") {
    const systemDrive = process.env.SystemDrive || "C:";
    return canonicalize(`${systemDrive}\\`);
  }
  return "/";
}

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { ServicePathManager } from "../utils/fileSystemUtils.js";

/**
 * Main-process path authorization for renderer-supplied paths (RE-03).
 *
 * The renderer is treated as untrusted: every IPC channel that takes a
 * filesystem path checks it here before touching the disk. A path is allowed
 * only if, after resolving `..` and symlinks, it sits inside one of the
 * allowed roots:
 *
 * Read and write roots
 * - the configured local store (`ROMPER_LOCAL_PATH`, then the saved setting)
 * - the SD card (`ROMPER_SDCARD_PATH`, then the saved setting)
 * - the default local store location the wizard offers (~/Documents/romper)
 * - folders the user picked in a native dialog shown by main, or approved in
 *   main's confirmation prompt, during this session
 *
 * Read-only grants
 * - files the user dropped onto the window this session (recorded by the
 *   preload from `webUtils.getPathForFile`, which only yields a path for a
 *   real user drop)
 * - sample source files a store referenced before an edit this session, so
 *   undo can re-add them (see sampleSourceAccess.ts)
 *
 * Grants live only in main-process memory; the renderer can ask main to show
 * a dialog, but never add a root directly. Env and settings roots are read
 * on every check, so a store the user switches to takes effect immediately.
 */

export type PathAccessMode = "read" | "write";

export type PathAccessResult = { error: string; ok: false } | { ok: true };

export interface PathAccessSettings {
  localStorePath?: unknown;
  sdCardPath?: unknown;
}

const CASE_INSENSITIVE =
  process.platform === "darwin" || process.platform === "win32";

export class PathAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathAccessError";
  }
}

export class PathAccessPolicy {
  private readonly grantedReadPaths = new Set<string>();
  private readonly grantedRoots = new Set<string>();
  private settings: PathAccessSettings = {};

  /**
   * Throwing form of `check`, for handlers that already report failures by
   * throwing.
   */
  assertAllowed(p: unknown, options: { write?: boolean } = {}): void {
    const result = this.check(p, options.write ? "write" : "read");
    if (!result.ok) {
      throw new PathAccessError(result.error);
    }
  }

  /** Decide whether the renderer may use `p` for reading or writing. */
  check(p: unknown, mode: PathAccessMode): PathAccessResult {
    let target: string;
    try {
      target = canonicalizePath(p);
    } catch (error) {
      return { error: (error as Error).message, ok: false };
    }

    const candidates =
      mode === "write"
        ? this.getRoots()
        : [...this.getRoots(), ...this.grantedReadPaths];

    for (const candidate of candidates) {
      let root: string;
      try {
        root = canonicalizePath(candidate);
      } catch {
        continue; // A root that can't be resolved grants nothing.
      }
      if (isSameOrInside(target, root)) {
        return { ok: true };
      }
    }

    return {
      error: `Access denied: ${String(p)} is outside the folders Romper has been given (${mode})`,
      ok: false,
    };
  }

  /** The configured and granted read/write roots, before canonicalization. */
  getRoots(): string[] {
    const roots = [
      // The active store: ROMPER_LOCAL_PATH if set, else the saved setting.
      ServicePathManager.getLocalStorePath(
        this.settings as Record<string, unknown>,
      ),
      nonEmptyString(process.env.ROMPER_SDCARD_PATH),
      nonEmptyString(this.settings.sdCardPath),
      getDefaultLocalStorePath(),
      ...this.grantedRoots,
    ];
    return roots.filter((r): r is string => r !== null);
  }

  /** Allow reading `p` (and anything under it) for the rest of the session. */
  grantRead(p: unknown): void {
    const value = nonEmptyString(p);
    if (value && path.isAbsolute(value)) {
      this.grantedReadPaths.add(path.resolve(value));
    }
  }

  /**
   * Allow reading and writing `p` and anything under it for the rest of the
   * session. Only call this with a path the user chose in main-owned UI.
   */
  grantRoot(p: unknown): void {
    const value = nonEmptyString(p);
    if (value && path.isAbsolute(value)) {
      this.grantedRoots.add(path.resolve(value));
    }
  }

  /** Forget session grants and settings (tests). */
  reset(): void {
    this.grantedReadPaths.clear();
    this.grantedRoots.clear();
    this.settings = {};
  }

  /**
   * Point the policy at the live in-memory settings object. The object is
   * read on every check, so later `write-settings` updates are seen.
   */
  useSettings(settings: PathAccessSettings): void {
    this.settings = settings;
  }
}

/**
 * Resolve `p` to its canonical form: `..` segments are removed and every
 * existing component has its symlinks resolved (realpath of the nearest
 * existing ancestor, with the not-yet-existing tail appended).
 *
 * Throws PathAccessError for input that is not an absolute path, contains a
 * NUL byte, or runs through a dangling or looping symlink (writing through a
 * dangling link would create its target, wherever that is).
 */
export function canonicalizePath(p: unknown): string {
  if (typeof p !== "string" || p.trim() === "") {
    throw new PathAccessError("A path is required");
  }
  if (p.includes("\0")) {
    throw new PathAccessError("Path contains a NUL byte");
  }
  if (!path.isAbsolute(p)) {
    throw new PathAccessError(`Path must be absolute: ${p}`);
  }

  let current = path.resolve(p);
  const tail: string[] = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native(current);
      return tail.length > 0 ? path.join(real, ...tail.reverse()) : real;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") {
        throw new PathAccessError(
          `Cannot resolve ${p}: ${code ?? String(error)}`,
        );
      }
    }

    if (isSymlink(current)) {
      throw new PathAccessError(`Path runs through a dangling symlink: ${p}`);
    }

    const parent = path.dirname(current);
    if (parent === current) {
      // Nothing on the way up exists (not even the filesystem root).
      return path.resolve(p);
    }
    tail.push(path.basename(current));
    current = parent;
  }
}

/** Where the wizard's "Use Default" button puts a new local store. */
export function getDefaultLocalStorePath(): string {
  return path.join(os.homedir(), "Documents", "romper");
}

/** True if `child` is `parent` or inside it. Both must be canonical. */
export function isSameOrInside(child: string, parent: string): boolean {
  const a = CASE_INSENSITIVE ? child.toLowerCase() : child;
  const b = CASE_INSENSITIVE ? parent.toLowerCase() : parent;
  const relative = path.relative(b, a);
  return (
    relative === "" ||
    (relative.split(path.sep)[0] !== ".." && !path.isAbsolute(relative))
  );
}

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function nonEmptyString(value: unknown): null | string {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export const pathAccess = new PathAccessPolicy();

/** Throw a PathAccessError unless the process-wide policy allows `p`. */
export function assertAllowed(
  p: unknown,
  options: { write?: boolean } = {},
): void {
  pathAccess.assertAllowed(p, options);
}

/**
 * Check a database folder the setup wizard names before the store is
 * configured (create-romper-db, insert-kit, insert-sample): it must be a
 * `.romperdb` folder inside a writable root.
 */
export function checkDatabaseDirAccess(dbDir: unknown): PathAccessResult {
  if (typeof dbDir !== "string" || path.basename(dbDir) !== ".romperdb") {
    return {
      error: `Access denied: ${String(dbDir)} is not a .romperdb folder`,
      ok: false,
    };
  }
  return pathAccess.check(dbDir, "write");
}

/** Check `p` against the process-wide policy. */
export function checkPathAccess(
  p: unknown,
  options: { write?: boolean } = {},
): PathAccessResult {
  return pathAccess.check(p, options.write ? "write" : "read");
}

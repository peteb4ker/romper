import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Shared file system utilities to reduce duplication across services
 */

/**
 * Common path operations for services
 */
export class ServicePathManager {
  /**
   * Get database path from local store path
   */
  static getDbPath(localStorePath: string): string {
    return path.join(localStorePath, ".romperdb");
  }

  /**
   * Get the effective local store path: the ROMPER_LOCAL_PATH environment
   * override if set, otherwise the saved setting. Every main-process reader
   * of the local store path should go through this.
   */
  static getLocalStorePath(
    inMemorySettings: Record<string, unknown>,
  ): null | string {
    const envOverride = process.env.ROMPER_LOCAL_PATH;
    if (envOverride && envOverride.trim() !== "") {
      return envOverride;
    }
    const path = inMemorySettings.localStorePath;
    return typeof path === "string" && path.trim() !== "" ? path : null;
  }
}

/**
 * Checks available disk space at a given path
 */
export function checkDiskSpace(targetPath: string): {
  availableBytes: number;
  error?: string;
  requiredBytes?: number;
  sufficient: boolean;
} {
  try {
    const resolvedPath = fs.existsSync(targetPath)
      ? targetPath
      : path.dirname(targetPath);

    if (!fs.existsSync(resolvedPath)) {
      return {
        availableBytes: 0,
        error: "Path does not exist",
        sufficient: false,
      };
    }

    const stats = fs.statfsSync(resolvedPath);
    const availableBytes = stats.bavail * stats.bsize;
    return { availableBytes, sufficient: true };
  } catch (error) {
    return {
      availableBytes: 0,
      error: `Disk space check failed: ${error instanceof Error ? error.message : String(error)}`,
      sufficient: false,
    };
  }
}

/**
 * Checks available disk space against a required amount
 */
export function checkDiskSpaceSufficient(
  targetPath: string,
  requiredBytes: number,
): {
  availableBytes: number;
  error?: string;
  requiredBytes: number;
  sufficient: boolean;
} {
  const result = checkDiskSpace(targetPath);
  if (result.error) {
    return { ...result, requiredBytes, sufficient: false };
  }
  return {
    availableBytes: result.availableBytes,
    requiredBytes,
    sufficient: result.availableBytes >= requiredBytes,
  };
}

/**
 * Checks if a path is writable by attempting to create and remove a temp file
 */
export function checkPathWritable(targetPath: string): {
  error?: string;
  writable: boolean;
} {
  try {
    const dirToCheck =
      fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()
        ? targetPath
        : path.dirname(targetPath);

    if (!fs.existsSync(dirToCheck)) {
      return {
        error: `Directory does not exist: ${dirToCheck}`,
        writable: false,
      };
    }

    const testFile = path.join(dirToCheck, `.romper-write-test-${Date.now()}`);
    fs.writeFileSync(testFile, "");
    fs.unlinkSync(testFile);
    return { writable: true };
  } catch (error) {
    return {
      error: `Cannot write to path: ${error instanceof Error ? error.message : String(error)}`,
      writable: false,
    };
  }
}

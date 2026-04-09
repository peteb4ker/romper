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
   * Get local store path from settings
   */
  static getLocalStorePath(
    inMemorySettings: Record<string, unknown>,
  ): null | string {
    const path = inMemorySettings.localStorePath;
    return typeof path === "string" && path.trim() !== "" ? path : null;
  }

  /**
   * Validate and get paths for service operations
   */
  static validateAndGetPaths(inMemorySettings: Record<string, unknown>): {
    dbPath?: string;
    error?: string;
    isValid: boolean;
    localStorePath?: string;
  } {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", isValid: false };
    }

    const dbPath = this.getDbPath(localStorePath);
    return { dbPath, isValid: true, localStorePath };
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

/**
 * Ensures a directory exists, creating it recursively if needed
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Gets file size safely, returning 0 if file doesn't exist or error occurs
 */
export function getFileSize(filePath: string): number {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      return stats.size;
    }
  } catch (error) {
    console.warn(`Failed to get file size for ${filePath}:`, error);
  }
  return 0;
}

/**
 * Removes a directory and its contents recursively.
 * Only removes directories under a known safe parent (must contain ".romperdb" in path).
 */
export function removeDirectorySafe(dirPath: string): {
  error?: string;
  removed: boolean;
} {
  try {
    if (!dirPath.includes(".romperdb")) {
      return {
        error: "Refusing to remove directory outside .romperdb scope",
        removed: false,
      };
    }
    if (!fs.existsSync(dirPath)) {
      return { removed: true }; // Already gone
    }
    fs.rmSync(dirPath, { force: true, recursive: true });
    return { removed: true };
  } catch (error) {
    return {
      error: `Failed to remove directory: ${error instanceof Error ? error.message : String(error)}`,
      removed: false,
    };
  }
}

/**
 * Validates file existence and basic properties
 */
export function validateFileExists(filePath: string): {
  error?: string;
  exists: boolean;
} {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: "File not found", exists: false };
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return { error: "Path is not a file", exists: false };
    }

    return { exists: true };
  } catch (error) {
    return {
      error: `File validation failed: ${error instanceof Error ? error.message : String(error)}`,
      exists: false,
    };
  }
}

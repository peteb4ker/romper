import * as fs from "fs";
import * as path from "path";

/**
 * Shared file system utilities to reduce duplication across services
 */

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
 * Validates file existence and basic properties
 */
export function validateFileExists(filePath: string): {
  exists: boolean;
  error?: string;
} {
  try {
    if (!fs.existsSync(filePath)) {
      return { exists: false, error: "File not found" };
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return { exists: false, error: "Path is not a file" };
    }

    return { exists: true };
  } catch (error) {
    return {
      exists: false,
      error: `File validation failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Common path operations for services
 */
export class ServicePathManager {
  /**
   * Get local store path from settings
   */
  static getLocalStorePath(
    inMemorySettings: Record<string, any>,
  ): string | null {
    return inMemorySettings.localStorePath || null;
  }

  /**
   * Get database path from local store path
   */
  static getDbPath(localStorePath: string): string {
    return path.join(localStorePath, ".romperdb");
  }

  /**
   * Validate and get paths for service operations
   */
  static validateAndGetPaths(inMemorySettings: Record<string, any>): {
    isValid: boolean;
    localStorePath?: string;
    dbPath?: string;
    error?: string;
  } {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { isValid: false, error: "No local store path configured" };
    }

    const dbPath = this.getDbPath(localStorePath);
    return { isValid: true, localStorePath, dbPath };
  }
}

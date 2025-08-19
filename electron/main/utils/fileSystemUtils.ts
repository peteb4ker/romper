import * as fs from "fs";
import * as path from "path";

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
    inMemorySettings: Record<string, any>
  ): null | string {
    return inMemorySettings.localStorePath || null;
  }

  /**
   * Validate and get paths for service operations
   */
  static validateAndGetPaths(inMemorySettings: Record<string, any>): {
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

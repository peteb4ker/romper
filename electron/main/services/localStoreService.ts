import * as fs from "fs";
import * as path from "path";

import type { LocalStoreValidationDetailedResult } from "../../../shared/db/schema.js";
import {
  validateLocalStoreAgainstDb,
  validateLocalStoreAndDb,
  validateLocalStoreBasic,
} from "../localStoreValidator.js";

/**
 * Service for local store validation and management operations
 * Extracted from ipcHandlers.ts and dbIpcHandlers.ts to separate business logic from IPC routing
 */
export class LocalStoreService {
  /**
   * Get local store status with comprehensive validation
   */
  getLocalStoreStatus(
    localStorePath: string | null,
    envPath?: string,
  ): {
    hasLocalStore: boolean;
    localStorePath: string | null;
    isValid: boolean;
    error: string | null;
  } {
    // Check environment variable first, then fall back to provided path
    const resolvedPath = envPath || localStorePath;

    if (!resolvedPath) {
      return {
        hasLocalStore: false,
        localStorePath: null,
        isValid: false,
        error: "No local store configured",
      };
    }

    // Validate database structure only - file sync issues are warnings, not blocking
    const validationResult = validateLocalStoreAndDb(resolvedPath);

    return {
      hasLocalStore: true,
      localStorePath: resolvedPath,
      isValid: validationResult.isValid,
      error: validationResult.error || validationResult.errorSummary || null,
    };
  }

  /**
   * Validate local store path against database
   */
  validateLocalStore(
    localStorePath: string,
  ): LocalStoreValidationDetailedResult {
    return validateLocalStoreAgainstDb(localStorePath);
  }

  /**
   * Validate file sync between database and filesystem
   * Returns detailed validation with file-level errors for warnings/reporting
   */
  validateFileSyncStatus(
    localStorePath: string,
  ): LocalStoreValidationDetailedResult {
    return validateLocalStoreAgainstDb(localStorePath);
  }

  /**
   * Basic validation of local store path (filesystem only)
   */
  validateLocalStoreBasic(
    localStorePath: string,
  ): LocalStoreValidationDetailedResult {
    return validateLocalStoreBasic(localStorePath);
  }

  /**
   * Validate that a selected path contains a valid Romper database
   */
  validateExistingLocalStore(selectedPath: string): {
    success: boolean;
    path: string | null;
    error: string | null;
  } {
    console.log(
      "[LocalStoreService] Validating existing local store:",
      selectedPath,
    );

    // Validate that the selected path contains a .romperdb directory and database schema
    // but don't validate all kits and their files - that's done separately
    const validation = validateLocalStoreAndDb(selectedPath);

    console.log("[LocalStoreService] Validation result:", {
      isValid: validation.isValid,
      error: validation.error,
      errorSummary: validation.errorSummary,
      hasErrors: !!validation.errors,
    });

    if (validation.isValid) {
      console.log("[LocalStoreService] ✓ Validation passed");
      return { success: true, path: selectedPath, error: null };
    } else {
      const errorMsg =
        validation.error ||
        validation.errorSummary ||
        "Selected directory does not contain a valid Romper database";
      console.log("[LocalStoreService] ✗ Validation failed:", errorMsg);
      return {
        success: false,
        path: null,
        error: errorMsg,
      };
    }
  }

  /**
   * List files in the root of a local store directory
   */
  listFilesInRoot(localStorePath: string): string[] {
    try {
      return fs.readdirSync(localStorePath);
    } catch (error) {
      throw new Error(
        `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Read a file and return its buffer
   */
  readFile(filePath: string): {
    success: boolean;
    data?: ArrayBuffer;
    error?: string;
  } {
    try {
      const data = fs.readFileSync(filePath);
      return {
        success: true,
        data: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ),
      };
    } catch (error: any) {
      console.error(
        "[LocalStoreService] Failed to read file:",
        filePath,
        error,
      );
      return {
        success: false,
        error: error.message || "Failed to read file",
      };
    }
  }

  /**
   * Check if a directory exists and create it if needed
   */
  ensureDirectory(dirPath: string): { success: boolean; error?: string } {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get the absolute path to a subdirectory within the local store
   */
  getLocalStorePath(localStorePath: string, ...subPaths: string[]): string {
    return path.join(localStorePath, ...subPaths);
  }

  /**
   * Get the database directory path for a local store
   */
  getDbPath(localStorePath: string): string {
    return this.getLocalStorePath(localStorePath, ".romperdb");
  }

  /**
   * Check if local store directory exists and is accessible
   */
  isLocalStoreAccessible(localStorePath: string): boolean {
    try {
      return (
        fs.existsSync(localStorePath) &&
        fs.lstatSync(localStorePath).isDirectory()
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if database directory exists within local store
   */
  hasRomperDb(localStorePath: string): boolean {
    const dbPath = this.getDbPath(localStorePath);
    try {
      return fs.existsSync(dbPath) && fs.lstatSync(dbPath).isDirectory();
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const localStoreService = new LocalStoreService();

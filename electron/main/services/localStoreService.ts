import type { LocalStoreValidationDetailedResult } from "@romper/shared/db/schema.js";

import * as fs from "fs";
import * as path from "path";

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
   * Check if a directory exists and create it if needed
   */
  ensureDirectory(dirPath: string): { error?: string; success: boolean } {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        success: false,
      };
    }
  }

  /**
   * Get the database directory path for a local store
   */
  getDbPath(localStorePath: string): string {
    return this.getLocalStorePath(localStorePath, ".romperdb");
  }

  /**
   * Get the absolute path to a subdirectory within the local store
   */
  getLocalStorePath(localStorePath: string, ...subPaths: string[]): string {
    return path.join(localStorePath, ...subPaths);
  }

  /**
   * Get local store status with comprehensive validation
   */
  getLocalStoreStatus(
    localStorePath: null | string,
    envPath?: string
  ): {
    error: null | string;
    hasLocalStore: boolean;
    isCriticalEnvironmentError: boolean;
    isEnvironmentOverride: boolean;
    isValid: boolean;
    localStorePath: null | string;
  } {
    // Treat empty string as explicit "no local store" override
    const isEnvironmentOverride = envPath !== undefined;
    const isEmptyOverride = envPath === "";

    if (isEmptyOverride) {
      return {
        error: "No local store configured (environment override)",
        hasLocalStore: false,
        isCriticalEnvironmentError: false,
        isEnvironmentOverride: true,
        isValid: false,
        localStorePath: null,
      };
    }

    // Check environment variable first, then fall back to provided path
    const resolvedPath = envPath || localStorePath;

    if (!resolvedPath) {
      return {
        error: "No local store configured",
        hasLocalStore: false,
        isCriticalEnvironmentError: false,
        isEnvironmentOverride,
        isValid: false,
        localStorePath: null,
      };
    }

    // Validate database structure only - file sync issues are warnings, not blocking
    const validationResult = validateLocalStoreAndDb(resolvedPath);

    // If environment variable is set but invalid, this is a critical error
    // Exception: In test environment, treat as regular invalid local store instead of critical error
    const isTestEnvironment =
      process.env.NODE_ENV === "test" ||
      process.env.ROMPER_TEST_MODE === "true";
    const isCriticalEnvironmentError =
      isEnvironmentOverride && !validationResult.isValid && !isTestEnvironment;

    return {
      error: validationResult.error || validationResult.errorSummary || null,
      hasLocalStore: true,
      isCriticalEnvironmentError,
      isEnvironmentOverride,
      isValid: validationResult.isValid,
      localStorePath: resolvedPath,
    };
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
   * List files in the root of a local store directory
   */
  listFilesInRoot(localStorePath: string): string[] {
    try {
      return fs.readdirSync(localStorePath);
    } catch (error) {
      throw new Error(
        `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Read a file and return its buffer
   */
  readFile(filePath: string): {
    data?: ArrayBuffer;
    error?: string;
    success: boolean;
  } {
    try {
      const data = fs.readFileSync(filePath);
      return {
        data: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength
        ),
        success: true,
      };
    } catch (error: any) {
      console.error(
        "[LocalStoreService] Failed to read file:",
        filePath,
        error
      );
      return {
        error: error.message ?? "Failed to read file",
        success: false,
      };
    }
  }

  /**
   * Validate that a selected path contains a valid Romper database
   */
  validateExistingLocalStore(selectedPath: string): {
    error: null | string;
    path: null | string;
    success: boolean;
  } {
    console.log(
      "[LocalStoreService] Validating existing local store:",
      selectedPath
    );

    // Validate that the selected path contains a .romperdb directory and database schema
    // but don't validate all kits and their files - that's done separately
    const validation = validateLocalStoreAndDb(selectedPath);

    console.log("[LocalStoreService] Validation result:", {
      error: validation.error,
      errorSummary: validation.errorSummary,
      hasErrors: !!validation.errors,
      isValid: validation.isValid,
    });

    if (validation.isValid) {
      console.log("[LocalStoreService] ✓ Validation passed");
      return { error: null, path: selectedPath, success: true };
    } else {
      const errorMsg =
        validation.error ||
        validation.errorSummary ||
        "Selected directory does not contain a valid Romper database";
      console.log("[LocalStoreService] ✗ Validation failed:", errorMsg);
      return {
        error: errorMsg,
        path: null,
        success: false,
      };
    }
  }

  /**
   * Validate file sync between database and filesystem
   * Returns detailed validation with file-level errors for warnings/reporting
   */
  validateFileSyncStatus(
    localStorePath: string
  ): LocalStoreValidationDetailedResult {
    return validateLocalStoreAgainstDb(localStorePath);
  }

  /**
   * Validate local store path against database
   */
  validateLocalStore(
    localStorePath: string
  ): LocalStoreValidationDetailedResult {
    return validateLocalStoreAgainstDb(localStorePath);
  }

  /**
   * Basic validation of local store path (filesystem only)
   */
  validateLocalStoreBasic(
    localStorePath: string
  ): LocalStoreValidationDetailedResult {
    return validateLocalStoreBasic(localStorePath);
  }
}

// Export singleton instance
export const localStoreService = new LocalStoreService();

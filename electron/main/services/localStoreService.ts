import type {
  DbResult,
  LocalStoreValidationDetailedResult,
} from "@romper/shared/db/schema.js";

import * as fs from "node:fs";

import {
  validateLocalStoreAgainstDb,
  validateLocalStoreAndDb,
  validateLocalStoreBasic,
} from "../localStoreValidator.js";
import { logger } from "../utils/logger.js";
import {
  CARD_NOT_RESPONDING_SETUP_MESSAGE,
  CardNotRespondingError,
  withCardWatchdog,
} from "./cardWatchdog.js";

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
   * Get local store status with comprehensive validation
   */
  getLocalStoreStatus(
    localStorePath: null | string,
    envPath?: string,
  ): {
    error: null | string;
    hasLocalStore: boolean;
    isCriticalEnvironmentError: boolean;
    isEnvironmentOverride: boolean;
    isValid: boolean;
    localStorePath: null | string;
  } {
    // An empty or blank ROMPER_LOCAL_PATH is unset, as every other reader
    // of it treats it
    const envOverride = envPath?.trim() ? envPath : undefined;
    const isEnvironmentOverride = envOverride !== undefined;

    // Check environment variable first, then fall back to provided path
    const resolvedPath = envOverride ?? localStorePath;

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
   * List the files in a folder's root. Setup lists the card's kit folders
   * this way, so the listing is asynchronous and under the card watchdog
   * (#724): a card whose driver stopped responding (#653) fails it with
   * setup's card-not-responding message instead of blocking the main
   * process.
   */
  async listFilesInRoot(localStorePath: string): Promise<DbResult<string[]>> {
    try {
      return {
        data: await withCardWatchdog(fs.promises.readdir(localStorePath)),
        success: true,
      };
    } catch (error) {
      if (error instanceof CardNotRespondingError) {
        return { error: CARD_NOT_RESPONDING_SETUP_MESSAGE, success: false };
      }
      return {
        error: `Failed to read directory: ${error instanceof Error ? error.message : String(error)}`,
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
    logger.log(
      "[LocalStoreService] Validating existing local store:",
      selectedPath,
    );

    // Validate that the selected path contains a .romperdb directory and database schema
    // but don't validate all kits and their files - that's done separately
    const validation = validateLocalStoreAndDb(selectedPath);

    logger.log("[LocalStoreService] Validation result:", {
      error: validation.error,
      errorSummary: validation.errorSummary,
      hasErrors: !!validation.errors,
      isValid: validation.isValid,
    });

    if (validation.isValid) {
      logger.log("[LocalStoreService] ✓ Validation passed");
      return { error: null, path: selectedPath, success: true };
    } else {
      const errorMsg =
        validation.error ||
        validation.errorSummary ||
        "Selected directory does not contain a valid Romper database";
      logger.log("[LocalStoreService] ✗ Validation failed:", errorMsg);
      return {
        error: errorMsg,
        path: null,
        success: false,
      };
    }
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
   * Basic validation of local store path (filesystem only)
   */
  validateLocalStoreBasic(
    localStorePath: string,
  ): LocalStoreValidationDetailedResult {
    return validateLocalStoreBasic(localStorePath);
  }
}

// Export singleton instance
export const localStoreService = new LocalStoreService();

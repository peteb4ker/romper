import type { DbResult } from "@romper/shared/db/schema.js";

import * as path from "path";

import { sampleService } from "../services/sampleService.js";

/**
 * Creates a wrapper for IPC handlers that require database directory validation
 */
export function createDbHandler<T extends unknown[], R>(
  inMemorySettings: Record<string, unknown>,
  handler: (dbDir: string, ...args: T) => Promise<R> | R,
): (_event: unknown, ...args: T) => Promise<R> {
  return async (_event: unknown, ...args: T): Promise<R> => {
    const dbDirResult = validateAndGetDbDir(inMemorySettings);
    if (!dbDirResult.success) {
      return { error: dbDirResult.error, success: false } as R;
    }
    return handler(dbDirResult.dbDir!, ...args);
  };
}

/**
 * Creates a sample operation handler using the sample service
 */
export function createSampleOperationHandler(
  inMemorySettings: Record<string, unknown>,
  operationType: "add" | "delete" | "replace",
) {
  return async (
    _event: unknown,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath?: string,
    options?: { forceMono?: boolean; forceStereo?: boolean },
  ) => {
    try {
      let result: DbResult<unknown>;

      switch (operationType) {
        case "add":
          if (!filePath) {
            return {
              error: "File path required for add operation",
              success: false,
            };
          }
          result = sampleService.addSampleToSlot(
            inMemorySettings,
            kitName,
            voiceNumber,
            slotNumber,
            filePath,
            options,
          );
          break;

        case "delete":
          result = sampleService.deleteSampleFromSlot(
            inMemorySettings,
            kitName,
            voiceNumber,
            slotNumber,
          );
          break;

        case "replace":
          if (!filePath) {
            return {
              error: "File path required for replace operation",
              success: false,
            };
          }
          result = sampleService.replaceSampleInSlot(
            inMemorySettings,
            kitName,
            voiceNumber,
            slotNumber,
            filePath,
            options,
          );
          break;

        default:
          return { error: "Unknown operation type", success: false };
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        error: `Failed to perform sample operation: ${errorMessage}`,
        success: false,
      };
    }
  };
}

/**
 * Validates local store path and returns database directory
 * Checks environment variable override first, then settings
 */
export function validateAndGetDbDir(
  inMemorySettings: Record<string, unknown>,
): {
  dbDir?: string;
  error?: string;
  success: boolean;
} {
  // Check environment override first, then settings
  const localStorePath =
    process.env.ROMPER_LOCAL_PATH || 
    (typeof inMemorySettings.localStorePath === 'string' ? inMemorySettings.localStorePath : undefined);
  if (!localStorePath || typeof localStorePath !== 'string') {
    return { error: "No local store path configured", success: false };
  }
  return { dbDir: path.join(localStorePath, ".romperdb"), success: true };
}

import { ipcMain } from "electron";
import * as path from "path";

import type {
  DbResult,
  Kit,
  NewKit,
  NewSample,
} from "../../shared/db/schema.js";
import { getAudioMetadata, validateSampleFormat } from "./audioUtils.js";
import {
  addKit,
  addSample,
  createRomperDbFile,
  deleteSamples,
  getAllBanks,
  getAllSamples,
  getKit,
  getKits,
  getKitSamples,
  updateKit,
  updateVoiceAlias,
} from "./db/romperDbCoreORM.js";
import { localStoreService } from "./services/localStoreService.js";
import { sampleService } from "./services/sampleService.js";
import { scanService } from "./services/scanService.js";
import { syncService } from "./services/syncService.js";

// Common validation and helper functions

/**
 * Validates local store path and returns database directory
 */
function validateAndGetDbDir(inMemorySettings: Record<string, any>): {
  success: boolean;
  dbDir?: string;
  error?: string;
} {
  const localStorePath = inMemorySettings.localStorePath;
  if (!localStorePath) {
    return { success: false, error: "No local store path configured" };
  }
  return { success: true, dbDir: path.join(localStorePath, ".romperdb") };
}

/**
 * Creates a wrapper for IPC handlers that require database directory validation
 */
function createDbHandler<T extends any[], R>(
  inMemorySettings: Record<string, any>,
  handler: (dbDir: string, ...args: T) => Promise<R> | R,
): (_event: any, ...args: T) => Promise<R> {
  return async (_event: any, ...args: T): Promise<R> => {
    const dbDirResult = validateAndGetDbDir(inMemorySettings);
    if (!dbDirResult.success) {
      return { success: false, error: dbDirResult.error } as R;
    }
    return handler(dbDirResult.dbDir!, ...args);
  };
}

/**
 * Creates a sample operation handler using the sample service
 */
function createSampleOperationHandler(
  inMemorySettings: Record<string, any>,
  operationType: "add" | "replace" | "delete",
) {
  return async (
    _event: any,
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
    filePath?: string,
    options?: { forceMono?: boolean; forceStereo?: boolean },
  ) => {
    try {
      let result: DbResult<any>;

      switch (operationType) {
        case "add":
          if (!filePath) {
            return {
              success: false,
              error: "File path required for add operation",
            };
          }
          result = await sampleService.addSampleToSlot(
            inMemorySettings,
            kitName,
            voiceNumber,
            slotIndex,
            filePath,
            options,
          );
          break;

        case "replace":
          if (!filePath) {
            return {
              success: false,
              error: "File path required for replace operation",
            };
          }
          result = await sampleService.replaceSampleInSlot(
            inMemorySettings,
            kitName,
            voiceNumber,
            slotIndex,
            filePath,
            options,
          );
          break;

        case "delete":
          result = await sampleService.deleteSampleFromSlot(
            inMemorySettings,
            kitName,
            voiceNumber,
            slotIndex,
          );
          break;

        default:
          return { success: false, error: "Unknown operation type" };
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to perform sample operation: ${errorMessage}`,
      };
    }
  };
}

export function registerDbIpcHandlers(inMemorySettings: Record<string, any>) {
  ipcMain.handle("create-romper-db", async (_event, dbDir: string) => {
    return createRomperDbFile(dbDir);
  });

  ipcMain.handle("insert-kit", async (_event, dbDir: string, kit: NewKit) => {
    return addKit(dbDir, kit);
  });

  ipcMain.handle(
    "insert-sample",
    async (_event, dbDir: string, sample: NewSample) => {
      return addSample(dbDir, sample);
    },
  );

  ipcMain.handle(
    "get-kit",
    createDbHandler(inMemorySettings, (dbDir: string, kitName: string) => {
      return getKit(dbDir, kitName);
    }),
  );

  ipcMain.handle(
    "update-kit-metadata",
    createDbHandler(
      inMemorySettings,
      (
        dbDir: string,
        kitName: string,
        updates: {
          alias?: string;
          artist?: string;
          tags?: string[];
          description?: string;
        },
      ) => {
        return updateKit(dbDir, kitName, updates);
      },
    ),
  );

  ipcMain.handle(
    "get-all-kits",
    createDbHandler(inMemorySettings, (dbDir: string) => {
      return getKits(dbDir);
    }),
  );

  ipcMain.handle(
    "update-voice-alias",
    createDbHandler(
      inMemorySettings,
      (
        dbDir: string,
        kitName: string,
        voiceNumber: number,
        voiceAlias: string,
      ) => {
        return updateVoiceAlias(dbDir, kitName, voiceNumber, voiceAlias);
      },
    ),
  );

  ipcMain.handle(
    "update-step-pattern",
    createDbHandler(
      inMemorySettings,
      (dbDir: string, kitName: string, stepPattern: number[][]) => {
        return updateKit(dbDir, kitName, { step_pattern: stepPattern });
      },
    ),
  );

  ipcMain.handle(
    "validate-local-store",
    async (_event, localStorePath?: string) => {
      const pathToValidate = localStorePath || inMemorySettings.localStorePath;
      if (!pathToValidate) {
        throw new Error("No local store path provided or configured");
      }
      return localStoreService.validateLocalStore(pathToValidate);
    },
  );

  ipcMain.handle(
    "validate-local-store-basic",
    async (_event, localStorePath?: string) => {
      const pathToValidate = localStorePath || inMemorySettings.localStorePath;
      if (!pathToValidate) {
        throw new Error("No local store path provided or configured");
      }
      return localStoreService.validateLocalStoreBasic(pathToValidate);
    },
  );

  ipcMain.handle("get-all-samples", async (_event, dbDir: string) => {
    return getAllSamples(dbDir);
  });

  ipcMain.handle(
    "get-all-samples-for-kit",
    createDbHandler(inMemorySettings, (dbDir: string, kitName: string) => {
      return getKitSamples(dbDir, kitName);
    }),
  );

  ipcMain.handle("rescan-kit", async (_event, kitName: string) => {
    return scanService.rescanKit(inMemorySettings, kitName);
  });

  ipcMain.handle(
    "delete-all-samples-for-kit",
    async (_event, dbDir: string, kitName: string) => {
      return deleteSamples(dbDir, kitName);
    },
  );

  // Bank operations
  ipcMain.handle(
    "get-all-banks",
    createDbHandler(inMemorySettings, (dbDir: string) => {
      return getAllBanks(dbDir);
    }),
  );

  ipcMain.handle("scan-banks", async (_event) => {
    return scanService.scanBanks(inMemorySettings);
  });

  ipcMain.handle(
    "add-sample-to-slot",
    createSampleOperationHandler(inMemorySettings, "add"),
  );

  ipcMain.handle(
    "replace-sample-in-slot",
    createSampleOperationHandler(inMemorySettings, "replace"),
  );

  ipcMain.handle(
    "delete-sample-from-slot",
    createSampleOperationHandler(inMemorySettings, "delete"),
  );

  ipcMain.handle("validate-sample-sources", async (_event, kitName: string) => {
    return sampleService.validateSampleSources(inMemorySettings, kitName);
  });

  // Audio format validation
  ipcMain.handle("get-audio-metadata", async (_event, filePath: string) => {
    return getAudioMetadata(filePath);
  });

  ipcMain.handle("validate-sample-format", async (_event, filePath: string) => {
    return validateSampleFormat(filePath);
  });

  // SD Card sync operations
  ipcMain.handle("generateSyncChangeSummary", async (_event) => {
    return syncService.generateChangeSummary(inMemorySettings);
  });

  ipcMain.handle(
    "startKitSync",
    async (
      _event,
      syncData: {
        filesToCopy: Array<{
          filename: string;
          sourcePath: string;
          destinationPath: string;
          operation: "copy" | "convert";
          kitName: string;
        }>;
        filesToConvert: Array<{
          filename: string;
          sourcePath: string;
          destinationPath: string;
          operation: "copy" | "convert";
          kitName: string;
        }>;
      },
    ) => {
      return syncService.startKitSync(inMemorySettings, syncData);
    },
  );

  ipcMain.handle("cancelKitSync", async (_event) => {
    syncService.cancelSync();
  });

  // Progress events are handled via webContents.send in syncService
  // No IPC handler needed for onSyncProgress as it's a renderer-side event listener
}

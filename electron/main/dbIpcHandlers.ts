import type { NewKit, NewSample } from "@romper/shared/db/schema.js";

// IMPORTANT: Drizzle ORM with better-sqlite3 is SYNCHRONOUS - do not use await with database operations
import { ipcMain } from "electron";

import { getAudioMetadata, validateSampleFormat } from "./audioUtils.js";
import { registerFavoritesIpcHandlers } from "./db/favoritesIpcHandlers.js";
import { createDbHandler } from "./db/ipcHandlerUtils.js";
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
  getKitsMetadata,
  updateKit,
  updateVoiceAlias,
} from "./db/romperDbCoreORM.js";
import { registerSampleIpcHandlers } from "./db/sampleIpcHandlers.js";
import { registerSyncIpcHandlers } from "./db/syncIpcHandlers.js";
import { localStoreService } from "./services/localStoreService.js";
import { scanService } from "./services/scanService.js";

export function registerDbIpcHandlers(
  inMemorySettings: Record<string, unknown>,
) {
  // Register all handler groups
  registerSampleIpcHandlers(inMemorySettings);
  registerSyncIpcHandlers(inMemorySettings);
  registerFavoritesIpcHandlers(inMemorySettings);

  // Basic database operations
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
          description?: string;
          tags?: string[];
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
    "get-kits-metadata",
    createDbHandler(inMemorySettings, (dbDir: string) => {
      return getKitsMetadata(dbDir);
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
    "update-kit-bpm",
    createDbHandler(
      inMemorySettings,
      (dbDir: string, kitName: string, bpm: number) => {
        return updateKit(dbDir, kitName, { bpm });
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
      // Check environment override first, then provided path, then settings
      const settingsPath = typeof inMemorySettings.localStorePath === 'string' 
        ? inMemorySettings.localStorePath 
        : undefined;
      const pathToValidate =
        process.env.ROMPER_LOCAL_PATH ||
        localStorePath ||
        settingsPath;
      if (!pathToValidate) {
        throw new Error("No local store path provided or configured");
      }
      return localStoreService.validateLocalStore(pathToValidate);
    },
  );

  ipcMain.handle(
    "validate-local-store-basic",
    async (_event, localStorePath?: string) => {
      // Check environment override first, then provided path, then settings
      const settingsPath = typeof inMemorySettings.localStorePath === 'string' 
        ? inMemorySettings.localStorePath 
        : undefined;
      const pathToValidate =
        process.env.ROMPER_LOCAL_PATH ||
        localStorePath ||
        settingsPath;
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

  ipcMain.handle("scan-banks", async () => {
    return scanService.scanBanks(inMemorySettings);
  });

  // Audio format validation
  ipcMain.handle("get-audio-metadata", async (_event, filePath: string) => {
    return getAudioMetadata(filePath);
  });

  ipcMain.handle("validate-sample-format", async (_event, filePath: string) => {
    return validateSampleFormat(filePath);
  });

  // Progress events are handled via webContents.send in syncService
  // No IPC handler needed for onSyncProgress as it's a renderer-side event listener
}

// DB-related IPC handlers for Romper (modular, testable)
import { ipcMain } from "electron";

import { KitRecord, SampleRecord } from "../../shared/dbTypesShared";
import {
  createRomperDbFile,
  deleteAllSamplesForKit,
  getAllKits,
  getAllSamples,
  getAllSamplesForKit,
  getKitByName,
  insertKitRecord,
  insertSampleRecord,
  rescanKitFromFilesystem,
  updateKitMetadata,
  updateStepPattern,
  updateVoiceAlias,
} from "./db/romperDbCore.js";
import { validateLocalStoreAgainstDb } from "./localStoreValidator.js";

export function registerDbIpcHandlers() {
  ipcMain.handle("create-romper-db", async (_event, dbDir: string) => {
    return createRomperDbFile(dbDir);
  });

  ipcMain.handle(
    "insert-kit",
    async (_event, dbDir: string, kit: KitRecord) => {
      return insertKitRecord(dbDir, kit);
    },
  );

  ipcMain.handle(
    "insert-sample",
    async (_event, dbDir: string, sample: SampleRecord) => {
      return insertSampleRecord(dbDir, sample);
    },
  );

  ipcMain.handle(
    "get-kit-metadata",
    async (_event, dbDir: string, kitName: string) => {
      return getKitByName(dbDir, kitName);
    },
  );

  ipcMain.handle(
    "update-kit-metadata",
    async (
      _event,
      dbDir: string,
      kitName: string,
      updates: {
        alias?: string;
        artist?: string;
        tags?: string[];
        description?: string;
      },
    ) => {
      return updateKitMetadata(dbDir, kitName, updates);
    },
  );

  ipcMain.handle("get-all-kits", async (_event, dbDir: string) => {
    return getAllKits(dbDir);
  });

  ipcMain.handle(
    "update-voice-alias",
    async (
      _event,
      dbDir: string,
      kitName: string,
      voiceNumber: number,
      voiceAlias: string,
    ) => {
      return updateVoiceAlias(dbDir, kitName, voiceNumber, voiceAlias);
    },
  );

  ipcMain.handle(
    "update-step-pattern",
    async (_event, dbDir: string, kitName: string, stepPattern: number[][]) => {
      return updateStepPattern(dbDir, kitName, stepPattern);
    },
  );

  ipcMain.handle(
    "validate-local-store",
    async (_event, localStorePath: string) => {
      return validateLocalStoreAgainstDb(localStorePath);
    },
  );

  ipcMain.handle("get-all-samples", async (_event, dbDir: string) => {
    return getAllSamples(dbDir);
  });

  ipcMain.handle(
    "get-all-samples-for-kit",
    async (_event, dbDir: string, kitName: string) => {
      return getAllSamplesForKit(dbDir, kitName);
    },
  );

  ipcMain.handle(
    "rescan-kit",
    async (_event, dbDir: string, localStorePath: string, kitName: string) => {
      return rescanKitFromFilesystem(dbDir, localStorePath, kitName);
    },
  );

  ipcMain.handle(
    "delete-all-samples-for-kit",
    async (_event, dbDir: string, kitName: string) => {
      return deleteAllSamplesForKit(dbDir, kitName);
    },
  );
}

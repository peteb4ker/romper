// DB-related IPC handlers for Romper (modular, testable)
import { ipcMain } from "electron";

import {
  createRomperDbFile,
  getAllKits,
  getKitByName,
  insertKitRecord,
  insertSampleRecord,
  updateKitMetadata,
  updateStepPattern,
  updateVoiceAlias,
} from "./db/romperDbCore.js";

export function registerDbIpcHandlers() {
  ipcMain.handle("create-romper-db", async (_event, dbDir: string) => {
    return createRomperDbFile(dbDir);
  });

  ipcMain.handle(
    "insert-kit",
    async (
      _event,
      dbDir: string,
      kit: {
        name: string;
        alias?: string;
        artist?: string;
        plan_enabled: boolean;
      },
    ) => {
      return insertKitRecord(dbDir, kit);
    },
  );

  ipcMain.handle(
    "insert-sample",
    async (
      _event,
      dbDir: string,
      sample: {
        kit_name: string;
        filename: string;
        voice_number: number;
        slot_number: number;
        is_stereo: boolean;
        wav_bitrate?: number;
        wav_sample_rate?: number;
      },
    ) => {
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
}

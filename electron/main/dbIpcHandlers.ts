import { ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";

import type { Kit, NewKit, NewSample } from "../../shared/db/schema.js";
import {
  addKit,
  addSample,
  createRomperDbFile,
  deleteSamples,
  getAllSamples,
  getKit,
  getKits,
  getKitSamples as getAllSamplesForKit,
  updateKit,
  updateVoiceAlias,
} from "./db/romperDbCoreORM.js";
import { validateLocalStoreAgainstDb } from "./localStoreValidator.js";

export function registerDbIpcHandlers() {
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
    "get-kit-metadata",
    async (_event, dbDir: string, kitName: string) => {
      return getKit(dbDir, kitName);
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
      return updateKit(dbDir, kitName, updates);
    },
  );

  ipcMain.handle("get-all-kits", async (_event, dbDir: string) => {
    return getKits(dbDir);
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
      return updateKit(dbDir, kitName, { step_pattern: stepPattern });
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
      // Step 1: Delete all existing samples for this kit
      const deleteResult = deleteSamples(dbDir, kitName);
      if (!deleteResult.success) {
        return deleteResult;
      }

      // Step 2: Scan kit directory for current WAV files
      const kitPath = path.join(localStorePath, kitName);
      if (!fs.existsSync(kitPath)) {
        return { success: false, error: `Kit directory not found: ${kitPath}` };
      }

      let scannedSamples = 0;
      try {
        const files = fs.readdirSync(kitPath);
        const wavFiles = files.filter((file) =>
          file.toLowerCase().endsWith(".wav"),
        );

        // Step 3: Insert new sample records for found files
        for (let i = 0; i < wavFiles.length; i++) {
          const wavFile = wavFiles[i];

          // Simple heuristic: distribute files across 4 voices by index
          const voiceNumber = (i % 4) + 1;

          // Determine if stereo based on filename patterns
          const isStereo = /stereo|st|_s\.|_S\./i.test(wavFile);

          // Create sample record using ORM
          const samplePath = path.join(kitPath, wavFile);
          const sampleRecord: NewSample = {
            kit_name: kitName,
            filename: wavFile,
            voice_number: voiceNumber,
            slot_number: Math.floor(i / 4) + 1, // Multiple samples per voice go in different slots
            source_path: samplePath,
            is_stereo: isStereo,
          };

          const insertResult = addSample(dbDir, sampleRecord);
          if (!insertResult.success) {
            return insertResult;
          }

          scannedSamples++;
        }

        // Return success with scan results
        return {
          success: true,
          data: { scannedSamples, updatedVoices: 0 },
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to scan kit directory: ${errorMessage}`,
        };
      }
    },
  );

  ipcMain.handle(
    "delete-all-samples-for-kit",
    async (_event, dbDir: string, kitName: string) => {
      return deleteSamples(dbDir, kitName);
    },
  );
}

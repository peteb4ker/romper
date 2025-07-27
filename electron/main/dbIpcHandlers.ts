import { ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";

import type { Kit, NewKit, NewSample } from "../../shared/db/schema.js";
import { groupSamplesByVoice } from "../../shared/kitUtilsShared.js";
import {
  addKit,
  addSample,
  createRomperDbFile,
  deleteSamples,
  getAllBanks,
  getAllSamples,
  getKit,
  getKits,
  getKitSamples as getAllSamplesForKit,
  updateBank,
  updateKit,
  updateVoiceAlias,
} from "./db/romperDbCoreORM.js";
import {
  validateLocalStoreAgainstDb,
  validateLocalStoreBasic,
} from "./localStoreValidator.js";

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

  ipcMain.handle("get-kit-metadata", async (_event, kitName: string) => {
    const localStorePath = inMemorySettings.localStorePath;
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }
    const dbDir = path.join(localStorePath, ".romperdb");
    return getKit(dbDir, kitName);
  });

  ipcMain.handle(
    "update-kit-metadata",
    async (
      _event,
      kitName: string,
      updates: {
        alias?: string;
        artist?: string;
        tags?: string[];
        description?: string;
      },
    ) => {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath) {
        return { success: false, error: "No local store path configured" };
      }
      const dbDir = path.join(localStorePath, ".romperdb");
      return updateKit(dbDir, kitName, updates);
    },
  );

  ipcMain.handle("get-all-kits", async (_event) => {
    const localStorePath = inMemorySettings.localStorePath;
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }
    const dbDir = path.join(localStorePath, ".romperdb");
    return getKits(dbDir);
  });

  ipcMain.handle(
    "update-voice-alias",
    async (
      _event,
      kitName: string,
      voiceNumber: number,
      voiceAlias: string,
    ) => {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath) {
        return { success: false, error: "No local store path configured" };
      }
      const dbDir = path.join(localStorePath, ".romperdb");
      return updateVoiceAlias(dbDir, kitName, voiceNumber, voiceAlias);
    },
  );

  ipcMain.handle(
    "update-step-pattern",
    async (_event, kitName: string, stepPattern: number[][]) => {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath) {
        return { success: false, error: "No local store path configured" };
      }
      const dbDir = path.join(localStorePath, ".romperdb");
      return updateKit(dbDir, kitName, { step_pattern: stepPattern });
    },
  );

  ipcMain.handle(
    "validate-local-store",
    async (_event, localStorePath: string) => {
      return validateLocalStoreAgainstDb(localStorePath);
    },
  );

  ipcMain.handle(
    "validate-local-store-basic",
    async (_event, localStorePath: string) => {
      return validateLocalStoreBasic(localStorePath);
    },
  );

  ipcMain.handle("get-all-samples", async (_event, dbDir: string) => {
    return getAllSamples(dbDir);
  });

  ipcMain.handle("get-all-samples-for-kit", async (_event, kitName: string) => {
    const localStorePath = inMemorySettings.localStorePath;
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }
    const dbDir = path.join(localStorePath, ".romperdb");
    return getAllSamplesForKit(dbDir, kitName);
  });

  ipcMain.handle("rescan-kit", async (_event, kitName: string) => {
    const localStorePath = inMemorySettings.localStorePath;
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }
    const dbDir = path.join(localStorePath, ".romperdb");
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

      // Step 3: Group samples by voice using filename prefix parsing
      const groupedSamples = groupSamplesByVoice(wavFiles);
      
      // Step 4: Insert new sample records for found files
      for (const [voiceNumber, voiceFiles] of Object.entries(groupedSamples)) {
        const voice = parseInt(voiceNumber, 10);
        
        for (let slotIndex = 0; slotIndex < voiceFiles.length; slotIndex++) {
          const wavFile = voiceFiles[slotIndex];
          
          // Determine if stereo based on filename patterns
          const isStereo = /stereo|st|_s\.|_S\./i.test(wavFile);

          // Create sample record using ORM
          const samplePath = path.join(kitPath, wavFile);
          const sampleRecord: NewSample = {
            kit_name: kitName,
            filename: wavFile,
            voice_number: voice,
            slot_number: slotIndex + 1, // Slots are 1-indexed within each voice
            source_path: samplePath,
            is_stereo: isStereo,
          };

          const insertResult = addSample(dbDir, sampleRecord);
          if (!insertResult.success) {
            return insertResult;
          }

          scannedSamples++;
        }
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
  });

  ipcMain.handle(
    "delete-all-samples-for-kit",
    async (_event, dbDir: string, kitName: string) => {
      return deleteSamples(dbDir, kitName);
    },
  );

  // Bank operations
  ipcMain.handle("get-all-banks", async (_event) => {
    const localStorePath = inMemorySettings.localStorePath;
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }
    const dbDir = path.join(localStorePath, ".romperdb");
    return getAllBanks(dbDir);
  });

  ipcMain.handle("scan-banks", async (_event) => {
    const localStorePath = inMemorySettings.localStorePath;
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }
    const dbDir = path.join(localStorePath, ".romperdb");
    try {
      // Scan local store root for RTF files matching "A - Artist Name.rtf" pattern
      if (!fs.existsSync(localStorePath)) {
        return {
          success: false,
          error: `Local store path not found: ${localStorePath}`,
        };
      }

      const files = fs.readdirSync(localStorePath);
      const rtfFiles = files.filter((file) => /^[A-Z] - .+\.rtf$/i.test(file));

      let updatedBanks = 0;
      const scannedAt = new Date();

      for (const rtfFile of rtfFiles) {
        // Extract bank letter and artist name from filename
        const match = /^([A-Z]) - (.+)\.rtf$/i.exec(rtfFile);
        if (match) {
          const bankLetter = match[1].toUpperCase();
          const artistName = match[2];

          // Update bank in database
          const updateResult = updateBank(dbDir, bankLetter, {
            artist: artistName,
            rtf_filename: rtfFile,
            scanned_at: scannedAt,
          });

          if (updateResult.success) {
            updatedBanks++;
          }
        }
      }

      return {
        success: true,
        data: {
          scannedFiles: rtfFiles.length,
          updatedBanks,
          scannedAt,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to scan banks: ${errorMessage}`,
      };
    }
  });
}

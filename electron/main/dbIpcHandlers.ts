import { ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";

import type {
  DbResult,
  Kit,
  NewKit,
  NewSample,
} from "../../shared/db/schema.js";
import {
  groupSamplesByVoice,
  inferVoiceTypeFromFilename,
} from "../../shared/kitUtilsShared.js";
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
  markKitAsModified,
  updateBank,
  updateKit,
  updateVoiceAlias,
} from "./db/romperDbCoreORM.js";
import {
  validateLocalStoreAgainstDb,
  validateLocalStoreBasic,
} from "./localStoreValidator.js";

/**
 * Task 5.2.5: Enhanced file validation for sample operations
 * Validates file existence, format, and basic WAV file integrity
 */
function validateSampleFile(filePath: string): {
  isValid: boolean;
  error?: string;
} {
  // Check file existence
  if (!fs.existsSync(filePath)) {
    return { isValid: false, error: "Sample file not found" };
  }

  // Check file extension
  if (!filePath.toLowerCase().endsWith(".wav")) {
    return { isValid: false, error: "Only WAV files are supported" };
  }

  try {
    // Check file is readable and has minimum size for WAV header
    const stats = fs.statSync(filePath);
    if (stats.size < 44) {
      return { isValid: false, error: "File too small to be a valid WAV file" };
    }

    // Read first 12 bytes to validate WAV header
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(12);
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // Check RIFF signature
    if (buffer.toString("ascii", 0, 4) !== "RIFF") {
      return {
        isValid: false,
        error: "Invalid WAV file: missing RIFF signature",
      };
    }

    // Check WAVE format
    if (buffer.toString("ascii", 8, 12) !== "WAVE") {
      return {
        isValid: false,
        error: "Invalid WAV file: missing WAVE format identifier",
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to validate file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
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

  ipcMain.handle("get-kit", async (_event, kitName: string) => {
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
    async (_event, localStorePath?: string) => {
      const pathToValidate = localStorePath || inMemorySettings.localStorePath;
      if (!pathToValidate) {
        throw new Error("No local store path provided or configured");
      }
      return validateLocalStoreAgainstDb(pathToValidate);
    },
  );

  ipcMain.handle(
    "validate-local-store-basic",
    async (_event, localStorePath?: string) => {
      const pathToValidate = localStorePath || inMemorySettings.localStorePath;
      if (!pathToValidate) {
        throw new Error("No local store path provided or configured");
      }
      return validateLocalStoreBasic(pathToValidate);
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
    return getKitSamples(dbDir, kitName);
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

      // Step 5: Run voice inference on the grouped samples
      let updatedVoices = 0;
      for (const [voiceNumber, voiceFiles] of Object.entries(groupedSamples)) {
        const voice = parseInt(voiceNumber, 10);

        if (voiceFiles.length > 0) {
          // Infer voice type from the first file in the voice
          const firstFile = voiceFiles[0];
          const inferredType = inferVoiceTypeFromFilename(firstFile);

          if (inferredType) {
            // Update the voice alias in the database
            const updateResult = updateVoiceAlias(
              dbDir,
              kitName,
              voice,
              inferredType,
            );
            if (updateResult.success) {
              updatedVoices++;
            }
          }
        }
      }

      // Return success with scan results
      return {
        success: true,
        data: { scannedSamples, updatedVoices },
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

  // Task 5.2.2 & 5.2.3: Sample management operations for drag-and-drop editing
  ipcMain.handle(
    "add-sample-to-slot",
    async (
      _event,
      kitName: string,
      voiceNumber: number,
      slotIndex: number,
      filePath: string,
    ) => {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath) {
        return { success: false, error: "No local store path configured" };
      }
      const dbDir = path.join(localStorePath, ".romperdb");

      try {
        // Task 5.2.4: Validate voice number (1-4)
        if (voiceNumber < 1 || voiceNumber > 4) {
          return {
            success: false,
            error: "Voice number must be between 1 and 4",
          };
        }

        // Task 5.2.4: Validate slot index (0-11 for 12 slots total, converted to 1-12 for storage)
        if (slotIndex < 0 || slotIndex > 11) {
          return {
            success: false,
            error: "Slot index must be between 0 and 11 (12 slots per voice)",
          };
        }

        // Task 5.2.5: Enhanced file validation during operations
        const fileValidation = validateSampleFile(filePath);
        if (!fileValidation.isValid) {
          return { success: false, error: fileValidation.error };
        }

        // Create sample record
        const filename = path.basename(filePath);
        const isStereo = /stereo|st|_s\.|_S\./i.test(filename);

        const sampleRecord: NewSample = {
          kit_name: kitName,
          filename,
          voice_number: voiceNumber,
          slot_number: slotIndex + 1, // Convert 0-based to 1-based
          source_path: filePath,
          is_stereo: isStereo,
        };

        const addResult = addSample(dbDir, sampleRecord);
        if (addResult.success) {
          // Task 5.3.1: Mark kit as modified when sample is added
          markKitAsModified(dbDir, kitName);
        }
        return addResult;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to add sample: ${errorMessage}`,
        };
      }
    },
  );

  ipcMain.handle(
    "replace-sample-in-slot",
    async (
      _event,
      kitName: string,
      voiceNumber: number,
      slotIndex: number,
      filePath: string,
    ) => {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath) {
        return { success: false, error: "No local store path configured" };
      }
      const dbDir = path.join(localStorePath, ".romperdb");

      try {
        // Task 5.2.4: Validate voice number (1-4)
        if (voiceNumber < 1 || voiceNumber > 4) {
          return {
            success: false,
            error: "Voice number must be between 1 and 4",
          };
        }

        // Task 5.2.4: Validate slot index (0-11 for 12 slots total, converted to 1-12 for storage)
        if (slotIndex < 0 || slotIndex > 11) {
          return {
            success: false,
            error: "Slot index must be between 0 and 11 (12 slots per voice)",
          };
        }

        // Task 5.2.5: Enhanced file validation during operations
        const fileValidation = validateSampleFile(filePath);
        if (!fileValidation.isValid) {
          return { success: false, error: fileValidation.error };
        }

        // First delete existing sample at this slot
        const deleteResult = deleteSamples(dbDir, kitName, {
          voiceNumber,
          slotNumber: slotIndex + 1,
        });
        if (!deleteResult.success) {
          return deleteResult;
        }

        // Then add new sample
        const filename = path.basename(filePath);
        const isStereo = /stereo|st|_s\.|_S\./i.test(filename);

        const sampleRecord: NewSample = {
          kit_name: kitName,
          filename,
          voice_number: voiceNumber,
          slot_number: slotIndex + 1,
          source_path: filePath,
          is_stereo: isStereo,
        };

        const replaceResult = addSample(dbDir, sampleRecord);
        if (replaceResult.success) {
          // Task 5.3.1: Mark kit as modified when sample is replaced
          markKitAsModified(dbDir, kitName);
        }
        return replaceResult;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to replace sample: ${errorMessage}`,
        };
      }
    },
  );

  ipcMain.handle(
    "delete-sample-from-slot",
    async (_event, kitName: string, voiceNumber: number, slotIndex: number) => {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath) {
        return { success: false, error: "No local store path configured" };
      }
      const dbDir = path.join(localStorePath, ".romperdb");

      try {
        // Task 5.2.4: Validate voice number (1-4)
        if (voiceNumber < 1 || voiceNumber > 4) {
          return {
            success: false,
            error: "Voice number must be between 1 and 4",
          };
        }

        // Task 5.2.4: Validate slot index (0-11 for 12 slots total, converted to 1-12 for storage)
        if (slotIndex < 0 || slotIndex > 11) {
          return {
            success: false,
            error: "Slot index must be between 0 and 11 (12 slots per voice)",
          };
        }

        const deleteResult = deleteSamples(dbDir, kitName, {
          voiceNumber,
          slotNumber: slotIndex + 1, // Convert 0-based to 1-based
        });
        if (deleteResult.success) {
          // Task 5.3.1: Mark kit as modified when sample is deleted
          markKitAsModified(dbDir, kitName);
        }
        return deleteResult;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to delete sample: ${errorMessage}`,
        };
      }
    },
  );

  // Task 5.2.5: Validate source_path files for existing samples
  ipcMain.handle("validate-sample-sources", async (_event, kitName: string) => {
    const localStorePath = inMemorySettings.localStorePath;
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }
    const dbDir = path.join(localStorePath, ".romperdb");

    try {
      const samplesResult = getKitSamples(dbDir, kitName);
      if (!samplesResult.success) {
        return samplesResult;
      }

      const samples = samplesResult.data || [];
      const invalidSamples: Array<{
        filename: string;
        source_path: string;
        error: string;
      }> = [];

      for (const sample of samples) {
        if (sample.source_path) {
          const validation = validateSampleFile(sample.source_path);
          if (!validation.isValid) {
            invalidSamples.push({
              filename: sample.filename,
              source_path: sample.source_path,
              error: validation.error || "Unknown validation error",
            });
          }
        }
      }

      return {
        success: true,
        data: {
          totalSamples: samples.length,
          invalidSamples,
          validSamples: samples.length - invalidSamples.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to validate sample sources: ${errorMessage}`,
      };
    }
  });
}

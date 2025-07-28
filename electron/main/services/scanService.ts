import * as fs from "fs";
import * as path from "path";

import type { DbResult, NewSample } from "../../../shared/db/schema.js";
import {
  groupSamplesByVoice,
  inferVoiceTypeFromFilename,
} from "../../../shared/kitUtilsShared.js";
import {
  addSample,
  deleteSamples,
  updateBank,
  updateVoiceAlias,
} from "../db/romperDbCoreORM.js";

/**
 * Service for scanning operations (kit rescanning and bank scanning)
 * Extracted from dbIpcHandlers.ts to separate business logic from IPC routing
 */
export class ScanService {
  private getLocalStorePath(
    inMemorySettings: Record<string, any>,
  ): string | null {
    return inMemorySettings.localStorePath || null;
  }

  private getDbPath(localStorePath: string): string {
    return path.join(localStorePath, ".romperdb");
  }

  /**
   * Rescan a kit directory and update the database with current WAV files
   * This is a complex operation that:
   * 1. Deletes existing sample records
   * 2. Scans filesystem for WAV files
   * 3. Groups samples by voice
   * 4. Creates new sample records
   * 5. Infers voice types from filenames
   */
  async rescanKit(
    inMemorySettings: Record<string, any>,
    kitName: string,
  ): Promise<
    DbResult<{
      scannedSamples: number;
      updatedVoices: number;
    }>
  > {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbDir = this.getDbPath(localStorePath);

    try {
      // Step 1: Delete all existing samples for this kit
      const deleteResult = deleteSamples(dbDir, kitName);
      if (!deleteResult.success) {
        return deleteResult;
      }

      // Step 2: Scan kit directory for current WAV files
      const kitPath = path.join(localStorePath, kitName);
      if (!fs.existsSync(kitPath)) {
        return {
          success: false,
          error: `Kit directory not found: ${kitPath}`,
        };
      }

      let scannedSamples = 0;

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
  }

  /**
   * Scan local store for bank RTF files and update database
   * Looks for files matching "A - Artist Name.rtf" pattern
   */
  async scanBanks(inMemorySettings: Record<string, any>): Promise<
    DbResult<{
      scannedFiles: number;
      updatedBanks: number;
      scannedAt: Date;
    }>
  > {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbDir = this.getDbPath(localStorePath);

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
  }
}

// Export singleton instance
export const scanService = new ScanService();

import type { DbResult, NewSample } from "@romper/shared/db/schema.js";

import {
  groupSamplesByVoice,
  inferVoiceTypeFromFilename,
} from "@romper/shared/kitUtilsShared.js";
// No spaced slot utilities needed - using 0-11 indexing directly
import * as fs from "fs";
import * as path from "path";

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
    inMemorySettings: Record<string, unknown>,
    kitName: string,
  ): Promise<
    DbResult<{
      scannedSamples: number;
      updatedVoices: number;
    }>
  > {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbDir = this.getDbPath(localStorePath);

    try {
      // Step 1: Delete all existing samples for this kit
      const deleteResult = deleteSamples(dbDir, kitName);
      if (!deleteResult.success) {
        return { error: deleteResult.error, success: false };
      }

      // Step 2: Scan kit directory for current WAV files
      const kitPath = path.join(localStorePath, kitName);
      if (!fs.existsSync(kitPath)) {
        return {
          error: `Kit directory not found: ${kitPath}`,
          success: false,
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
        const processResult = this.processSamplesForVoice(
          dbDir,
          kitName,
          kitPath,
          voice,
          voiceFiles,
        );

        if (!processResult.success) {
          return { error: processResult.error, success: false };
        }

        scannedSamples += processResult.data || 0;
      }

      // Step 5: Run voice inference on the grouped samples
      const updatedVoices = this.updateVoiceAliases(
        dbDir,
        kitName,
        groupedSamples,
      );

      // Return success with scan results
      return {
        data: { scannedSamples, updatedVoices },
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        error: `Failed to scan kit directory: ${errorMessage}`,
        success: false,
      };
    }
  }

  /**
   * Scan local store for bank RTF files and update database
   * Looks for files matching "A - Artist Name.rtf" pattern
   */
  async scanBanks(inMemorySettings: Record<string, unknown>): Promise<
    DbResult<{
      scannedAt: Date;
      scannedFiles: number;
      updatedBanks: number;
    }>
  > {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbDir = this.getDbPath(localStorePath);

    try {
      // Scan local store root for RTF files matching "A - Artist Name.rtf" pattern
      if (!fs.existsSync(localStorePath)) {
        return {
          error: `Local store path not found: ${localStorePath}`,
          success: false,
        };
      }

      const files = fs.readdirSync(localStorePath);
      const rtfFiles = files.filter((file) =>
        /^\p{Lu} - .+\.rtf$/iu.test(file),
      );

      let updatedBanks = 0;
      const scannedAt = new Date();

      for (const rtfFile of rtfFiles) {
        // Extract bank letter and artist name from filename
        const match = /^(\p{Lu}) - (.+)\.rtf$/iu.exec(rtfFile);
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
        data: {
          scannedAt,
          scannedFiles: rtfFiles.length,
          updatedBanks,
        },
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        error: `Failed to scan banks: ${errorMessage}`,
        success: false,
      };
    }
  }

  private getDbPath(localStorePath: string): string {
    return path.join(localStorePath, ".romperdb");
  }

  private getLocalStorePath(
    inMemorySettings: Record<string, unknown>,
  ): null | string {
    const path = inMemorySettings.localStorePath;
    return typeof path === 'string' ? path : null;
  }

  /**
   * Helper method to process and insert samples for a voice
   */
  private processSamplesForVoice(
    dbDir: string,
    kitName: string,
    kitPath: string,
    voice: number,
    voiceFiles: string[],
  ): DbResult<number> {
    let samplesProcessed = 0;

    for (let slotNumber = 0; slotNumber < voiceFiles.length; slotNumber++) {
      const wavFile = voiceFiles[slotNumber]; // Array is 0-based, slot is 0-based
      const isStereo = /stereo|st|_s\.|_S\./i.test(wavFile);
      const samplePath = path.join(kitPath, wavFile);

      const sampleRecord: NewSample = {
        filename: wavFile,
        is_stereo: isStereo,
        kit_name: kitName,
        slot_number: slotNumber, // ZERO-BASED: 0-11 (UI shows 1-12, DB stores 0-11)
        source_path: samplePath,
        voice_number: voice,
      };

      const insertResult = addSample(dbDir, sampleRecord);
      if (!insertResult.success) {
        return { error: insertResult.error, success: false };
      }

      samplesProcessed++;
    }

    return { data: samplesProcessed, success: true };
  }

  /**
   * Helper method to update voice aliases based on filename inference
   */
  private updateVoiceAliases(
    dbDir: string,
    kitName: string,
    groupedSamples: { [voice: number]: string[] },
  ): number {
    let updatedVoices = 0;

    for (const [voiceNumber, voiceFiles] of Object.entries(groupedSamples)) {
      const voice = parseInt(voiceNumber, 10);

      if (voiceFiles.length > 0) {
        const firstFile = voiceFiles[0];
        const inferredType = inferVoiceTypeFromFilename(firstFile);

        if (inferredType) {
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

    return updatedVoices;
  }
}

// Export singleton instance
export const scanService = new ScanService();

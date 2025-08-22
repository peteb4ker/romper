import type { DbResult, NewSample } from "@romper/shared/db/schema.js";

import {
  groupSamplesByVoice,
  inferVoiceTypeFromFilename,
} from "@romper/shared/kitUtilsShared.js";
// No spaced slot utilities needed - using 0-11 indexing directly
import * as fs from "fs";
import * as path from "path";

import { getAudioMetadata } from "../audioUtils.js";
import {
  addSample,
  deleteSamples,
  updateBank,
  updateSampleMetadata,
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
   * Rescan all kits that have samples with missing WAV metadata
   * This is useful for migrating existing kits after the metadata feature was added
   */
  async rescanKitsWithMissingMetadata(
    inMemorySettings: Record<string, unknown>,
  ): Promise<
    DbResult<{
      kitsNeedingRescan: string[];
      kitsRescanned: string[];
      totalSamplesUpdated: number;
    }>
  > {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbDir = this.getDbPath(localStorePath);

    try {
      // First, find all kits that have samples with missing metadata
      const kitsNeedingRescan: string[] = [];

      // Import the necessary functions to query the database
      const { getAllSamples } = await import("../db/romperDbCoreORM.js");

      const samplesResult = getAllSamples(dbDir);
      if (!samplesResult.success || !samplesResult.data) {
        return { error: "Failed to query samples", success: false };
      }

      // Group kits by whether they have missing metadata
      const kitMetadataStatus = new Map<string, boolean>();
      for (const sample of samplesResult.data) {
        if (!kitMetadataStatus.has(sample.kit_name)) {
          kitMetadataStatus.set(sample.kit_name, false);
        }
        // If any sample is missing metadata, mark the kit as needing rescan
        if (
          sample.wav_sample_rate === null ||
          sample.wav_bit_depth === null ||
          sample.wav_channels === null
        ) {
          kitMetadataStatus.set(sample.kit_name, true);
        }
      }

      // Get list of kits that need rescanning
      for (const [kitName, needsRescan] of kitMetadataStatus) {
        if (needsRescan) {
          kitsNeedingRescan.push(kitName);
        }
      }

      // Rescan each kit that needs metadata
      const kitsRescanned: string[] = [];
      let totalSamplesUpdated = 0;

      for (const kitName of kitsNeedingRescan) {
        const rescanResult = await this.rescanKit(inMemorySettings, kitName);
        if (rescanResult.success && rescanResult.data) {
          kitsRescanned.push(kitName);
          totalSamplesUpdated += rescanResult.data.scannedSamples;
        } else {
          console.error(
            `Failed to rescan kit ${kitName}: ${rescanResult.error}`,
          );
        }
      }

      return {
        data: {
          kitsNeedingRescan,
          kitsRescanned,
          totalSamplesUpdated,
        },
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        error: `Failed to rescan kits with missing metadata: ${errorMessage}`,
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
    return typeof inMemorySettings.localStorePath === "string"
      ? inMemorySettings.localStorePath
      : null;
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

      // Extract and save WAV metadata for the newly created sample
      const metadataResult = getAudioMetadata(samplePath);
      if (metadataResult.success && metadataResult.data && insertResult.data) {
        const metadata = metadataResult.data;
        updateSampleMetadata(dbDir, insertResult.data.sampleId, {
          wav_bit_depth: metadata.bitDepth ?? null,
          wav_bitrate:
            metadata.sampleRate && metadata.channels && metadata.bitDepth
              ? metadata.sampleRate * metadata.channels * metadata.bitDepth
              : null,
          wav_channels: metadata.channels ?? null,
          wav_sample_rate: metadata.sampleRate ?? null,
        });
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

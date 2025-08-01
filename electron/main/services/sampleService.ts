import * as fs from "fs";
import * as path from "path";

import type { DbResult, NewSample, Sample } from "../../../shared/db/schema.js";
import { getErrorMessage } from "../../../shared/errorUtils.js";
import {
  addSample,
  deleteSamples,
  deleteSamplesWithoutCompaction,
  getKitSamples,
  markKitAsModified,
  moveSample,
} from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import {
  determineStereoConfiguration,
  type StereoOptions,
} from "../utils/stereoProcessingUtils.js";

/**
 * Service for sample validation and management operations
 * Extracted from dbIpcHandlers.ts to separate business logic from IPC routing
 */
export class SampleService {
  private getLocalStorePath(
    inMemorySettings: Record<string, any>,
  ): string | null {
    return ServicePathManager.getLocalStorePath(inMemorySettings);
  }

  private getDbPath(localStorePath: string): string {
    return ServicePathManager.getDbPath(localStorePath);
  }

  /**
   * Task 5.2.4: Validates voice number and slot index for sample operations
   * 12-slot limit per voice using voice_number field validation
   */
  validateVoiceAndSlot(
    voiceNumber: number,
    slotIndex: number,
  ): { isValid: boolean; error?: string } {
    // Validate voice number (1-4)
    if (voiceNumber < 1 || voiceNumber > 4) {
      return { isValid: false, error: "Voice number must be between 1 and 4" };
    }

    // Validate slot index (0-11 for 12 slots total, converted to 1-12 for storage)
    if (slotIndex < 0 || slotIndex > 11) {
      return {
        isValid: false,
        error: "Slot index must be between 0 and 11 (12 slots per voice)",
      };
    }

    return { isValid: true };
  }

  /**
   * Task 5.2.5: Enhanced file validation for sample operations
   * Validates file existence, format, and basic WAV file integrity
   */
  validateSampleFile(filePath: string): {
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
        return {
          isValid: false,
          error: "File too small to be a valid WAV file",
        };
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
        error: `Failed to validate file: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Add a sample to a specific voice slot
   */
  addSampleToSlot(
    inMemorySettings: Record<string, any>,
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
    filePath: string,
    options?: StereoOptions,
  ): DbResult<{ sampleId: number }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = this.validateVoiceAndSlot(
      voiceNumber,
      slotIndex,
    );
    if (!voiceSlotValidation.isValid) {
      return { success: false, error: voiceSlotValidation.error };
    }

    // Validate file
    const fileValidation = this.validateSampleFile(filePath);
    if (!fileValidation.isValid) {
      return { success: false, error: fileValidation.error };
    }

    try {
      // Create sample record
      const filename = path.basename(filePath);

      // Task 7.1.2 & 7.1.3: Apply 'default to mono samples' setting with per-sample override
      const isStereo = determineStereoConfiguration(
        filePath,
        inMemorySettings,
        options,
      );

      const sampleRecord: NewSample = {
        kit_name: kitName,
        filename,
        voice_number: voiceNumber,
        slot_number: slotIndex + 1, // Convert 0-based to 1-based
        source_path: filePath,
        is_stereo: isStereo,
      };

      // Check if there's an existing sample in this slot for conflict handling
      const existingSamplesResult = getKitSamples(dbPath, kitName);
      let _previousSample: Sample | undefined;

      if (existingSamplesResult.success && existingSamplesResult.data) {
        _previousSample = existingSamplesResult.data.find(
          (s) =>
            s.voice_number === voiceNumber && s.slot_number === slotIndex + 1,
        );
      }

      const result = addSample(dbPath, sampleRecord);

      // Mark kit as modified if operation succeeded
      if (result.success) {
        markKitAsModified(dbPath, kitName);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to add sample: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Replace a sample in a specific voice slot
   */
  replaceSampleInSlot(
    inMemorySettings: Record<string, any>,
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
    filePath: string,
    options?: StereoOptions,
  ): DbResult<{ sampleId: number }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = this.validateVoiceAndSlot(
      voiceNumber,
      slotIndex,
    );
    if (!voiceSlotValidation.isValid) {
      return { success: false, error: voiceSlotValidation.error };
    }

    // Validate file
    const fileValidation = this.validateSampleFile(filePath);
    if (!fileValidation.isValid) {
      return { success: false, error: fileValidation.error };
    }

    try {
      // Get the existing sample before replacing it
      const existingSamplesResult = getKitSamples(dbPath, kitName);
      let oldSample: Sample | undefined;

      if (existingSamplesResult.success && existingSamplesResult.data) {
        oldSample = existingSamplesResult.data.find(
          (s) =>
            s.voice_number === voiceNumber && s.slot_number === slotIndex + 1,
        );
      }

      // If no existing sample, this becomes an add operation
      if (!oldSample) {
        // Call addSampleToSlot instead
        return this.addSampleToSlot(
          inMemorySettings,
          kitName,
          voiceNumber,
          slotIndex,
          filePath,
          options,
        );
      }

      // First delete existing sample at this slot
      const deleteResult = deleteSamples(dbPath, kitName, {
        voiceNumber,
        slotNumber: slotIndex + 1,
      });
      if (!deleteResult.success) {
        return { success: false, error: deleteResult.error };
      }

      // Then add new sample
      const filename = path.basename(filePath);

      // Task 7.1.2 & 7.1.3: Apply 'default to mono samples' setting with per-sample override
      const isStereo = determineStereoConfiguration(
        filePath,
        inMemorySettings,
        options,
      );

      const sampleRecord: NewSample = {
        kit_name: kitName,
        filename,
        voice_number: voiceNumber,
        slot_number: slotIndex + 1,
        source_path: filePath,
        is_stereo: isStereo,
      };

      const result = addSample(dbPath, sampleRecord);

      // Mark kit as modified if operation succeeded
      if (result.success) {
        markKitAsModified(dbPath, kitName);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to replace sample: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Delete a sample from a specific voice slot WITHOUT automatic contiguity maintenance
   * Used for undo operations where we want precise control over slot positions
   */
  deleteSampleFromSlotWithoutCompaction(
    inMemorySettings: Record<string, any>,
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
  ): DbResult<{ deletedSamples: Sample[] }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = this.validateVoiceAndSlot(
      voiceNumber,
      slotIndex,
    );
    if (!voiceSlotValidation.isValid) {
      return { success: false, error: voiceSlotValidation.error };
    }

    try {
      // Delete WITHOUT automatic contiguity maintenance
      const deleteResult = deleteSamplesWithoutCompaction(dbPath, kitName, {
        voiceNumber,
        slotNumber: slotIndex + 1, // Convert 0-based to 1-based
      });

      // Mark kit as modified if operation succeeded
      if (deleteResult.success) {
        markKitAsModified(dbPath, kitName);
      }

      return deleteResult;
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete sample: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Delete a sample from a specific voice slot with automatic contiguity maintenance
   */
  deleteSampleFromSlot(
    inMemorySettings: Record<string, any>,
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
  ): DbResult<{ deletedSamples: Sample[]; affectedSamples: Sample[] }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = this.validateVoiceAndSlot(
      voiceNumber,
      slotIndex,
    );
    if (!voiceSlotValidation.isValid) {
      return { success: false, error: voiceSlotValidation.error };
    }

    try {
      // Get the sample before deleting it for validation
      const existingSamplesResult = getKitSamples(dbPath, kitName);
      let sampleExists = false;

      if (existingSamplesResult.success && existingSamplesResult.data) {
        sampleExists = existingSamplesResult.data.some(
          (s) =>
            s.voice_number === voiceNumber && s.slot_number === slotIndex + 1,
        );
      }

      if (!sampleExists) {
        return {
          success: false,
          error: `No sample found in voice ${voiceNumber}, slot ${slotIndex + 1} to delete`,
        };
      }

      // Delete with automatic contiguity maintenance
      const deleteResult = deleteSamples(dbPath, kitName, {
        voiceNumber,
        slotNumber: slotIndex + 1, // Convert 0-based to 1-based
      });

      // Mark kit as modified if operation succeeded
      if (deleteResult.success) {
        markKitAsModified(dbPath, kitName);
      }

      return deleteResult;
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete sample: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Task 5.2.5: Validate source_path files for existing samples
   */
  validateSampleSources(
    inMemorySettings: Record<string, any>,
    kitName: string,
  ): DbResult<{
    totalSamples: number;
    invalidSamples: Array<{
      filename: string;
      source_path: string;
      error: string;
    }>;
    validSamples: number;
  }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbPath = this.getDbPath(localStorePath);

    try {
      const samplesResult = getKitSamples(dbPath, kitName);
      if (!samplesResult.success) {
        return { success: false, error: samplesResult.error };
      }

      const samples = samplesResult.data || [];
      const invalidSamples: Array<{
        filename: string;
        source_path: string;
        error: string;
      }> = [];

      for (const sample of samples) {
        if (sample.source_path) {
          const validation = this.validateSampleFile(sample.source_path);
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
      return {
        success: false,
        error: `Failed to validate sample sources: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Get audio buffer for a specific sample by kit/voice/slot identifier
   */
  getSampleAudioBuffer(
    inMemorySettings: Record<string, any>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ): DbResult<ArrayBuffer | null> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbPath = this.getDbPath(localStorePath);

    try {
      // Get sample from database
      const samplesResult = getKitSamples(dbPath, kitName);

      if (!samplesResult.success || !samplesResult.data) {
        return {
          success: false,
          error: `Failed to get samples for kit ${kitName}`,
        };
      }

      // Find the specific sample
      const sample = samplesResult.data.find(
        (s: Sample) =>
          s.voice_number === voiceNumber && s.slot_number === slotNumber,
      );

      if (!sample) {
        // Return null for missing samples (empty slots)
        return { success: true, data: null };
      }

      // Read the file using the database-stored source_path
      const data = fs.readFileSync(sample.source_path);
      return {
        success: true,
        data: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read sample audio: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Move a sample from one slot to another with contiguity maintenance
   * Task 22.2: Cross-voice sample movement within same kit
   */
  moveSampleInKit(
    inMemorySettings: Record<string, any>,
    kitName: string,
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ): DbResult<{
    movedSample: Sample;
    affectedSamples: (Sample & { original_slot_number: number })[];
    replacedSample?: Sample;
  }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot for both source and destination
    const fromValidation = this.validateVoiceAndSlot(fromVoice, fromSlot);
    if (!fromValidation.isValid) {
      return { success: false, error: `Source ${fromValidation.error}` };
    }

    const toValidation = this.validateVoiceAndSlot(toVoice, toSlot);
    if (!toValidation.isValid) {
      return { success: false, error: `Destination ${toValidation.error}` };
    }

    // Prevent moving to the same location
    if (fromVoice === toVoice && fromSlot === toSlot) {
      return {
        success: false,
        error: "Cannot move sample to the same location",
      };
    }

    try {
      // Check for stereo conflicts
      const existingSamplesResult = getKitSamples(dbPath, kitName);
      if (existingSamplesResult.success && existingSamplesResult.data) {
        const sampleToMove = existingSamplesResult.data.find(
          (s) => s.voice_number === fromVoice && s.slot_number === fromSlot + 1,
        );

        if (!sampleToMove) {
          return {
            success: false,
            error: `No sample found at voice ${fromVoice}, slot ${fromSlot + 1}`,
          };
        }

        // Check for stereo conflicts if moving a stereo sample
        if (sampleToMove.is_stereo && toVoice === 4) {
          return {
            success: false,
            error:
              "Cannot move stereo sample to voice 4 (no adjacent voice available)",
          };
        }

        if (sampleToMove.is_stereo && mode === "insert") {
          // Check if destination+1 would conflict
          const conflictSample = existingSamplesResult.data.find(
            (s) =>
              s.voice_number === toVoice + 1 && s.slot_number === toSlot + 1,
          );
          if (conflictSample) {
            return {
              success: false,
              error: `Stereo sample move would conflict with sample in voice ${toVoice + 1}, slot ${toSlot + 1}`,
            };
          }
        }
      }

      // Perform the move with database-level contiguity maintenance
      const moveResult = moveSample(
        dbPath,
        kitName,
        fromVoice,
        fromSlot + 1, // Convert to 1-based
        toVoice,
        toSlot + 1, // Convert to 1-based
        mode,
      );

      // Mark kit as modified if operation succeeded
      if (moveResult.success) {
        markKitAsModified(dbPath, kitName);
      }

      return moveResult;
    } catch (error) {
      return {
        success: false,
        error: `Failed to move sample: ${getErrorMessage(error)}`,
      };
    }
  }

  /**
   * Move a sample from one kit to another with source compaction
   * Task: Cross-kit sample movement with gap prevention
   */
  moveSampleBetweenKits(
    inMemorySettings: Record<string, any>,
    fromKit: string,
    fromVoice: number,
    fromSlot: number,
    toKit: string,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ): DbResult<{
    movedSample: Sample;
    affectedSamples: (Sample & { original_slot_number: number })[];
    replacedSample?: Sample;
  }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { success: false, error: "No local store path configured" };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot for both source and destination
    const fromValidation = this.validateVoiceAndSlot(fromVoice, fromSlot);
    if (!fromValidation.isValid) {
      return { success: false, error: `Source ${fromValidation.error}` };
    }

    const toValidation = this.validateVoiceAndSlot(toVoice, toSlot);
    if (!toValidation.isValid) {
      return { success: false, error: `Destination ${toValidation.error}` };
    }

    try {
      // Get the sample to move from source kit
      const sourceSamplesResult = getKitSamples(dbPath, fromKit);
      if (!sourceSamplesResult.success || !sourceSamplesResult.data) {
        return { success: false, error: sourceSamplesResult.error };
      }

      const sampleToMove = sourceSamplesResult.data.find(
        (s) => s.voice_number === fromVoice && s.slot_number === fromSlot + 1,
      );

      if (!sampleToMove) {
        return {
          success: false,
          error: `No sample found at ${fromKit} voice ${fromVoice}, slot ${fromSlot + 1}`,
        };
      }

      // Check for stereo conflicts at destination
      if (sampleToMove.is_stereo && toVoice === 4) {
        return {
          success: false,
          error:
            "Cannot move stereo sample to voice 4 (no adjacent voice available)",
        };
      }

      // Get destination kit samples to check for conflicts and replacements
      const destSamplesResult = getKitSamples(dbPath, toKit);
      let destSamples: Sample[] = [];
      let replacedSample: Sample | undefined;

      if (destSamplesResult.success && destSamplesResult.data) {
        destSamples = destSamplesResult.data;

        if (mode === "overwrite") {
          replacedSample = destSamples.find(
            (s) => s.voice_number === toVoice && s.slot_number === toSlot + 1,
          );
        }
      }

      // For insert mode with stereo samples, check conflict with adjacent voice
      if (sampleToMove.is_stereo && mode === "insert") {
        const conflictSample = destSamples.find(
          (s) => s.voice_number === toVoice + 1 && s.slot_number === toSlot + 1,
        );
        if (conflictSample) {
          return {
            success: false,
            error: `Stereo sample move would conflict with sample in ${toKit} voice ${toVoice + 1}, slot ${toSlot + 1}`,
          };
        }
      }

      // Step 1: Add the sample to destination kit
      const addResult = this.addSampleToSlot(
        inMemorySettings,
        toKit,
        toVoice,
        toSlot,
        sampleToMove.source_path,
        {
          forceMono: !sampleToMove.is_stereo,
          forceStereo: sampleToMove.is_stereo,
        },
      );

      if (!addResult.success) {
        return {
          success: false,
          error: `Failed to add sample to destination: ${addResult.error}`,
        };
      }

      // Step 2: Delete the sample from source kit (with compaction)
      const deleteResult = this.deleteSampleFromSlot(
        inMemorySettings,
        fromKit,
        fromVoice,
        fromSlot,
      );

      if (!deleteResult.success) {
        // Rollback: remove the sample we just added
        this.deleteSampleFromSlot(inMemorySettings, toKit, toVoice, toSlot);
        return {
          success: false,
          error: `Failed to delete source sample: ${deleteResult.error}`,
        };
      }

      // Prepare the result data
      const affectedSamples = (deleteResult.data?.affectedSamples || []).map(
        (sample) => ({
          ...sample,
          original_slot_number: sample.slot_number, // Use current slot as original since it's from delete result
        }),
      );

      return {
        success: true,
        data: {
          movedSample: sampleToMove,
          affectedSamples,
          replacedSample,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to move sample between kits: ${getErrorMessage(error)}`,
      };
    }
  }
}

// Export singleton instance
export const sampleService = new SampleService();

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
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = this.validateVoiceAndSlot(
      voiceNumber,
      slotIndex,
    );
    if (!voiceSlotValidation.isValid) {
      return { error: voiceSlotValidation.error, success: false };
    }

    // Validate file
    const fileValidation = this.validateSampleFile(filePath);
    if (!fileValidation.isValid) {
      return { error: fileValidation.error, success: false };
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
        filename,
        is_stereo: isStereo,
        kit_name: kitName,
        slot_number: slotIndex + 1, // Convert 0-based to 1-based
        source_path: filePath,
        voice_number: voiceNumber,
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
        error: `Failed to add sample: ${getErrorMessage(error)}`,
        success: false,
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
  ): DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = this.validateVoiceAndSlot(
      voiceNumber,
      slotIndex,
    );
    if (!voiceSlotValidation.isValid) {
      return { error: voiceSlotValidation.error, success: false };
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
          error: `No sample found in voice ${voiceNumber}, slot ${slotIndex + 1} to delete`,
          success: false,
        };
      }

      // Delete with automatic contiguity maintenance
      const deleteResult = deleteSamples(dbPath, kitName, {
        slotNumber: slotIndex + 1, // Convert 0-based to 1-based
        voiceNumber,
      });

      // Mark kit as modified if operation succeeded
      if (deleteResult.success) {
        markKitAsModified(dbPath, kitName);
      }

      return deleteResult;
    } catch (error) {
      return {
        error: `Failed to delete sample: ${getErrorMessage(error)}`,
        success: false,
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
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = this.validateVoiceAndSlot(
      voiceNumber,
      slotIndex,
    );
    if (!voiceSlotValidation.isValid) {
      return { error: voiceSlotValidation.error, success: false };
    }

    try {
      // Delete WITHOUT automatic contiguity maintenance
      const deleteResult = deleteSamplesWithoutCompaction(dbPath, kitName, {
        slotNumber: slotIndex + 1, // Convert 0-based to 1-based
        voiceNumber,
      });

      // Mark kit as modified if operation succeeded
      if (deleteResult.success) {
        markKitAsModified(dbPath, kitName);
      }

      return deleteResult;
    } catch (error) {
      return {
        error: `Failed to delete sample: ${getErrorMessage(error)}`,
        success: false,
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
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    try {
      // Get sample from database
      const samplesResult = getKitSamples(dbPath, kitName);

      if (!samplesResult.success || !samplesResult.data) {
        return {
          error: `Failed to get samples for kit ${kitName}`,
          success: false,
        };
      }

      // Find the specific sample
      const sample = samplesResult.data.find(
        (s: Sample) =>
          s.voice_number === voiceNumber && s.slot_number === slotNumber,
      );

      if (!sample) {
        // Return null for missing samples (empty slots)
        return { data: null, success: true };
      }

      // Read the file using the database-stored source_path
      const data = fs.readFileSync(sample.source_path);
      return {
        data: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ),
        success: true,
      };
    } catch (error) {
      return {
        error: `Failed to read sample audio: ${getErrorMessage(error)}`,
        success: false,
      };
    }
  }

  /**
   * Move a sample from one kit to another with source compaction
   * Task: Cross-kit sample movement with gap prevention
   */
  moveSampleBetweenKits(
    inMemorySettings: Record<string, any>,
    params: {
      fromKit: string;
      fromSlot: number;
      fromVoice: number;
      mode: "insert" | "overwrite";
      toKit: string;
      toSlot: number;
      toVoice: number;
    },
  ): DbResult<{
    affectedSamples: ({ original_slot_number: number } & Sample)[];
    movedSample: Sample;
    replacedSample?: Sample;
  }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);
    const { fromKit, fromSlot, fromVoice, mode, toKit, toSlot, toVoice } =
      params;

    // Validate voice and slot for both source and destination
    const fromValidation = this.validateVoiceAndSlot(fromVoice, fromSlot);
    if (!fromValidation.isValid) {
      return { error: `Source ${fromValidation.error}`, success: false };
    }

    const toValidation = this.validateVoiceAndSlot(toVoice, toSlot);
    if (!toValidation.isValid) {
      return { error: `Destination ${toValidation.error}`, success: false };
    }

    try {
      // Get the sample to move from source kit using helper method
      const sampleResult = this.validateAndGetSampleToMove(
        dbPath,
        fromKit,
        fromVoice,
        fromSlot,
      );
      if (!sampleResult.success) {
        return {
          error: sampleResult.error || "Failed to validate sample to move",
          success: false,
        };
      }
      const sampleToMove = sampleResult.data!; // TypeScript assertion: data is guaranteed to exist when success is true

      // Get destination kit samples to check for conflicts and replacements using helper method
      const { destSamples, replacedSample } =
        this.getDestinationSamplesAndReplacements(
          dbPath,
          toKit,
          toVoice,
          toSlot,
          mode,
        );

      // Check for stereo conflicts using helper method
      const conflictCheck = this.checkStereoConflicts(
        sampleToMove,
        toVoice,
        toSlot,
        destSamples,
        mode,
        toKit,
      );
      if (conflictCheck.hasConflict) {
        return { error: conflictCheck.error, success: false };
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
          error: `Failed to add sample to destination: ${addResult.error}`,
          success: false,
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
          error: `Failed to delete source sample: ${deleteResult.error}`,
          success: false,
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
        data: {
          affectedSamples,
          movedSample: sampleToMove,
          replacedSample,
        },
        success: true,
      };
    } catch (error) {
      return {
        error: `Failed to move sample between kits: ${getErrorMessage(error)}`,
        success: false,
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
    affectedSamples: ({ original_slot_number: number } & Sample)[];
    movedSample: Sample;
    replacedSample?: Sample;
  }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate movement parameters
    const validationResult = this.validateSampleMovement(
      fromVoice,
      fromSlot,
      toVoice,
      toSlot,
    );
    if (!validationResult.success) {
      return { error: validationResult.error, success: false };
    }

    try {
      // Get existing samples and find sample to move
      const existingSamplesResult = getKitSamples(dbPath, kitName);
      if (!existingSamplesResult.success || !existingSamplesResult.data) {
        return { error: existingSamplesResult.error, success: false };
      }

      const sampleToMove = existingSamplesResult.data.find(
        (s) => s.voice_number === fromVoice && s.slot_number === fromSlot + 1,
      );

      if (!sampleToMove) {
        return {
          error: `No sample found at voice ${fromVoice}, slot ${fromSlot + 1}`,
          success: false,
        };
      }

      // Validate stereo sample constraints
      const stereoValidation = this.validateStereoSampleMove(
        sampleToMove,
        toVoice,
        toSlot,
        mode,
        existingSamplesResult.data,
      );
      if (!stereoValidation.success) {
        return { error: stereoValidation.error, success: false };
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
        error: `Failed to move sample: ${getErrorMessage(error)}`,
        success: false,
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
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = this.validateVoiceAndSlot(
      voiceNumber,
      slotIndex,
    );
    if (!voiceSlotValidation.isValid) {
      return { error: voiceSlotValidation.error, success: false };
    }

    // Validate file
    const fileValidation = this.validateSampleFile(filePath);
    if (!fileValidation.isValid) {
      return { error: fileValidation.error, success: false };
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
        slotNumber: slotIndex + 1,
        voiceNumber,
      });
      if (!deleteResult.success) {
        return { error: deleteResult.error, success: false };
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
        filename,
        is_stereo: isStereo,
        kit_name: kitName,
        slot_number: slotIndex + 1,
        source_path: filePath,
        voice_number: voiceNumber,
      };

      const result = addSample(dbPath, sampleRecord);

      // Mark kit as modified if operation succeeded
      if (result.success) {
        markKitAsModified(dbPath, kitName);
      }

      return result;
    } catch (error) {
      return {
        error: `Failed to replace sample: ${getErrorMessage(error)}`,
        success: false,
      };
    }
  }

  /**
   * Task 5.2.5: Enhanced file validation for sample operations
   * Validates file existence, format, and basic WAV file integrity
   */
  validateSampleFile(filePath: string): {
    error?: string;
    isValid: boolean;
  } {
    // Check file existence
    if (!fs.existsSync(filePath)) {
      return { error: "Sample file not found", isValid: false };
    }

    // Check file extension
    if (!filePath.toLowerCase().endsWith(".wav")) {
      return { error: "Only WAV files are supported", isValid: false };
    }

    try {
      // Check file is readable and has minimum size for WAV header
      const stats = fs.statSync(filePath);
      if (stats.size < 44) {
        return {
          error: "File too small to be a valid WAV file",
          isValid: false,
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
          error: "Invalid WAV file: missing RIFF signature",
          isValid: false,
        };
      }

      // Check WAVE format
      if (buffer.toString("ascii", 8, 12) !== "WAVE") {
        return {
          error: "Invalid WAV file: missing WAVE format identifier",
          isValid: false,
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        error: `Failed to validate file: ${getErrorMessage(error)}`,
        isValid: false,
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
    invalidSamples: Array<{
      error: string;
      filename: string;
      source_path: string;
    }>;
    totalSamples: number;
    validSamples: number;
  }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    try {
      const samplesResult = getKitSamples(dbPath, kitName);
      if (!samplesResult.success) {
        return { error: samplesResult.error, success: false };
      }

      const samples = samplesResult.data || [];
      const invalidSamples: Array<{
        error: string;
        filename: string;
        source_path: string;
      }> = [];

      for (const sample of samples) {
        if (sample.source_path) {
          const validation = this.validateSampleFile(sample.source_path);
          if (!validation.isValid) {
            invalidSamples.push({
              error: validation.error || "Unknown validation error",
              filename: sample.filename,
              source_path: sample.source_path,
            });
          }
        }
      }

      return {
        data: {
          invalidSamples,
          totalSamples: samples.length,
          validSamples: samples.length - invalidSamples.length,
        },
        success: true,
      };
    } catch (error) {
      return {
        error: `Failed to validate sample sources: ${getErrorMessage(error)}`,
        success: false,
      };
    }
  }

  /**
   * Task 5.2.4: Validates voice number and slot index for sample operations
   * 12-slot limit per voice using voice_number field validation
   */
  validateVoiceAndSlot(
    voiceNumber: number,
    slotIndex: number,
  ): { error?: string; isValid: boolean } {
    // Validate voice number (1-4)
    if (voiceNumber < 1 || voiceNumber > 4) {
      return { error: "Voice number must be between 1 and 4", isValid: false };
    }

    // Validate slot index (0-11 for 12 slots total, converted to 1-12 for storage)
    if (slotIndex < 0 || slotIndex > 11) {
      return {
        error: "Slot index must be between 0 and 11 (12 slots per voice)",
        isValid: false,
      };
    }

    return { isValid: true };
  }

  /**
   * Helper method to check stereo conflicts for cross-kit moves
   */
  private checkStereoConflicts(
    sampleToMove: Sample,
    toVoice: number,
    toSlot: number,
    destSamples: Sample[],
    mode: "insert" | "overwrite",
    toKit: string,
  ): { error?: string; hasConflict: boolean } {
    // Check for stereo conflicts at destination
    if (sampleToMove.is_stereo && toVoice === 4) {
      return {
        error:
          "Cannot move stereo sample to voice 4 (no adjacent voice available)",
        hasConflict: true,
      };
    }

    // For insert mode with stereo samples, check conflict with adjacent voice
    if (sampleToMove.is_stereo && mode === "insert") {
      const conflictSample = destSamples.find(
        (s) => s.voice_number === toVoice + 1 && s.slot_number === toSlot + 1,
      );
      if (conflictSample) {
        return {
          error: `Stereo sample move would conflict with sample in ${toKit} voice ${toVoice + 1}, slot ${toSlot + 1}`,
          hasConflict: true,
        };
      }
    }

    return { hasConflict: false };
  }

  private getDbPath(localStorePath: string): string {
    return ServicePathManager.getDbPath(localStorePath);
  }

  /**
   * Helper method to get destination kit samples and check for replacements
   */
  private getDestinationSamplesAndReplacements(
    dbPath: string,
    toKit: string,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ): { destSamples: Sample[]; replacedSample?: Sample } {
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

    return { destSamples, replacedSample };
  }

  private getLocalStorePath(
    inMemorySettings: Record<string, any>,
  ): null | string {
    return ServicePathManager.getLocalStorePath(inMemorySettings);
  }

  /**
   * Helper method to validate and get sample to move for cross-kit operations
   */
  private validateAndGetSampleToMove(
    dbPath: string,
    fromKit: string,
    fromVoice: number,
    fromSlot: number,
  ): DbResult<Sample> {
    const sourceSamplesResult = getKitSamples(dbPath, fromKit);
    if (!sourceSamplesResult.success || !sourceSamplesResult.data) {
      return { error: sourceSamplesResult.error, success: false };
    }

    const sampleToMove = sourceSamplesResult.data.find(
      (s) => s.voice_number === fromVoice && s.slot_number === fromSlot + 1,
    );

    if (!sampleToMove) {
      return {
        error: `No sample found at ${fromKit} voice ${fromVoice}, slot ${fromSlot + 1}`,
        success: false,
      };
    }

    return { data: sampleToMove, success: true };
  }

  /**
   * Validate sample movement parameters
   */
  private validateSampleMovement(
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ): DbResult<void> {
    const fromValidation = this.validateVoiceAndSlot(fromVoice, fromSlot);
    if (!fromValidation.isValid) {
      return { error: `Source ${fromValidation.error}`, success: false };
    }

    const toValidation = this.validateVoiceAndSlot(toVoice, toSlot);
    if (!toValidation.isValid) {
      return { error: `Destination ${toValidation.error}`, success: false };
    }

    if (fromVoice === toVoice && fromSlot === toSlot) {
      return {
        error: "Cannot move sample to the same location",
        success: false,
      };
    }

    return { success: true };
  }

  /**
   * Validate stereo sample move constraints
   */
  private validateStereoSampleMove(
    sampleToMove: Sample,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
    existingSamples: Sample[],
  ): DbResult<void> {
    if (!sampleToMove.is_stereo) {
      return { success: true };
    }

    // Check if moving to voice 4 (no adjacent voice available)
    if (toVoice === 4) {
      return {
        error:
          "Cannot move stereo sample to voice 4 (no adjacent voice available)",
        success: false,
      };
    }

    // Check for destination conflicts in insert mode
    if (mode === "insert") {
      const conflictSample = existingSamples.find(
        (s) => s.voice_number === toVoice + 1 && s.slot_number === toSlot + 1,
      );
      if (conflictSample) {
        return {
          error: `Stereo sample move would conflict with sample in voice ${toVoice + 1}, slot ${toSlot + 1}`,
          success: false,
        };
      }
    }

    return { success: true };
  }
}

// Export singleton instance
export const sampleService = new SampleService();

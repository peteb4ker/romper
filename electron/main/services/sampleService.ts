import * as fs from "fs";
import * as path from "path";

import type { DbResult, NewSample, Sample } from "../../../shared/db/schema.js";
import { getAudioMetadata } from "../audioUtils.js";
import {
  addSample,
  deleteSamples,
  getKitSamples,
  markKitAsModified,
} from "../db/romperDbCoreORM.js";

/**
 * Service for sample validation and management operations
 * Extracted from dbIpcHandlers.ts to separate business logic from IPC routing
 */
export class SampleService {
  private getLocalStorePath(
    inMemorySettings: Record<string, any>,
  ): string | null {
    return inMemorySettings.localStorePath || null;
  }

  private getDbPath(localStorePath: string): string {
    return path.join(localStorePath, ".romperdb");
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
        error: `Failed to validate file: ${error instanceof Error ? error.message : String(error)}`,
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

      // Task 7.1.2: Apply 'default to mono samples' setting to new sample assignments
      let isStereo = false;

      // Get the defaultToMonoSamples setting (default: true)
      const defaultToMonoSamples =
        inMemorySettings.defaultToMonoSamples ?? true;

      if (!defaultToMonoSamples) {
        // Only check if file is actually stereo when setting is OFF
        const metadataResult = getAudioMetadata(filePath);
        if (metadataResult.success && metadataResult.data) {
          isStereo = (metadataResult.data.channels || 1) > 1;
        }
      }
      // If defaultToMonoSamples is true, isStereo remains false

      const sampleRecord: NewSample = {
        kit_name: kitName,
        filename,
        voice_number: voiceNumber,
        slot_number: slotIndex + 1, // Convert 0-based to 1-based
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to add sample: ${errorMessage}`,
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

      // Task 7.1.2: Apply 'default to mono samples' setting to new sample assignments
      let isStereo = false;

      // Get the defaultToMonoSamples setting (default: true)
      const defaultToMonoSamples =
        inMemorySettings.defaultToMonoSamples ?? true;

      if (!defaultToMonoSamples) {
        // Only check if file is actually stereo when setting is OFF
        const metadataResult = getAudioMetadata(filePath);
        if (metadataResult.success && metadataResult.data) {
          isStereo = (metadataResult.data.channels || 1) > 1;
        }
      }
      // If defaultToMonoSamples is true, isStereo remains false

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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to replace sample: ${errorMessage}`,
      };
    }
  }

  /**
   * Delete a sample from a specific voice slot
   */
  deleteSampleFromSlot(
    inMemorySettings: Record<string, any>,
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
  ): DbResult<void> {
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to delete sample: ${errorMessage}`,
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to validate sample sources: ${errorMessage}`,
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to read sample audio: ${errorMessage}`,
      };
    }
  }
}

// Export singleton instance
export const sampleService = new SampleService();

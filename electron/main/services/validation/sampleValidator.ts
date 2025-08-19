import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as fs from "fs";

import { getKitSamples } from "../../db/romperDbCoreORM.js";

/**
 * Service for sample validation operations
 * Handles file validation, voice/slot validation, and stereo constraints
 */
export class SampleValidator {
  /**
   * Helper method to check stereo conflicts for cross-kit moves
   */
  checkStereoConflicts(
    sampleToMove: Sample,
    toVoice: number,
    toSlot: number,
    destSamples: Sample[],
    mode: "insert",
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

    if (sampleToMove.is_stereo && mode === "insert") {
      // Check if destination's adjacent voice has a sample in the same slot
      const conflictingDestSample = destSamples.find(
        (s) => s.voice_number === toVoice + 1 && s.slot_number === toSlot,
      );

      if (conflictingDestSample) {
        return {
          error: `Cannot move stereo sample to voice ${toVoice} slot ${toSlot + 1} in kit ${toKit}. Voice ${toVoice + 1} already has a sample at slot ${toSlot + 1}.`,
          hasConflict: true,
        };
      }
    }

    return { hasConflict: false };
  }

  /**
   * Validates a sample file for format and accessibility
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
    dbPath: string,
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
   * Validate stereo sample move constraints
   */
  validateStereoSampleMove(
    sampleToMove: Sample,
    toVoice: number,
    toSlot: number,
    mode: "insert",
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

    // Check for destination conflicts (always insert mode)
    {
      const conflictSample = existingSamples.find(
        (s) => s.voice_number === toVoice + 1 && s.slot_number === toSlot,
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

  /**
   * Task 5.2.4: Validates voice number and slot index for sample operations
   * 12-slot limit per voice using voice_number field validation
   */
  validateVoiceAndSlot(
    voiceNumber: number,
    slotNumber: number,
  ): { error?: string; isValid: boolean } {
    // Validate voice number (1-4)
    if (voiceNumber < 1 || voiceNumber > 4) {
      return { error: "Voice number must be between 1 and 4", isValid: false };
    }

    // Validate slot index (0-11 for 12 slots total)
    if (slotNumber < 0 || slotNumber >= 12) {
      return {
        error: "Slot index must be between 0 and 11 (12 slots per voice)",
        isValid: false,
      };
    }

    return { isValid: true };
  }
}

// Export singleton instance
export const sampleValidator = new SampleValidator();

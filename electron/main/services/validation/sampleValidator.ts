import type { DbResult } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as fs from "node:fs";

import { getAudioMetadata } from "../../audioUtils.js";
import { getKit, getKitSamples } from "../../db/romperDbCoreORM.js";

/**
 * Service for sample validation operations
 * Handles file validation, voice/slot validation, and linked-voice rules
 */
export class SampleValidator {
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

    // A file Romper can't read as an uncompressed PCM or float WAV can't be
    // written to the card, so it's refused here rather than at sync (RE-08).
    // Bit depth, rate and channel mismatches are fine: sync converts them.
    const metadata = getAudioMetadata(filePath);
    if (!metadata.success) {
      return {
        error: `Can't use this file: ${metadata.error}`,
        isValid: false,
      };
    }
    return { isValid: true };
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

  /**
   * Refuse samples on the right channel of a linked stereo pair. Stereo is a
   * voice setting (`voices.stereo_mode`): while voice N is linked, voice N+1
   * is hidden and holds no samples of its own, as linking requires (RE-69).
   */
  validateVoiceNotLinkedPartner(
    dbPath: string,
    kitName: string,
    voiceNumber: number,
  ): { error?: string; isValid: boolean } {
    if (voiceNumber <= 1) {
      return { isValid: true };
    }
    const kitResult = getKit(dbPath, kitName);
    const previousVoice = kitResult.data?.voices?.find(
      (v) => v.voice_number === voiceNumber - 1,
    );
    if (previousVoice?.stereo_mode) {
      return {
        error: `Voice ${voiceNumber} is linked to voice ${voiceNumber - 1} for stereo. Unlink them to put samples on voice ${voiceNumber}.`,
        isValid: false,
      };
    }
    return { isValid: true };
  }
}

// Export singleton instance
export const sampleValidator = new SampleValidator();

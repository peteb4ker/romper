import * as fs from "node:fs";

import { getAudioMetadata } from "../../audioUtils.js";
import {
  toWavMetadataFields,
  type WavMetadataFields,
} from "../../db/operations/wavMetadataFields.js";
import { getKit } from "../../db/romperDbCoreORM.js";

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
    /** The header's `wav_*` column values, when the file is valid */
    metadata?: WavMetadataFields;
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
    return {
      isValid: true,
      metadata: toWavMetadataFields(metadata.data ?? {}),
    };
  }

  /**
   * Task 5.2.4: Validates voice number and slot index for sample operations
   * 12-slot limit per voice using voice_number field validation
   */
  validateVoiceAndSlot(
    voiceNumber: number,
    slotNumber: number,
  ): { error?: string; isValid: boolean } {
    // Validate voice number (1-4). NaN and fractions fail too (RE-25).
    if (!Number.isInteger(voiceNumber) || voiceNumber < 1 || voiceNumber > 4) {
      return { error: "Voice number must be between 1 and 4", isValid: false };
    }

    // Validate slot index (0-11 for 12 slots total)
    if (!Number.isInteger(slotNumber) || slotNumber < 0 || slotNumber >= 12) {
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

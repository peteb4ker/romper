import type { DbResult } from "@romper/shared/db/schema.js";

import { sampleValidator } from "./validation/sampleValidator.js";

/**
 * Service for sample-specific validation operations
 * Handles validation logic for sample operations, movement, and conflict detection
 */
export class SampleValidationService {
  /**
   * Validate sample file for adding to kit
   */
  validateSampleFile(
    filePath: string,
  ): ReturnType<typeof sampleValidator.validateSampleFile> {
    return sampleValidator.validateSampleFile(filePath);
  }

  /**
   * Validate sample movement parameters
   */
  validateSampleMovement(
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ): DbResult<void> {
    // Validate source voice and slot
    const fromValidation = this.validateVoiceAndSlot(fromVoice, fromSlot);
    if (!fromValidation.isValid) {
      return { error: `Source ${fromValidation.error}`, success: false };
    }

    // Validate destination voice and slot
    const toValidation = this.validateVoiceAndSlot(toVoice, toSlot);
    if (!toValidation.isValid) {
      return { error: `Destination ${toValidation.error}`, success: false };
    }

    // Cannot move to the same position
    if (fromVoice === toVoice && fromSlot === toSlot) {
      return {
        error: "Cannot move sample to the same position",
        success: false,
      };
    }

    return { success: true };
  }

  /**
   * Validate voice and slot parameters for sample operations
   */
  validateVoiceAndSlot(
    voiceNumber: number,
    slotNumber: number,
  ): { error?: string; isValid: boolean } {
    return sampleValidator.validateVoiceAndSlot(voiceNumber, slotNumber);
  }

  /**
   * Refuse samples on the right channel of a linked stereo pair
   */
  validateVoiceNotLinkedPartner(
    dbPath: string,
    kitName: string,
    voiceNumber: number,
  ): { error?: string; isValid: boolean } {
    return sampleValidator.validateVoiceNotLinkedPartner(
      dbPath,
      kitName,
      voiceNumber,
    );
  }
}

// Export singleton instance
export const sampleValidationService = new SampleValidationService();

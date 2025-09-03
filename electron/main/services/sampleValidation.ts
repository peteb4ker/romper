import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { getKitSamples } from "../db/romperDbCoreORM.js";
import { sampleValidator } from "./validation/sampleValidator.js";

/**
 * Service for sample-specific validation operations
 * Handles validation logic for sample operations, movement, and conflict detection
 */
export class SampleValidationService {
  /**
   * Check if sample exists in specified slot
   */
  checkSampleExists(
    dbPath: string,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ): { exists: boolean; sample?: Sample } {
    const existingSamplesResult = getKitSamples(dbPath, kitName);

    if (!existingSamplesResult.success || !existingSamplesResult.data) {
      return { exists: false };
    }

    const sample = existingSamplesResult.data.find(
      (s) => s.voice_number === voiceNumber && s.slot_number === slotNumber,
    );

    return { exists: !!sample, sample };
  }

  /**
   * Check for stereo conflicts when moving samples between kits
   */
  checkStereoConflicts(
    sampleToMove: Sample,
    toVoice: number,
    toSlot: number,
    destSamples: Sample[],
    mode: "insert",
    toKit: string,
  ): { error?: string; hasConflict: boolean } {
    return sampleValidator.checkStereoConflicts(
      sampleToMove,
      toVoice,
      toSlot,
      destSamples,
      mode,
      toKit,
    );
  }

  /**
   * Get destination kit samples and check for replacements
   */
  getDestinationSamplesAndReplacements(
    dbPath: string,
    toKit: string,
    _toVoice: number,
    _toSlot: number,
    _mode: "insert",
  ): { destSamples: Sample[]; replacedSample?: Sample } {
    const destSamplesResult = getKitSamples(dbPath, toKit);
    let destSamples: Sample[] = [];
    let replacedSample: Sample | undefined;

    if (destSamplesResult.success && destSamplesResult.data) {
      destSamples = destSamplesResult.data;

      // Insert-only mode: no samples are replaced
    }

    return { destSamples, replacedSample };
  }

  /**
   * Validate and get sample to move for cross-kit operations
   */
  validateAndGetSampleToMove(
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
      (s) => s.voice_number === fromVoice && s.slot_number === fromSlot,
    );

    if (!sampleToMove) {
      return {
        error: `No sample found in kit ${fromKit} at voice ${fromVoice}, slot ${fromSlot + 1}`,
        success: false,
      };
    }

    return { data: sampleToMove, success: true };
  }

  /**
   * Validate sample file for adding to kit
   */
  validateSampleFile(filePath: string): { error?: string; isValid: boolean } {
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
   * Validate stereo sample constraints for movement
   */
  validateStereoSampleMove(
    sampleToMove: Sample,
    toVoice: number,
    toSlot: number,
    mode: "insert",
    existingSamples: Sample[],
  ): { error?: string; success: boolean } {
    return sampleValidator.validateStereoSampleMove(
      sampleToMove,
      toVoice,
      toSlot,
      mode,
      existingSamples,
    );
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
}

// Export singleton instance
export const sampleValidationService = new SampleValidationService();

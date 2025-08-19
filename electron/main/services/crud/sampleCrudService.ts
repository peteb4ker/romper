import type { DbResult, NewSample, Sample } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as path from "path";

import {
  addSample,
  deleteSamples,
  deleteSamplesWithoutReindexing,
  getKitSamples,
  markKitAsModified,
  moveSample,
} from "../../db/romperDbCoreORM.js";
import { ServicePathManager } from "../../utils/fileSystemUtils.js";
import {
  determineStereoConfiguration,
  type StereoOptions,
} from "../../utils/stereoProcessingUtils.js";
import { sampleValidator } from "../validation/sampleValidator.js";

/**
 * Service for sample CRUD (Create, Read, Update, Delete) operations
 * Handles adding, deleting, and moving samples between kits and slots
 */
export class SampleCrudService {
  /**
   * Add a sample to a specific voice slot
   */
  addSampleToSlot(
    inMemorySettings: Record<string, any>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
    options?: StereoOptions
  ): DbResult<{ sampleId: number }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = sampleValidator.validateVoiceAndSlot(
      voiceNumber,
      slotNumber
    );
    if (!voiceSlotValidation.isValid) {
      return { error: voiceSlotValidation.error, success: false };
    }

    // Validate file
    const fileValidation = sampleValidator.validateSampleFile(filePath);
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
        options
      );

      const sampleRecord: NewSample = {
        filename,
        is_stereo: isStereo,
        kit_name: kitName,
        slot_number: slotNumber, // ZERO-BASED: 0-11 (UI shows 1-12, DB stores 0-11)
        source_path: filePath,
        voice_number: voiceNumber,
      };

      // Check if there's an existing sample in this slot for conflict handling
      const existingSamplesResult = getKitSamples(dbPath, kitName);
      let _previousSample: Sample | undefined;

      if (existingSamplesResult.success && existingSamplesResult.data) {
        _previousSample = existingSamplesResult.data.find(
          (s) => s.voice_number === voiceNumber && s.slot_number === slotNumber
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
    slotNumber: number
  ): DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = sampleValidator.validateVoiceAndSlot(
      voiceNumber,
      slotNumber
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
          (s) => s.voice_number === voiceNumber && s.slot_number === slotNumber
        );
      }

      if (!sampleExists) {
        return {
          error: `No sample found in voice ${voiceNumber}, slot ${slotNumber + 1} to delete`,
          success: false,
        };
      }

      // Delete with automatic contiguity maintenance
      const deleteResult = deleteSamples(dbPath, kitName, {
        slotNumber: slotNumber, // Database stores 0-11 directly
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
   * Delete a sample from a specific voice slot WITHOUT automatic reindexing
   * Used for undo operations where we want precise control over slot positions
   */
  deleteSampleFromSlotWithoutReindexing(
    inMemorySettings: Record<string, any>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number
  ): DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = sampleValidator.validateVoiceAndSlot(
      voiceNumber,
      slotNumber
    );
    if (!voiceSlotValidation.isValid) {
      return { error: voiceSlotValidation.error, success: false };
    }

    try {
      // Delete WITHOUT automatic contiguity maintenance (for undo operations)
      const deleteResult = deleteSamplesWithoutReindexing(dbPath, kitName, {
        slotNumber: slotNumber, // Database stores 0-11 directly
        voiceNumber,
      });

      // Mark kit as modified if operation succeeded
      if (deleteResult.success) {
        markKitAsModified(dbPath, kitName);
      }

      return {
        data: {
          affectedSamples: deleteResult.data?.deletedSamples || [],
          deletedSamples: deleteResult.data?.deletedSamples || [],
        },
        success: deleteResult.success,
      };
    } catch (error) {
      return {
        error: `Failed to delete sample: ${getErrorMessage(error)}`,
        success: false,
      };
    }
  }

  /**
   * Move a sample from one kit to another with source reindexing
   * Task: Cross-kit sample movement with gap prevention
   */
  moveSampleBetweenKits(
    inMemorySettings: Record<string, any>,
    params: {
      fromKit: string;
      fromSlot: number;
      fromVoice: number;
      mode: "insert";
      toKit: string;
      toSlot: number;
      toVoice: number;
    }
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
    const fromValidation = sampleValidator.validateVoiceAndSlot(
      fromVoice,
      fromSlot
    );
    if (!fromValidation.isValid) {
      return { error: `Source ${fromValidation.error}`, success: false };
    }

    const toValidation = sampleValidator.validateVoiceAndSlot(toVoice, toSlot);
    if (!toValidation.isValid) {
      return { error: `Destination ${toValidation.error}`, success: false };
    }

    try {
      // Get the sample to move from source kit using helper method
      const sampleResult = this.validateAndGetSampleToMove(
        dbPath,
        fromKit,
        fromVoice,
        fromSlot
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
          mode
        );

      // Check for stereo conflicts using helper method
      const conflictCheck = sampleValidator.checkStereoConflicts(
        sampleToMove,
        toVoice,
        toSlot,
        destSamples,
        mode,
        toKit
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
        }
      );

      if (!addResult.success) {
        return {
          error: `Failed to add sample to destination: ${addResult.error}`,
          success: false,
        };
      }

      // Step 2: Delete the sample from source kit (with reindexing)
      const deleteResult = this.deleteSampleFromSlot(
        inMemorySettings,
        fromKit,
        fromVoice,
        fromSlot
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
        })
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
    mode: "insert"
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
      toSlot
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
        (s) => s.voice_number === fromVoice && s.slot_number === fromSlot // Database stores 0-11 directly
      );

      if (!sampleToMove) {
        return {
          error: `No sample found at voice ${fromVoice}, slot ${fromSlot + 1}`,
          success: false,
        };
      }

      // Validate stereo sample constraints
      const stereoValidation = sampleValidator.validateStereoSampleMove(
        sampleToMove,
        toVoice,
        toSlot,
        mode,
        existingSamplesResult.data
      );
      if (!stereoValidation.success) {
        return { error: stereoValidation.error, success: false };
      }

      // Use database moveSample operation
      const moveResult = moveSample(
        dbPath,
        kitName,
        fromVoice,
        fromSlot,
        toVoice,
        toSlot
      );

      // Mark kit as modified if operation succeeded
      if (moveResult.success) {
        markKitAsModified(dbPath, kitName);
      }

      if (!moveResult.success) {
        return moveResult as DbResult<{
          affectedSamples: ({ original_slot_number: number } & Sample)[];
          movedSample: Sample;
          replacedSample?: Sample;
        }>;
      }

      // Convert null to undefined for TypeScript compatibility
      return {
        data: {
          affectedSamples: moveResult.data!.affectedSamples,
          movedSample: moveResult.data!.movedSample,
          replacedSample: moveResult.data!.replacedSample || undefined,
        },
        success: true,
      };
    } catch (error) {
      return {
        error: `Failed to move sample in kit: ${getErrorMessage(error)}`,
        success: false,
      };
    }
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
    _toVoice: number,
    _toSlot: number,
    _mode: "insert"
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

  private getLocalStorePath(
    inMemorySettings: Record<string, any>
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
    fromSlot: number
  ): DbResult<Sample> {
    const sourceSamplesResult = getKitSamples(dbPath, fromKit);
    if (!sourceSamplesResult.success || !sourceSamplesResult.data) {
      return { error: sourceSamplesResult.error, success: false };
    }

    const sampleToMove = sourceSamplesResult.data.find(
      (s) => s.voice_number === fromVoice && s.slot_number === fromSlot
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
   * Helper method to validate sample movement parameters
   */
  private validateSampleMovement(
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number
  ): DbResult<void> {
    // Validate source voice and slot
    const fromValidation = sampleValidator.validateVoiceAndSlot(
      fromVoice,
      fromSlot
    );
    if (!fromValidation.isValid) {
      return { error: `Source ${fromValidation.error}`, success: false };
    }

    // Validate destination voice and slot
    const toValidation = sampleValidator.validateVoiceAndSlot(toVoice, toSlot);
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
}

// Export singleton instance
export const sampleCrudService = new SampleCrudService();

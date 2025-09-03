import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";

import {
  deleteSamples,
  deleteSamplesWithoutReindexing,
  getKitSamples,
  markKitAsModified,
  moveSample,
} from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { sampleValidationService } from "./sampleValidation.js";

/**
 * Service for batch and complex sample operations
 * Handles delete operations, movement operations, and multi-step workflows
 */
export class SampleBatchOperationsService {
  /**
   * Delete a sample from a specific voice slot with automatic contiguity maintenance
   */
  deleteSampleFromSlot(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ): DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = sampleValidationService.validateVoiceAndSlot(
      voiceNumber,
      slotNumber,
    );
    if (!voiceSlotValidation.isValid) {
      return { error: voiceSlotValidation.error, success: false };
    }

    try {
      // Check if sample exists before deleting
      const { exists } = sampleValidationService.checkSampleExists(
        dbPath,
        kitName,
        voiceNumber,
        slotNumber,
      );

      if (!exists) {
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
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ): DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);

    // Validate voice and slot
    const voiceSlotValidation = sampleValidationService.validateVoiceAndSlot(
      voiceNumber,
      slotNumber,
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
   * Execute cross-kit sample movement with rollback support
   */
  executeCrossKitMove(
    addSampleToSlot: (
      inMemorySettings: Record<string, unknown>,
      toKit: string,
      toVoice: number,
      toSlot: number,
      sourcePath: string,
      options?: { forceMono?: boolean; forceStereo?: boolean },
    ) => DbResult<{ sampleId: number }>,
    inMemorySettings: Record<string, unknown>,
    sampleToMove: Sample,
    toKit: string,
    toVoice: number,
    toSlot: number,
    fromKit: string,
    fromVoice: number,
    fromSlot: number,
  ): DbResult<{
    affectedSamples: ({ original_slot_number: number } & Sample)[];
    movedSample: Sample;
    replacedSample?: Sample;
  }> {
    try {
      // Step 1: Add the sample to destination kit
      const addResult = addSampleToSlot(
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

      // Step 2: Delete the sample from source kit (with reindexing)
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
          replacedSample: undefined, // Cross-kit moves don't replace in insert mode
        },
        success: true,
      };
    } catch (error) {
      return {
        error: `Failed to execute cross-kit move: ${getErrorMessage(error)}`,
        success: false,
      };
    }
  }

  /**
   * Move a sample from one slot to another with contiguity maintenance
   * Task 22.2: Cross-voice sample movement within same kit
   */
  moveSampleInKit(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
    mode: "insert",
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
    const validationResult = sampleValidationService.validateSampleMovement(
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
        (s) => s.voice_number === fromVoice && s.slot_number === fromSlot, // Database stores 0-11 directly
      );

      if (!sampleToMove) {
        return {
          error: `No sample found at voice ${fromVoice}, slot ${fromSlot + 1}`,
          success: false,
        };
      }

      // Validate stereo sample constraints
      const stereoValidation = sampleValidationService.validateStereoSampleMove(
        sampleToMove,
        toVoice,
        toSlot,
        mode,
        existingSamplesResult.data,
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
        toSlot,
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

  private getLocalStorePath(
    inMemorySettings: Record<string, unknown>,
  ): null | string {
    return ServicePathManager.getLocalStorePath(inMemorySettings);
  }
}

// Export singleton instance
export const sampleBatchOperationsService = new SampleBatchOperationsService();

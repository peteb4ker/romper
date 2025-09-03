import type { DbResult, NewSample, Sample } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as path from "path";

import { addSample, markKitAsModified } from "../../db/romperDbCoreORM.js";
import { ServicePathManager } from "../../utils/fileSystemUtils.js";
import {
  determineStereoConfiguration,
  type StereoOptions,
} from "../../utils/stereoProcessingUtils.js";
import { sampleBatchOperationsService } from "../sampleBatchOperations.js";
import { sampleValidationService } from "../sampleValidation.js";

/**
 * Service for sample CRUD (Create, Read, Update, Delete) operations
 * Handles adding, deleting, and moving samples between kits and slots
 */
export class SampleCrudService {
  /**
   * Add a sample to a specific voice slot
   */
  addSampleToSlot(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
    options?: StereoOptions,
  ): DbResult<{ sampleId: number }> {
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

    // Validate file
    const fileValidation = sampleValidationService.validateSampleFile(filePath);
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
        slot_number: slotNumber, // ZERO-BASED: 0-11 (UI shows 1-12, DB stores 0-11)
        source_path: filePath,
        voice_number: voiceNumber,
      };

      // Check if there's an existing sample in this slot for conflict handling
      sampleValidationService.checkSampleExists(
        dbPath,
        kitName,
        voiceNumber,
        slotNumber,
      );

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
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ): DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }> {
    return sampleBatchOperationsService.deleteSampleFromSlot(
      inMemorySettings,
      kitName,
      voiceNumber,
      slotNumber,
    );
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
    return sampleBatchOperationsService.deleteSampleFromSlotWithoutReindexing(
      inMemorySettings,
      kitName,
      voiceNumber,
      slotNumber,
    );
  }

  /**
   * Move a sample from one kit to another with source reindexing
   * Task: Cross-kit sample movement with gap prevention
   */
  moveSampleBetweenKits(
    inMemorySettings: Record<string, unknown>,
    params: {
      fromKit: string;
      fromSlot: number;
      fromVoice: number;
      mode: "insert";
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
    const fromValidation = sampleValidationService.validateVoiceAndSlot(
      fromVoice,
      fromSlot,
    );
    if (!fromValidation.isValid) {
      return { error: `Source ${fromValidation.error}`, success: false };
    }

    const toValidation = sampleValidationService.validateVoiceAndSlot(
      toVoice,
      toSlot,
    );
    if (!toValidation.isValid) {
      return { error: `Destination ${toValidation.error}`, success: false };
    }

    try {
      // Get the sample to move from source kit using validation service
      const sampleResult = sampleValidationService.validateAndGetSampleToMove(
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

      // Get destination kit samples to check for conflicts and replacements
      const { destSamples } =
        sampleValidationService.getDestinationSamplesAndReplacements(
          dbPath,
          toKit,
          toVoice,
          toSlot,
          mode,
        );

      // Check for stereo conflicts using validation service
      const conflictCheck = sampleValidationService.checkStereoConflicts(
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

      // Execute the cross-kit move using batch operations service
      return sampleBatchOperationsService.executeCrossKitMove(
        this.addSampleToSlot.bind(this),
        inMemorySettings,
        sampleToMove,
        toKit,
        toVoice,
        toSlot,
        fromKit,
        fromVoice,
        fromSlot,
      );
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
    return sampleBatchOperationsService.moveSampleInKit(
      inMemorySettings,
      kitName,
      fromVoice,
      fromSlot,
      toVoice,
      toSlot,
      mode,
    );
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
export const sampleCrudService = new SampleCrudService();

import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";

import {
  deleteSamplesTx,
  deleteSamplesWithoutReindexingTx,
  flagKitModified,
  getKitSamples,
  moveSampleTx,
  withDbTransaction,
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
      // The delete, the reindex that closes its gap and the kit's modified
      // flag commit together (RE-28)
      return withDbTransaction(dbPath, (db) => {
        const result = deleteSamplesTx(db, kitName, {
          slotNumber: slotNumber, // Database stores 0-11 directly
          voiceNumber,
        });
        if (result.deletedSamples.length === 0) {
          throw new Error(
            `No sample found in voice ${voiceNumber}, slot ${slotNumber + 1} to delete`,
          );
        }
        flagKitModified(db, kitName);
        return result;
      });
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
      // Delete WITHOUT automatic contiguity maintenance (for undo
      // operations), flagging the kit in the same transaction
      const deleteResult = withDbTransaction(dbPath, (db) => {
        const result = deleteSamplesWithoutReindexingTx(db, kitName, {
          slotNumber: slotNumber, // Database stores 0-11 directly
          voiceNumber,
        });
        flagKitModified(db, kitName);
        return result;
      });

      if (!deleteResult.success) {
        return { error: deleteResult.error, success: false };
      }
      const deletedSamples = deleteResult.data?.deletedSamples ?? [];
      return {
        data: { affectedSamples: deletedSamples, deletedSamples },
        success: true,
      };
    } catch (error) {
      return {
        error: `Failed to delete sample: ${getErrorMessage(error)}`,
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
    _mode: "insert",
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
      // Check there is a sample to move
      const existingSamplesResult = getKitSamples(dbPath, kitName);
      if (!existingSamplesResult.success || !existingSamplesResult.data) {
        return { error: existingSamplesResult.error, success: false };
      }

      const hasSampleToMove = existingSamplesResult.data.some(
        (s) => s.voice_number === fromVoice && s.slot_number === fromSlot, // Database stores 0-11 directly
      );

      if (!hasSampleToMove) {
        return {
          error: `No sample found at voice ${fromVoice}, slot ${fromSlot + 1}`,
          success: false,
        };
      }

      const linkValidation =
        sampleValidationService.validateVoiceNotLinkedPartner(
          dbPath,
          kitName,
          toVoice,
        );
      if (!linkValidation.isValid) {
        return { error: linkValidation.error, success: false };
      }

      // The move and the kit's modified flag commit together (RE-28)
      return withDbTransaction(dbPath, (db) => {
        const moved = moveSampleTx(
          db,
          kitName,
          fromVoice,
          fromSlot,
          toVoice,
          toSlot,
        );
        flagKitModified(db, kitName);
        return { ...moved, replacedSample: undefined };
      });
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

import type { DbResult, NewSample, Sample } from "@romper/shared/db/schema.js";
import type { VoiceSnapshot } from "@romper/shared/undoTypes.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as path from "node:path";

import {
  addSampleTx,
  flagKitModified,
  moveSampleBetweenKitsTx,
  replaceSampleTx,
  restoreVoicesTx,
  withDbTransaction,
} from "../../db/romperDbCoreORM.js";
import { ServicePathManager } from "../../utils/fileSystemUtils.js";
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

    const linkValidation =
      sampleValidationService.validateVoiceNotLinkedPartner(
        dbPath,
        kitName,
        voiceNumber,
      );
    if (!linkValidation.isValid) {
      return { error: linkValidation.error, success: false };
    }

    // Validate file
    const fileValidation = sampleValidationService.validateSampleFile(filePath);
    if (!fileValidation.isValid) {
      return { error: fileValidation.error, success: false };
    }

    try {
      // Create sample record
      const filename = path.basename(filePath);

      // Stereo is a voice configuration, not a sample property.
      // The voice's stereo_mode determines stereo behavior at sync time.
      const sampleRecord: NewSample = {
        filename,
        kit_name: kitName,
        slot_number: slotNumber, // ZERO-BASED: 0-11 (UI shows 1-12, DB stores 0-11)
        source_path: filePath,
        voice_number: voiceNumber,
        // The header validation just read, as a scan would store it (RE-89)
        ...fileValidation.metadata,
      };

      // The row and the kit's modified flag commit together (RE-28)
      return withDbTransaction(dbPath, (db) => {
        const added = addSampleTx(db, sampleRecord);
        flagKitModified(db, kitName);
        return added;
      });
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
    const { fromKit, fromSlot, fromVoice, toKit, toSlot, toVoice } = params;

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

    const linkValidation =
      sampleValidationService.validateVoiceNotLinkedPartner(
        dbPath,
        toKit,
        toVoice,
      );
    if (!linkValidation.isValid) {
      return { error: linkValidation.error, success: false };
    }

    // The row moves with its gain and WAV metadata, and both voices are
    // renumbered, in one transaction (RE-27)
    const moved = withDbTransaction(dbPath, (db) =>
      moveSampleBetweenKitsTx(db, {
        fromKit,
        fromSlot,
        fromVoice,
        toKit,
        toSlot,
        toVoice,
      }),
    );
    if (!moved.success || !moved.data) {
      return {
        error: `Failed to move sample between kits: ${moved.error}`,
        success: false,
      };
    }
    return {
      data: { ...moved.data, replacedSample: undefined },
      success: true,
    };
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

  /**
   * Replace the file in an occupied slot (RE-26). The new file is checked
   * before anything is written; then one update swaps the file on the
   * existing row, so its slot and gain stay, and stores the new file's WAV
   * header. A file that can't be used leaves the slot as it was.
   */
  replaceSampleInSlot(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
  ): DbResult<{ replacedSample: Sample; sampleId: number }> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }
    const dbPath = this.getDbPath(localStorePath);

    const voiceSlotValidation = sampleValidationService.validateVoiceAndSlot(
      voiceNumber,
      slotNumber,
    );
    if (!voiceSlotValidation.isValid) {
      return { error: voiceSlotValidation.error, success: false };
    }

    const fileValidation = sampleValidationService.validateSampleFile(filePath);
    if (!fileValidation.isValid) {
      return { error: fileValidation.error, success: false };
    }

    return withDbTransaction(dbPath, (db) =>
      replaceSampleTx(db, kitName, voiceNumber, slotNumber, {
        filename: path.basename(filePath),
        source_path: filePath,
        ...fileValidation.metadata,
      }),
    );
  }

  /**
   * Put a kit's voices back as an undo snapshot had them, in one
   * transaction (RE-86)
   */
  restoreVoices(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voices: VoiceSnapshot[],
  ): DbResult<void> {
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }
    return withDbTransaction(this.getDbPath(localStorePath), (db) =>
      restoreVoicesTx(db, kitName, voices),
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

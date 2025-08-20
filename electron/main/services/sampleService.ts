import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import type { StereoOptions } from "../utils/stereoProcessingUtils.js";

import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { sampleCrudService } from "./crud/sampleCrudService.js";
import { sampleMetadataService } from "./metadata/sampleMetadataService.js";
import { sampleSlotService } from "./slot/sampleSlotService.js";
import { sampleValidator } from "./validation/sampleValidator.js";

/**
 * Orchestrating service for sample operations
 * Delegates to specialized services for validation, CRUD, metadata, and slot management
 */
export class SampleService {
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
    return sampleCrudService.addSampleToSlot(
      inMemorySettings,
      kitName,
      voiceNumber,
      slotNumber,
      filePath,
      options,
    );
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
    return sampleCrudService.deleteSampleFromSlot(
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
    return sampleCrudService.deleteSampleFromSlotWithoutReindexing(
      inMemorySettings,
      kitName,
      voiceNumber,
      slotNumber,
    );
  }

  /**
   * Find the next available slot in a voice
   */
  findNextAvailableSlot(
    voiceNumber: number,
    existingSamples: Sample[],
  ): number {
    return sampleSlotService.findNextAvailableSlot(
      voiceNumber,
      existingSamples,
    );
  }

  /**
   * Get audio buffer for a specific sample by kit/voice/slot identifier
   */
  getSampleAudioBuffer(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ): DbResult<ArrayBuffer | null> {
    return sampleMetadataService.getSampleAudioBuffer(
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
    return sampleCrudService.moveSampleBetweenKits(inMemorySettings, params);
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
    return sampleCrudService.moveSampleInKit(
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
   * Replace a sample in a specific voice slot
   */
  replaceSampleInSlot(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
    options?: StereoOptions,
  ): DbResult<{ sampleId: number }> {
    // Delegate to CRUD service - first delete then add
    const deleteResult = this.deleteSampleFromSlotWithoutReindexing(
      inMemorySettings,
      kitName,
      voiceNumber,
      slotNumber,
    );

    if (!deleteResult.success) {
      return { error: deleteResult.error, success: false };
    }

    return this.addSampleToSlot(
      inMemorySettings,
      kitName,
      voiceNumber,
      slotNumber,
      filePath,
      options,
    );
  }

  /**
   * Validates a sample file for format and accessibility
   */
  validateSampleFile(filePath: string): {
    error?: string;
    isValid: boolean;
  } {
    return sampleValidator.validateSampleFile(filePath);
  }

  /**
   * Task 5.2.5: Validate source_path files for existing samples
   */
  validateSampleSources(
    inMemorySettings: Record<string, unknown>,
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
    const localStorePath = this.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbPath = this.getDbPath(localStorePath);
    return sampleValidator.validateSampleSources(dbPath, kitName);
  }

  // Slot service delegations
  /**
   * Validate that a move target doesn't exceed the next available slot boundary
   */
  validateSlotBoundary(
    toVoice: number,
    toSlot: number,
    existingSamples: Sample[],
  ): DbResult<void> {
    return sampleSlotService.validateSlotBoundary(
      toVoice,
      toSlot,
      existingSamples,
    );
  }

  /**
   * Task 5.2.4: Validates voice number and slot index for sample operations
   * 12-slot limit per voice using voice_number field validation
   */
  validateVoiceAndSlot(
    voiceNumber: number,
    slotNumber: number,
  ): { error?: string; isValid: boolean } {
    return sampleValidator.validateVoiceAndSlot(voiceNumber, slotNumber);
  }

  // Utility methods
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
export const sampleService = new SampleService();

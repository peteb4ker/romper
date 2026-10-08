import type { SampleAudio } from "@romper/shared/audioTypes.js";
import type { DbResult, Sample } from "@romper/shared/db/schema.js";
import type { VoiceSnapshot } from "@romper/shared/undoTypes.js";

import { sampleCrudService } from "./crud/sampleCrudService.js";
import { sampleMetadataService } from "./metadata/sampleMetadataService.js";

/**
 * Orchestrating service for sample operations
 * Delegates to the CRUD and metadata services
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
  ): DbResult<{ sampleId: number }> {
    return sampleCrudService.addSampleToSlot(
      inMemorySettings,
      kitName,
      voiceNumber,
      slotNumber,
      filePath,
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
   * The audio file in a kit/voice/slot, or null for an empty slot; not
   * read again when it's still `knownVersion` (#478)
   */
  getSampleAudioBuffer(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    knownVersion?: string,
  ): Promise<DbResult<null | SampleAudio>> {
    return sampleMetadataService.getSampleAudioBuffer(
      inMemorySettings,
      kitName,
      voiceNumber,
      slotNumber,
      knownVersion,
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
   * Put a kit's voices back as an undo snapshot had them (RE-86)
   */
  restoreVoices(
    inMemorySettings: Record<string, unknown>,
    kitName: string,
    voices: VoiceSnapshot[],
  ): DbResult<void> {
    return sampleCrudService.restoreVoices(inMemorySettings, kitName, voices);
  }
}

// Export singleton instance
export const sampleService = new SampleService();

import type { Sample } from "@romper/shared/db/schema.js";

import * as path from "path";

import { rampleNamingService } from "./rampleNamingService.js";
import {
  syncFileOperationsService,
  type SyncResults,
} from "./syncFileOperations.js";
import { syncValidationService } from "./syncValidationService.js";

// Voice data structure for stereo processing
interface VoiceInfo {
  id: number;
  kit_name: string;
  stereo_mode: boolean;
  voice_number: number;
}

/**
 * Enhanced sync processor that handles stereo voice linking correctly
 * Implements Task STEREO.4: SD Card Generation Fixes
 */
export class StereoSyncProcessor {
  /**
   * Process samples with proper stereo voice linking
   */
  async processSamplesForSync(
    samples: Sample[],
    voices: VoiceInfo[],
    localStorePath: string,
    results: SyncResults,
    sdCardPath?: string,
  ): Promise<void> {
    // Group samples by kit for processing
    const samplesByKit = this.groupSamplesByKit(samples);

    for (const [kitName, kitSamples] of samplesByKit) {
      const kitVoices = voices.filter((v) => v.kit_name === kitName);
      await this.processKitSamples(
        kitSamples,
        kitVoices,
        localStorePath,
        results,
        sdCardPath,
      );
    }
  }

  /**
   * Get standard destination path for mono voice files
   */
  private getDestinationPath(
    localStorePath: string,
    kitName: string,
    sample: Sample,
    sdCardPath?: string,
  ): string {
    const baseDir = sdCardPath || path.join(localStorePath, "sync_output");

    return rampleNamingService.generateSampleDestinationPath(
      baseDir,
      kitName,
      sample.voice_number,
      sample.slot_number,
    );
  }

  /**
   * Get destination path for stereo voice files
   *
   * For stereo samples, the Rample hardware expects ONE stereo file placed on the primary voice,
   * and automatically plays it across both the primary voice (N) and the next voice (N+1).
   * This is a hardware feature - no file splitting is required or desired.
   *
   * Example: Stereo sample placed on voice 1:
   * - Single stereo file goes to voice 1 directory
   * - Hardware automatically plays left channel on voice 1, right channel on voice 2
   * - Only triggering voice 1 is needed to play the full stereo sample
   *
   * @param localStorePath Base path for local storage
   * @param kitName Name of the kit (affects path structure)
   * @param sample Sample containing voice_number and slot_number
   * @param channel Channel parameter (maintained for API compatibility)
   * @param sdCardPath Optional custom SD card path (overrides local storage)
   * @returns Full path where the stereo file should be written (always to primary voice)
   */
  private getStereoDestinationPath(
    localStorePath: string,
    kitName: string,
    sample: Sample,
    channel: "left" | "right",
    sdCardPath?: string,
  ): string {
    const baseDir = sdCardPath || path.join(localStorePath, "sync_output");

    // For stereo samples: always use primary voice directory (hardware handles both channels)
    // Channel parameter is ignored as Rample expects single stereo file, not split channels
    const voiceNumber = sample.voice_number;

    // Generate destination path for the primary voice only
    return rampleNamingService.generateSampleDestinationPath(
      baseDir,
      kitName,
      voiceNumber,
      sample.slot_number,
    );
  }

  /**
   * Group samples by kit for batch processing
   */
  private groupSamplesByKit(samples: Sample[]): Map<string, Sample[]> {
    const samplesByKit = new Map<string, Sample[]>();

    for (const sample of samples) {
      const kitName = sample.kit_name;
      if (!samplesByKit.has(kitName)) {
        samplesByKit.set(kitName, []);
      }
      samplesByKit.get(kitName)!.push(sample);
    }

    return samplesByKit;
  }

  /**
   * Check if a voice is linked (secondary voice in a stereo pair)
   */
  private isLinkedVoice(voiceNumber: number, voices: VoiceInfo[]): boolean {
    if (voiceNumber === 1) return false; // Voice 1 cannot be linked

    const primaryVoice = voices.find((v) => v.voice_number === voiceNumber - 1);
    return primaryVoice?.stereo_mode === true;
  }

  /**
   * Process samples for a single kit with stereo voice awareness
   */
  private async processKitSamples(
    samples: Sample[],
    voices: VoiceInfo[],
    localStorePath: string,
    results: SyncResults,
    sdCardPath?: string,
  ): Promise<void> {
    for (const sample of samples) {
      const voiceInfo = voices.find(
        (v) => v.voice_number === sample.voice_number,
      );

      if (!voiceInfo) {
        continue; // Skip samples without voice info
      }

      if (voiceInfo.stereo_mode) {
        // Handle stereo voice - generates files for both linked voices
        await this.processStereoVoiceSample(
          sample,
          voiceInfo,
          localStorePath,
          results,
          sdCardPath,
        );
      } else {
        // Handle mono voice - single file generation
        await this.processMonoVoiceSample(
          sample,
          localStorePath,
          results,
          sdCardPath,
        );
      }
    }
  }

  /**
   * Process mono voice sample - standard single file generation
   */
  private async processMonoVoiceSample(
    sample: Sample,
    localStorePath: string,
    results: SyncResults,
    sdCardPath?: string,
  ): Promise<void> {
    if (!sample.source_path) {
      return;
    }

    const { filename, kit_name: kitName, source_path: sourcePath } = sample;

    // Validate source file
    const fileValidation = syncValidationService.validateSyncSourceFile(
      filename,
      sourcePath,
      results.validationErrors,
    );

    if (!fileValidation.isValid) {
      return;
    }

    // Generate standard destination path
    const destinationPath = this.getDestinationPath(
      localStorePath,
      kitName,
      sample,
      sdCardPath,
    );

    syncFileOperationsService.categorizeSyncFileOperation(
      sample,
      filename,
      sourcePath,
      destinationPath,
      results,
    );
  }

  /**
   * Process stereo voice sample - places single stereo file on primary voice
   * Hardware automatically plays it across primary voice (N) and next voice (N+1)
   */
  private async processStereoVoiceSample(
    sample: Sample,
    voiceInfo: VoiceInfo,
    localStorePath: string,
    results: SyncResults,
    sdCardPath?: string,
  ): Promise<void> {
    if (!sample.source_path) {
      return;
    }

    // Validate that this is a primary stereo voice (not a linked voice)
    if (voiceInfo.voice_number === 4) {
      // Voice 4 cannot be stereo (no voice 5 to link to)
      results.warnings.push(
        `Voice 4 cannot be in stereo mode for kit ${sample.kit_name} - converting to mono`,
      );
      await this.processMonoVoiceSample(
        sample,
        localStorePath,
        results,
        sdCardPath,
      );
      return;
    }

    const { filename, kit_name: kitName, source_path: sourcePath } = sample;

    // Validate source file
    const fileValidation = syncValidationService.validateSyncSourceFile(
      filename,
      sourcePath,
      results.validationErrors,
    );

    if (!fileValidation.isValid) {
      return;
    }

    // Generate single destination path for stereo file (always primary voice)
    const destinationPath = this.getDestinationPath(
      localStorePath,
      kitName,
      sample,
      sdCardPath,
    );

    // Process single stereo file - hardware handles both channels automatically
    syncFileOperationsService.categorizeSyncFileOperation(
      sample,
      filename,
      sourcePath,
      destinationPath,
      results,
    );

    // Add informational message about hardware behavior
    results.warnings.push(
      `Stereo sample on voice ${voiceInfo.voice_number} will play across voices ${voiceInfo.voice_number} and ${voiceInfo.voice_number + 1} (hardware feature)`,
    );
  }
}

export const stereoSyncProcessor = new StereoSyncProcessor();

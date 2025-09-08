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
   * For stereo samples, the Rample sampler expects two separate files:
   * - Left channel: goes to the primary voice number (e.g., voice 1)
   * - Right channel: goes to the next voice number (e.g., voice 2)
   *
   * This method calculates the correct voice number for each channel:
   * - Left channel always uses the sample's assigned voice_number
   * - Right channel uses voice_number + 1 (the "linked" voice)
   *
   * Example: Stereo sample on voice 1 generates:
   * - Left channel → voice 1 destination path
   * - Right channel → voice 2 destination path
   *
   * @param localStorePath Base path for local storage
   * @param kitName Name of the kit (affects path structure)
   * @param sample Sample containing voice_number and slot_number
   * @param channel Which channel ("left" or "right") to generate path for
   * @param sdCardPath Optional custom SD card path (overrides local storage)
   * @returns Full path where this channel's file should be written
   */
  private getStereoDestinationPath(
    localStorePath: string,
    kitName: string,
    sample: Sample,
    channel: "left" | "right",
    sdCardPath?: string,
  ): string {
    const baseDir = sdCardPath || path.join(localStorePath, "sync_output");

    // For stereo: left channel uses primary voice, right channel uses linked voice
    const voiceNumber =
      channel === "left" ? sample.voice_number : sample.voice_number + 1;

    // Generate destination path for the appropriate voice
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
   * Process stereo voice sample - generates files for both L and R channels
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

    // Generate stereo file for left channel (primary voice)
    const leftDestination = this.getStereoDestinationPath(
      localStorePath,
      kitName,
      sample,
      "left",
      sdCardPath,
    );

    // Generate stereo file for right channel (linked voice)
    const rightDestination = this.getStereoDestinationPath(
      localStorePath,
      kitName,
      sample,
      "right",
      sdCardPath,
    );

    // Process left channel
    syncFileOperationsService.categorizeSyncFileOperation(
      sample,
      `${filename}_L`,
      sourcePath,
      leftDestination,
      results,
    );

    // Process right channel (same source, different destination)
    syncFileOperationsService.categorizeSyncFileOperation(
      sample,
      `${filename}_R`,
      sourcePath,
      rightDestination,
      results,
    );

    // Add informational message
    results.warnings.push(
      `Stereo voice ${voiceInfo.voice_number} generates files for both channels: ${path.basename(leftDestination)} and ${path.basename(rightDestination)}`,
    );
  }
}

export const stereoSyncProcessor = new StereoSyncProcessor();

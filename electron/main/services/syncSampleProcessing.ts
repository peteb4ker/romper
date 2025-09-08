import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import * as path from "path";

import { getKitSamples } from "../db/romperDbCoreORM.js";
import { rampleNamingService } from "./rampleNamingService.js";
import {
  syncFileOperationsService,
  type SyncResults,
} from "./syncFileOperations.js";
import { syncValidationService } from "./syncValidationService.js";

/**
 * Service responsible for processing samples during sync operations
 */
export class SyncSampleProcessingService {
  /**
   * Gather all samples from all kits
   */
  async gatherAllSamples(dbDir: string): Promise<DbResult<Sample[]>> {
    try {
      const { getKits } = await import("../db/romperDbCoreORM.js");
      const kitsResult = getKits(dbDir);
      if (!kitsResult.success || !kitsResult.data) {
        return {
          error: kitsResult.error ?? "Failed to load kits",
          success: false,
        };
      }

      const kits = kitsResult.data;
      let allSamples: Sample[] = [];

      for (const kit of kits) {
        const samplesResult = getKitSamples(dbDir, kit.name);
        if (samplesResult.success && samplesResult.data) {
          const samplesWithKit = samplesResult.data.map((sample) => ({
            ...sample,
            kitName: kit.name,
          }));
          allSamples = allSamples.concat(samplesWithKit);
        }
      }

      return { data: allSamples, success: true };
    } catch (error) {
      return {
        error: `Failed to gather samples: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  }

  /**
   * Get destination path for a sample file
   */
  getDestinationPath(
    localStorePath: string,
    kitName: string,
    sample: Sample,
    sdCardPath?: string,
  ): string {
    // Use SD card path if provided, otherwise fall back to sync_output directory
    const baseDir = sdCardPath || path.join(localStorePath, "sync_output");
    const syncDir = path.join(baseDir, kitName);
    const voiceDir = `${sample.voice_number}`;
    return path.join(syncDir, voiceDir, sample.filename);
  }

  /**
   * Process a single sample for sync operation
   * Enhanced with stereo voice linking support (Task STEREO.4.1)
   */
  processSampleForSync(
    sample: Sample,
    localStorePath: string,
    results: SyncResults,
    sdCardPath?: string,
  ): void {
    if (!sample.source_path) {
      return; // Skip samples without source path
    }

    // Check if this is a stereo sample that requires special handling
    if (sample.is_stereo && this.shouldProcessStereoSample(sample)) {
      this.processStereoSample(sample, localStorePath, results, sdCardPath);
      return;
    }

    const { filename, kit_name: kitName, source_path: sourcePath } = sample;

    // Validate source file and handle errors
    const fileValidation = syncValidationService.validateSyncSourceFile(
      filename,
      sourcePath,
      results.validationErrors,
    );

    if (!fileValidation.isValid) {
      return;
    }

    // Determine operation type and add to appropriate list
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
   * Get destination path for stereo voice files using Rample naming conventions
   */
  private getStereoDestinationPath(
    localStorePath: string,
    kitName: string,
    sample: Sample,
    channel: "left" | "right",
    sdCardPath?: string,
  ): string {
    const baseDir = sdCardPath || path.join(localStorePath, "sync_output");

    // Left channel uses primary voice, right channel uses linked voice (+1)
    const voiceNumber =
      channel === "left" ? sample.voice_number : sample.voice_number + 1;

    // Use Rample naming service for proper file naming
    return rampleNamingService.generateSampleDestinationPath(
      baseDir,
      kitName,
      voiceNumber,
      sample.slot_number,
    );
  }

  /**
   * Process stereo sample with voice linking
   * Generates files for both left (primary) and right (linked) voices
   */
  private processStereoSample(
    sample: Sample,
    localStorePath: string,
    results: SyncResults,
    sdCardPath?: string,
  ): void {
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

    // Generate left channel file (primary voice)
    const leftDestination = this.getStereoDestinationPath(
      localStorePath,
      kitName,
      sample,
      "left",
      sdCardPath,
    );

    // Generate right channel file (linked voice)
    const rightDestination = this.getStereoDestinationPath(
      localStorePath,
      kitName,
      sample,
      "right",
      sdCardPath,
    );

    // Process left channel file
    syncFileOperationsService.categorizeSyncFileOperation(
      sample,
      path.basename(leftDestination),
      sourcePath,
      leftDestination,
      results,
    );

    // Process right channel file (same source, different destination)
    syncFileOperationsService.categorizeSyncFileOperation(
      { ...sample, voice_number: sample.voice_number + 1 }, // Linked voice
      path.basename(rightDestination),
      sourcePath,
      rightDestination,
      results,
    );

    // Add informational message
    results.warnings.push(
      `Stereo sample "${filename}" generates files for voice ${sample.voice_number} (L) and voice ${sample.voice_number + 1} (R)`,
    );
  }

  /**
   * Check if stereo sample should be processed with voice linking
   * Task STEREO.4.1: Voice-level stereo file generation
   */
  private shouldProcessStereoSample(sample: Sample): boolean {
    // Voice 4 cannot be stereo (no voice 5 to link to)
    if (sample.voice_number === 4) {
      return false;
    }

    // Only process stereo samples from voices 1-3 that can link
    return sample.voice_number >= 1 && sample.voice_number <= 3;
  }
}

export const syncSampleProcessingService = new SyncSampleProcessingService();

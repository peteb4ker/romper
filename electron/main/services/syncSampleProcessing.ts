import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import * as path from "path";

import { getKitSamples } from "../db/romperDbCoreORM.js";
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
}

export const syncSampleProcessingService = new SyncSampleProcessingService();

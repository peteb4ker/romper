import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { cardSampleFileName } from "@romper/shared/rampleCardLayout.js";
import * as path from "node:path";

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
   * Where a sample goes on the card: directly in its kit folder, named so
   * the Rample assigns its voice and layer order (`A0/1-01 KICK.wav`; see
   * rampleCardLayout).
   */
  getDestinationPath(
    localStorePath: string,
    kitName: string,
    sample: Sample,
    sdCardPath?: string,
  ): string {
    // Use SD card path if provided, otherwise fall back to sync_output directory
    const baseDir = sdCardPath || path.join(localStorePath, "sync_output");
    return path.join(
      baseDir,
      kitName,
      cardSampleFileName(
        sample.voice_number,
        sample.slot_number,
        sample.filename,
      ),
    );
  }

  /**
   * Kits that have samples but none on voice 1. The Rample only opens a kit
   * that has a voice 1 sample, so these won't load on the device.
   */
  kitsWithoutVoiceOne(samples: Sample[]): string[] {
    const kits = new Set<string>();
    const kitsWithVoiceOne = new Set<string>();
    for (const sample of samples) {
      kits.add(sample.kit_name);
      if (sample.voice_number === 1) kitsWithVoiceOne.add(sample.kit_name);
    }
    return [...kits]
      .filter((kit) => !kitsWithVoiceOne.has(kit))
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * Process a single sample for sync operation
   * Stereo files are written as complete stereo files to voice N,
   * hardware automatically plays them on voices N and N+1
   */
  processSampleForSync(
    sample: Sample,
    localStorePath: string,
    results: SyncResults,
    sdCardPath?: string,
  ): void {
    const { filename, kit_name: kitName, source_path: sourcePath } = sample;
    const firstNewError = results.validationErrors.length;

    if (sourcePath) {
      this.planSampleFile(sample, localStorePath, results, sdCardPath);
    } else {
      results.validationErrors.push({
        error: "No source file is recorded for this sample",
        filename,
        sourcePath: "",
        type: "missing_file",
      });
    }

    // The validators don't know which kit a sample belongs to; the UI needs
    // it to say where the skipped sample lives.
    for (const error of results.validationErrors.slice(firstNewError)) {
      error.kitName = kitName;
    }
  }

  /**
   * Validate a sample's source file and queue the copy or conversion.
   * Failures are recorded in results.validationErrors.
   */
  private planSampleFile(
    sample: Sample,
    localStorePath: string,
    results: SyncResults,
    sdCardPath?: string,
  ): void {
    const { filename, kit_name: kitName, source_path: sourcePath } = sample;

    const fileValidation = syncValidationService.validateSyncSourceFile(
      filename,
      sourcePath,
      results.validationErrors,
    );
    if (!fileValidation.isValid) {
      return;
    }

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

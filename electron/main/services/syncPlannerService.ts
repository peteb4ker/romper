import * as fs from "fs";
import * as path from "path";

import type { DbResult, Sample } from "../../../shared/db/schema.js";
import { getAudioMetadata, validateSampleFormat } from "../audioUtils.js";
import { getKitSamples } from "../db/romperDbCoreORM.js";

export interface SyncFileOperation {
  filename: string;
  sourcePath: string;
  destinationPath: string;
  operation: "copy" | "convert";
  reason?: string;
  originalFormat?: string;
  targetFormat?: string;
  kitName: string;
}

export interface SyncValidationError {
  filename: string;
  sourcePath: string;
  error: string;
  type: "missing_file" | "access_denied" | "invalid_format" | "other";
}

export interface SyncChangeSummary {
  filesToCopy: SyncFileOperation[];
  filesToConvert: SyncFileOperation[];
  totalSize: number;
  hasFormatWarnings: boolean;
  warnings: string[];
  validationErrors: SyncValidationError[];
}

/**
 * Service for analyzing and planning sync operations
 * Extracted from syncService.ts for better testability
 */
export class SyncPlannerService {
  /**
   * Generate a summary of changes needed to sync all kits to SD card
   */
  async generateChangeSummary(
    inMemorySettings: Record<string, any>,
  ): Promise<DbResult<SyncChangeSummary>> {
    try {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath) {
        return { success: false, error: "No local store path configured" };
      }

      const dbDir = path.join(localStorePath, ".romperdb");

      // Get all kits first
      const { getKits } = await import("../db/romperDbCoreORM.js");
      const kitsResult = getKits(dbDir);
      if (!kitsResult.success || !kitsResult.data) {
        return {
          success: false,
          error: kitsResult.error || "Failed to load kits",
        };
      }

      const kits = kitsResult.data;
      let allSamples: any[] = [];

      // Get all samples from all kits
      for (const kit of kits) {
        const samplesResult = getKitSamples(dbDir, kit.name);
        if (samplesResult.success && samplesResult.data) {
          // Add kit context to each sample
          const samplesWithKit = samplesResult.data.map((sample) => ({
            ...sample,
            kitName: kit.name,
          }));
          allSamples = allSamples.concat(samplesWithKit);
        }
      }

      const samples = allSamples;
      const filesToCopy: SyncFileOperation[] = [];
      const filesToConvert: SyncFileOperation[] = [];
      const warnings: string[] = [];
      const validationErrors: SyncValidationError[] = [];

      let totalSize = 0;
      let hasFormatWarnings = false;

      // Process each sample
      for (const sample of samples) {
        if (!sample.source_path) {
          // Skip samples without source path (likely baseline samples)
          continue;
        }

        const filename = sample.filename;
        const sourcePath = sample.source_path;

        // Check if source file exists
        if (!fs.existsSync(sourcePath)) {
          validationErrors.push({
            filename,
            sourcePath,
            error: `Source file not found: ${sourcePath}`,
            type: "missing_file",
          });
          continue;
        }

        // Get file stats
        const stats = fs.statSync(sourcePath);
        totalSize += stats.size;

        // Get audio metadata for format validation
        const metadataResult = await getAudioMetadata(sourcePath);
        const formatValidationResult = await validateSampleFormat(sourcePath);

        const destinationPath = this.getDestinationPath(
          localStorePath,
          sample.kitName,
          sample,
        );

        if (
          !formatValidationResult.success ||
          !formatValidationResult.data?.isValid
        ) {
          // File needs conversion
          const issues = formatValidationResult.data?.issues || [];
          const issueMessages = issues.map((issue) => issue.message);

          filesToConvert.push({
            filename,
            sourcePath,
            destinationPath,
            operation: "convert",
            reason: issueMessages.join(", ") || "Format conversion required",
            originalFormat: metadataResult.success
              ? `${metadataResult.data?.bitDepth}bit/${metadataResult.data?.sampleRate}Hz`
              : "Unknown",
            targetFormat: "16bit/44100Hz WAV",
            kitName: sample.kitName,
          });
          hasFormatWarnings = true;
          warnings.push(
            `${filename}: ${issueMessages.join(", ") || "Format conversion required"}`,
          );
        } else {
          // File can be copied as-is
          filesToCopy.push({
            filename,
            sourcePath,
            destinationPath,
            operation: "copy",
            kitName: sample.kitName,
          });
        }
      }

      const summary: SyncChangeSummary = {
        filesToCopy,
        filesToConvert,
        totalSize,
        hasFormatWarnings,
        warnings,
        validationErrors,
      };

      return { success: true, data: summary };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to generate sync summary: ${errorMessage}`,
      };
    }
  }

  /**
   * Get the destination path for a sample on the SD card
   */
  private getDestinationPath(
    localStorePath: string,
    kitName: string,
    sample: Sample,
  ): string {
    // TODO: This should use the actual SD card path once SD card detection is implemented
    // For now, create a sync output directory in the local store
    const syncDir = path.join(localStorePath, "sync_output", kitName);
    const voiceDir = `${sample.voice_number}`;
    return path.join(syncDir, voiceDir, sample.filename);
  }
}

export const syncPlannerService = new SyncPlannerService();

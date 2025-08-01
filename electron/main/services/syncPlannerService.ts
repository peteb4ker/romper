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
   * Get all samples from all kits
   */
  private async getAllSamplesFromKits(dbDir: string): Promise<DbResult<any[]>> {
    try {
      const { getKits } = await import("../db/romperDbCoreORM.js");
      const kitsResult = getKits(dbDir);
      if (!kitsResult.success || !kitsResult.data) {
        return {
          success: false,
          error: kitsResult.error || "Failed to load kits",
        };
      }

      let allSamples: any[] = [];
      for (const kit of kitsResult.data) {
        const samplesResult = getKitSamples(dbDir, kit.name);
        if (samplesResult.success && samplesResult.data) {
          const samplesWithKit = samplesResult.data.map((sample) => ({
            ...sample,
            kitName: kit.name,
          }));
          allSamples = allSamples.concat(samplesWithKit);
        }
      }

      return { success: true, data: allSamples };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load kits: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Process a single sample for sync planning
   */
  private processSampleForSync(
    sample: any,
    localStorePath: string,
    results: {
      filesToCopy: SyncFileOperation[];
      filesToConvert: SyncFileOperation[];
      warnings: string[];
      validationErrors: SyncValidationError[];
      totalSize: number;
      hasFormatWarnings: boolean;
    },
  ): void {
    if (!sample.source_path) {
      return; // Skip samples without source path
    }

    const filename = sample.filename;
    const sourcePath = sample.source_path;

    // Check if source file exists
    if (!fs.existsSync(sourcePath)) {
      results.validationErrors.push({
        filename,
        sourcePath,
        error: `Source file not found: ${sourcePath}`,
        type: "missing_file",
      });
      return;
    }

    // Get file stats and update total size
    const stats = fs.statSync(sourcePath);
    results.totalSize += stats.size;

    // Get audio metadata and validate format
    const metadataResult = getAudioMetadata(sourcePath);
    const formatValidationResult = validateSampleFormat(sourcePath);
    const destinationPath = this.getDestinationPath(
      localStorePath,
      sample.kitName,
      sample,
    );

    if (
      !formatValidationResult.success ||
      !formatValidationResult.data?.isValid
    ) {
      this.addFileToConvert(
        sample,
        filename,
        sourcePath,
        destinationPath,
        metadataResult,
        formatValidationResult,
        results,
      );
    } else {
      this.addFileToCopy(
        filename,
        sourcePath,
        destinationPath,
        sample.kitName,
        results,
      );
    }
  }

  /**
   * Add file to conversion list
   */
  private addFileToConvert(
    sample: any,
    filename: string,
    sourcePath: string,
    destinationPath: string,
    metadataResult: any,
    formatValidationResult: any,
    results: any,
  ): void {
    const issues = formatValidationResult.data?.issues || [];
    const issueMessages = issues.map((issue: any) => issue.message);

    results.filesToConvert.push({
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

    results.hasFormatWarnings = true;
    results.warnings.push(
      `${filename}: ${issueMessages.join(", ") || "Format conversion required"}`,
    );
  }

  /**
   * Add file to copy list
   */
  private addFileToCopy(
    filename: string,
    sourcePath: string,
    destinationPath: string,
    kitName: string,
    results: any,
  ): void {
    results.filesToCopy.push({
      filename,
      sourcePath,
      destinationPath,
      operation: "copy",
      kitName,
    });
  }

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

      // Get all samples from all kits
      const samplesResult = await this.getAllSamplesFromKits(dbDir);
      if (!samplesResult.success) {
        return { success: false, error: samplesResult.error };
      }

      // Initialize processing results
      const results = {
        filesToCopy: [] as SyncFileOperation[],
        filesToConvert: [] as SyncFileOperation[],
        warnings: [] as string[],
        validationErrors: [] as SyncValidationError[],
        totalSize: 0,
        hasFormatWarnings: false,
      };

      // Process each sample
      for (const sample of samplesResult.data || []) {
        this.processSampleForSync(sample, localStorePath, results);
      }

      const summary: SyncChangeSummary = {
        filesToCopy: results.filesToCopy,
        filesToConvert: results.filesToConvert,
        totalSize: results.totalSize,
        hasFormatWarnings: results.hasFormatWarnings,
        warnings: results.warnings,
        validationErrors: results.validationErrors,
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

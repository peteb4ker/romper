import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as fs from "fs";
import * as path from "path";

import { getAudioMetadata, validateSampleFormat } from "../audioUtils.js";
import { getKitSamples } from "../db/romperDbCoreORM.js";

export interface SyncChangeSummary {
  filesToConvert: SyncFileOperation[];
  filesToCopy: SyncFileOperation[];
  hasFormatWarnings: boolean;
  totalSize: number;
  validationErrors: SyncValidationError[];
  warnings: string[];
}

export interface SyncFileOperation {
  destinationPath: string;
  filename: string;
  kitName: string;
  operation: "convert" | "copy";
  originalFormat?: string;
  reason?: string;
  sourcePath: string;
  targetFormat?: string;
}

export interface SyncValidationError {
  error: string;
  filename: string;
  sourcePath: string;
  type: "access_denied" | "invalid_format" | "missing_file" | "other";
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
        return { error: "No local store path configured", success: false };
      }

      const dbDir = path.join(localStorePath, ".romperdb");

      // Get all samples from all kits
      const samplesResult = await this.getAllSamplesFromKits(dbDir);
      if (!samplesResult.success) {
        return { error: samplesResult.error, success: false };
      }

      // Initialize processing results
      const results = {
        filesToConvert: [] as SyncFileOperation[],
        filesToCopy: [] as SyncFileOperation[],
        hasFormatWarnings: false,
        totalSize: 0,
        validationErrors: [] as SyncValidationError[],
        warnings: [] as string[],
      };

      // Process each sample
      for (const sample of samplesResult.data || []) {
        this.processSampleForSync(sample, localStorePath, results);
      }

      const summary: SyncChangeSummary = {
        filesToConvert: results.filesToConvert,
        filesToCopy: results.filesToCopy,
        hasFormatWarnings: results.hasFormatWarnings,
        totalSize: results.totalSize,
        validationErrors: results.validationErrors,
        warnings: results.warnings,
      };

      return { data: summary, success: true };
    } catch (error) {
      return {
        error: `Failed to generate sync summary: ${getErrorMessage(error)}`,
        success: false,
      };
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
      destinationPath,
      filename,
      kitName: sample.kitName,
      operation: "convert",
      originalFormat: metadataResult.success
        ? `${metadataResult.data?.bitDepth}bit/${metadataResult.data?.sampleRate}Hz`
        : "Unknown",
      reason: issueMessages.join(", ") || "Format conversion required",
      sourcePath,
      targetFormat: "16bit/44100Hz WAV",
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
      destinationPath,
      filename,
      kitName,
      operation: "copy",
      sourcePath,
    });
  }

  /**
   * Categorizes file operation as copy or convert
   */
  private categorizeFileOperation(
    sample: any,
    filename: string,
    sourcePath: string,
    destinationPath: string,
    results: any,
  ): void {
    const metadataResult = getAudioMetadata(sourcePath);
    const formatValidationResult = validateSampleFormat(sourcePath);

    const needsConversion =
      !formatValidationResult.success || !formatValidationResult.data?.isValid;

    if (needsConversion) {
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
   * Get all samples from all kits
   */
  private async getAllSamplesFromKits(dbDir: string): Promise<DbResult<any[]>> {
    try {
      const { getKits } = await import("../db/romperDbCoreORM.js");
      const kitsResult = getKits(dbDir);
      if (!kitsResult.success || !kitsResult.data) {
        return {
          error: kitsResult.error ?? "Failed to load kits",
          success: false,
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

      return { data: allSamples, success: true };
    } catch (error) {
      return {
        error: `Failed to load kits: ${getErrorMessage(error)}`,
        success: false,
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
    // NOTE: Future enhancement - use actual SD card path when SD card detection is implemented
    // For now, create a sync output directory in the local store
    const syncDir = path.join(localStorePath, "sync_output", kitName);
    const voiceDir = `${sample.voice_number}`;
    return path.join(syncDir, voiceDir, sample.filename);
  }

  /**
   * Process a single sample for sync planning
   */
  private processSampleForSync(
    sample: any,
    localStorePath: string,
    results: {
      filesToConvert: SyncFileOperation[];
      filesToCopy: SyncFileOperation[];
      hasFormatWarnings: boolean;
      totalSize: number;
      validationErrors: SyncValidationError[];
      warnings: string[];
    },
  ): void {
    if (!sample.source_path) {
      return; // Skip samples without source path
    }

    const { filename, kitName, source_path: sourcePath } = sample;

    // Validate source file and handle errors
    const fileValidation = this.validateSourceFile(
      filename,
      sourcePath,
      results,
    );
    if (!fileValidation.isValid) {
      return;
    }

    // Update total size from validation
    results.totalSize += fileValidation.fileSize;

    // Determine operation type and add to appropriate list
    const destinationPath = this.getDestinationPath(
      localStorePath,
      kitName,
      sample,
    );
    this.categorizeFileOperation(
      sample,
      filename,
      sourcePath,
      destinationPath,
      results,
    );
  }

  /**
   * Validates source file existence and gets size
   */
  private validateSourceFile(
    filename: string,
    sourcePath: string,
    results: any,
  ): { fileSize: number; isValid: boolean } {
    if (!fs.existsSync(sourcePath)) {
      results.validationErrors.push({
        error: `Source file not found: ${sourcePath}`,
        filename,
        sourcePath,
        type: "missing_file",
      });
      return { fileSize: 0, isValid: false };
    }

    const stats = fs.statSync(sourcePath);
    return { fileSize: stats.size, isValid: true };
  }
}

export const syncPlannerService = new SyncPlannerService();

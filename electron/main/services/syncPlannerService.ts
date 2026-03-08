import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { getErrorMessage } from "@romper/shared/errorUtils.js";
import * as fs from "fs";
import * as path from "path";

import {
  type AudioMetadata,
  type FormatIssue,
  type FormatValidationResult,
  getAudioMetadata,
  validateSampleFormat,
} from "../audioUtils.js";
import { getKit, getKitSamples } from "../db/romperDbCoreORM.js";
import { rampleNamingService } from "./rampleNamingService.js";

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
  forceMonoConversion?: boolean;
  isStereo?: boolean;
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
    inMemorySettings: Record<string, unknown>,
  ): Promise<DbResult<SyncChangeSummary>> {
    try {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath || typeof localStorePath !== "string") {
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

      // Annotate per-file mono conversion based on voice stereo_mode
      const allFiles = [...results.filesToConvert, ...results.filesToCopy];
      this.annotateMonoConversion(allFiles, dbDir);

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
    sample: Sample,
    filename: string,
    sourcePath: string,
    destinationPath: string,
    metadataResult: DbResult<AudioMetadata>,
    formatValidationResult: DbResult<FormatValidationResult>,
    results: SyncChangeSummary,
  ): void {
    const issues = formatValidationResult.data?.issues || [];
    const issueMessages = issues.map((issue: FormatIssue) => issue.message);

    results.filesToConvert.push({
      destinationPath,
      filename, // Now using the Rample-generated filename passed as parameter
      isStereo: sample.is_stereo,
      kitName: sample.kit_name,
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
      `${sample.filename}: ${issueMessages.join(", ") || "Format conversion required"}`,
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
    isStereo: boolean,
    results: SyncChangeSummary,
  ): void {
    results.filesToCopy.push({
      destinationPath,
      filename, // Now using the Rample-generated filename passed as parameter
      isStereo,
      kitName,
      operation: "copy",
      sourcePath,
    });
  }

  /**
   * Annotate file operations with per-file forceMonoConversion based on voice stereo_mode.
   * For mono voices: stereo samples need conversion to mono (forceMonoConversion = true).
   * For stereo voices: samples pass through as-is.
   */
  private annotateMonoConversion(
    allFiles: SyncFileOperation[],
    dbDir: string,
  ): void {
    // Build a lookup of voice stereo_mode by kit_name + voice_number
    const voiceStereoModeCache = new Map<string, boolean>();

    for (const fileOp of allFiles) {
      const cacheKey = fileOp.kitName;

      // Lazily load kit voices into cache
      if (!voiceStereoModeCache.has(cacheKey + ":loaded")) {
        const kitResult = getKit(dbDir, fileOp.kitName);
        if (kitResult.success && kitResult.data?.voices) {
          for (const voice of kitResult.data.voices) {
            voiceStereoModeCache.set(
              `${fileOp.kitName}:${voice.voice_number}`,
              voice.stereo_mode,
            );
          }
        }
        voiceStereoModeCache.set(cacheKey + ":loaded", true);
      }
    }

    // Annotate each file operation based on voice stereo_mode.
    for (const fileOp of allFiles) {
      // Extract voice number from destination path (e.g., .../kitName/1/filename.wav)
      const pathParts = fileOp.destinationPath.split("/");
      const voiceDirIndex = pathParts.length - 2;
      const voiceNumberStr = pathParts[voiceDirIndex];
      const voiceNumber = parseInt(voiceNumberStr, 10);

      if (isNaN(voiceNumber)) {
        continue;
      }

      const voiceStereoMode = voiceStereoModeCache.get(
        `${fileOp.kitName}:${voiceNumber}`,
      );

      // Only force mono conversion for stereo samples on explicitly mono voices
      if (voiceStereoMode === false && fileOp.isStereo) {
        fileOp.forceMonoConversion = true;

        // Promote copy to convert — stereo file needs channel conversion for mono voice
        if (fileOp.operation === "copy") {
          fileOp.operation = "convert";
          fileOp.reason =
            "Stereo sample on mono voice requires mono conversion";
        }
      }
    }
  }

  /**
   * Categorizes file operation as copy or convert
   */
  private categorizeFileOperation(
    sample: Sample,
    filename: string,
    sourcePath: string,
    destinationPath: string,
    results: SyncChangeSummary,
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
        sample.kit_name,
        sample.is_stereo,
        results,
      );
    }
  }

  /**
   * Get all samples from all kits
   */
  private async getAllSamplesFromKits(
    dbDir: string,
  ): Promise<DbResult<Sample[]>> {
    try {
      const { getKits } = await import("../db/romperDbCoreORM.js");
      const kitsResult = getKits(dbDir);
      if (!kitsResult.success || !kitsResult.data) {
        return {
          error: kitsResult.error ?? "Failed to load kits",
          success: false,
        };
      }

      let allSamples: Sample[] = [];
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
   * Get the destination path and filename for a sample on the SD card using Rample naming convention
   * Returns both to avoid coupling between path generation and filename extraction
   */
  private getDestinationPathAndFilename(
    localStorePath: string,
    sample: Sample,
  ): { destinationPath: string; filename: string } {
    // NOTE: Future enhancement - use actual SD card path when SD card detection is implemented
    // For now, create a sync output directory in the local store with Rample structure
    const syncOutputRoot = path.join(localStorePath, "sync_output");

    // Use Rample naming service to generate compliant path and filename
    return rampleNamingService.transformSampleToPathAndFilename(
      sample,
      syncOutputRoot,
    );
  }

  /**
   * Process a single sample for sync planning
   */
  private processSampleForSync(
    sample: Sample,
    localStorePath: string,
    results: SyncChangeSummary,
  ): void {
    if (!sample.source_path) {
      return; // Skip samples without source path
    }

    const { filename, source_path: sourcePath } = sample;

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
    const { destinationPath, filename: rampleFilename } =
      this.getDestinationPathAndFilename(localStorePath, sample);

    this.categorizeFileOperation(
      sample,
      rampleFilename,
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
    results: SyncChangeSummary,
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

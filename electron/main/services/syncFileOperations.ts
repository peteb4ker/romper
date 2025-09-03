import type { Sample } from "@romper/shared/db/schema.js";

import * as fs from "fs";
import * as path from "path";

import type { FormatValidationResult } from "../audioUtils.js";

import { convertToRampleDefault } from "../formatConverter.js";
import { syncProgressManager } from "./syncProgressManager.js";
import {
  type SyncValidationError,
  syncValidationService,
} from "./syncValidationService.js";

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

export interface SyncResults {
  filesToConvert: SyncFileOperation[];
  filesToCopy: SyncFileOperation[];
  hasFormatWarnings: boolean;
  validationErrors: SyncValidationError[];
  warnings: string[];
}

/**
 * Service responsible for file operations during sync process
 */
export class SyncFileOperationsService {
  /**
   * Categorize file operation (copy vs convert) based on format validation
   */
  categorizeSyncFileOperation(
    sample: Sample,
    filename: string,
    sourcePath: string,
    destinationPath: string,
    results: SyncResults,
  ): void {
    const validationErrors = results.validationErrors;
    const validation = syncValidationService.validateSyncSourceFile(
      filename,
      sourcePath,
      validationErrors,
    );

    if (!validation.isValid) {
      return;
    }

    const formatValidation =
      syncValidationService.validateSampleFormat(sourcePath);

    if (!formatValidation.success || !formatValidation.data) {
      syncValidationService.addValidationError(
        validationErrors,
        filename,
        sourcePath,
        `Format validation failed: ${formatValidation.error}`,
      );
      return;
    }

    const format = formatValidation.data;

    if (format.issues && format.issues.length > 0) {
      this.addSyncFileToConvert(sample, destinationPath, format, results);
    } else {
      this.addSyncFileToCopy(sample, destinationPath, format, results);
    }
  }

  /**
   * Ensure destination directory exists
   */
  ensureDestinationDirectory(destinationPath: string): void {
    const destinationDir = path.dirname(destinationPath);
    if (!fs.existsSync(destinationDir)) {
      fs.mkdirSync(destinationDir, { recursive: true });
    }
  }

  /**
   * Execute the actual file operation (copy or convert)
   */
  async executeFileOperation(
    fileOp: SyncFileOperation,
    inMemorySettings: Record<string, unknown>,
  ): Promise<void> {
    if (fileOp.operation === "copy") {
      fs.copyFileSync(fileOp.sourcePath, fileOp.destinationPath);
    } else if (fileOp.operation === "convert") {
      await this.handleFileConversion(fileOp, inMemorySettings);
    }
  }

  /**
   * Handle file processing errors
   */
  handleFileProcessingError(fileOp: SyncFileOperation, error: unknown): void {
    const categorizedError = syncValidationService.categorizeError(
      error,
      fileOp.sourcePath,
    );

    syncProgressManager.emitErrorProgress(fileOp, {
      canRetry: categorizedError.canRetry,
      error: categorizedError.userMessage,
    });
  }

  /**
   * Process all file operations
   */
  async processAllFiles(
    allFiles: SyncFileOperation[],
    inMemorySettings: Record<string, unknown>,
    _sdCardPath?: string,
  ): Promise<number> {
    let syncedFiles = 0;
    const totalFiles = allFiles.length;

    for (const fileOp of allFiles) {
      if (syncProgressManager.getCurrentSyncJob()?.cancelled) {
        break;
      }

      try {
        await this.processSingleFile(
          fileOp,
          syncedFiles,
          totalFiles,
          inMemorySettings,
        );
        syncedFiles++;
      } catch (error) {
        this.handleFileProcessingError(fileOp, error);
        throw error;
      }
    }

    return syncedFiles;
  }

  /**
   * Process a single file operation
   */
  async processSingleFile(
    fileOp: SyncFileOperation,
    syncedFiles: number,
    totalFiles: number,
    inMemorySettings: Record<string, unknown>,
  ): Promise<void> {
    syncProgressManager.emitFileStartProgress(fileOp);

    this.ensureDestinationDirectory(fileOp.destinationPath);

    await this.executeFileOperation(fileOp, inMemorySettings);

    syncProgressManager.emitFileCompletionProgress(fileOp);
  }

  /**
   * Add file to convert list
   */
  private addSyncFileToConvert(
    sample: Sample,
    destinationPath: string,
    format: FormatValidationResult,
    results: SyncResults,
  ): void {
    const issues = format.issues || [];
    const reasons = issues.map((issue) => issue.message).join(", ");

    results.filesToConvert.push({
      destinationPath,
      filename: sample.filename,
      kitName: sample.kit_name,
      operation: "convert",
      originalFormat: "Audio file (needs conversion)",
      reason: reasons,
      sourcePath: sample.source_path,
      targetFormat: "WAV (16-bit, mono/stereo)",
    });

    results.hasFormatWarnings = true;
  }

  /**
   * Add file to copy list
   */
  private addSyncFileToCopy(
    sample: Sample,
    destinationPath: string,
    format: FormatValidationResult,
    results: SyncResults,
  ): void {
    results.filesToCopy.push({
      destinationPath,
      filename: sample.filename,
      kitName: sample.kit_name,
      operation: "copy",
      originalFormat: "Compatible audio file",
      sourcePath: sample.source_path,
    });
  }

  /**
   * Handle file conversion operation
   */
  private async handleFileConversion(
    fileOp: SyncFileOperation,
    inMemorySettings: Record<string, unknown>,
  ): Promise<void> {
    const forceMonoConversion = Boolean(inMemorySettings.defaultToMonoSamples);
    const conversionResult = await convertToRampleDefault(
      fileOp.sourcePath,
      fileOp.destinationPath,
      forceMonoConversion,
    );
    if (!conversionResult.success) {
      // Check if this is a WAV format error that we can ignore
      const isWavFormatError =
        conversionResult.error?.toLowerCase().includes("missing fmt chunk") ||
        conversionResult.error?.toLowerCase().includes("invalid wav file");
      if (isWavFormatError) {
        console.warn(
          `Skipping problematic WAV file ${fileOp.filename}: ${conversionResult.error}`,
        );
        // Copy the original file instead of converting it
        try {
          const fs = await import("fs");
          fs.copyFileSync(fileOp.sourcePath, fileOp.destinationPath);
          return; // Successfully handled by copying instead
        } catch (copyError) {
          console.error(
            `Failed to copy problematic file ${fileOp.filename}:`,
            copyError,
          );
        }
      }
      throw new Error(
        `Failed to convert ${fileOp.filename}: ${conversionResult.error}`,
      );
    }
  }
}

export const syncFileOperationsService = new SyncFileOperationsService();

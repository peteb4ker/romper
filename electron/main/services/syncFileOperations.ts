import type { Sample } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import * as path from "node:path";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";

import {
  type FormatValidationResult,
  isFormatIssueCritical,
} from "../audioUtils.js";
import { convertToRampleDefault } from "../formatConverter.js";
import { syncProgressManager } from "./syncProgressManager.js";
import {
  type SyncValidationError,
  syncValidationService,
} from "./syncValidationService.js";

export interface SyncFileOperation {
  /**
   * The source file's channel count, from its header. Mono conversion keys
   * on this and the voice's stereo setting (RE-29).
   */
  channels?: number;
  destinationPath: string;
  filename: string;
  forceMonoConversion?: boolean;
  gainDb?: number;
  kitName: string;
  operation: "convert" | "copy";
  originalFormat?: string;
  reason?: string;
  sourcePath: string;
  targetFormat?: string;
  /** The voice (1-4) the sample plays on */
  voiceNumber: number;
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
   * Categorize file operation (copy vs convert) based on format validation.
   * The caller has already checked that the source exists.
   */
  async categorizeSyncFileOperation(
    sample: Sample,
    filename: string,
    sourcePath: string,
    destinationPath: string,
    results: SyncResults,
  ): Promise<void> {
    const validationErrors = results.validationErrors;
    const firstNewError = validationErrors.length;
    try {
      await this.categorizeReadableFile(
        sample,
        filename,
        sourcePath,
        destinationPath,
        results,
      );
    } finally {
      // The file exists (the caller checked), so any failure here is a WAV
      // Romper can't read (#537 rule 4)
      for (const error of validationErrors.slice(firstNewError)) {
        error.unreadable = true;
      }
    }
  }

  /**
   * Ensure destination directory exists
   */
  async ensureDestinationDirectory(destinationPath: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
  }

  /**
   * Execute the actual file operation (copy or convert)
   */
  async executeFileOperation(
    fileOp: SyncFileOperation,
    inMemorySettings: Record<string, unknown>,
  ): Promise<void> {
    // Non-zero gain requires decode/re-encode even for "copy" operations
    const needsGainConversion = fileOp.gainDb != null && fileOp.gainDb !== 0;
    if (fileOp.operation === "copy" && !needsGainConversion) {
      await fs.promises.copyFile(fileOp.sourcePath, fileOp.destinationPath);
    } else {
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
   * Process all file operations. The main process stays responsive: file
   * I/O is asynchronous and the loop yields to the event loop after every
   * file, so IPC (progress, Cancel) is handled while a sync runs (RE-07).
   * A cancelled sync stops after the file in progress.
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
        await yieldToEventLoop();
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

    await this.ensureDestinationDirectory(fileOp.destinationPath);

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
      channels: format.metadata?.channels,
      destinationPath,
      filename: sample.filename,
      gainDb: sample.gain_db,
      kitName: sample.kit_name,
      operation: "convert",
      originalFormat: "Audio file (needs conversion)",
      reason: reasons,
      sourcePath: sample.source_path,
      targetFormat: "WAV (16-bit, mono/stereo)",
      voiceNumber: sample.voice_number,
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
      channels: format.metadata?.channels,
      destinationPath,
      filename: sample.filename,
      gainDb: sample.gain_db,
      kitName: sample.kit_name,
      operation: "copy",
      originalFormat: "Compatible audio file",
      sourcePath: sample.source_path,
      voiceNumber: sample.voice_number,
    });
  }

  private async categorizeReadableFile(
    sample: Sample,
    filename: string,
    sourcePath: string,
    destinationPath: string,
    results: SyncResults,
  ): Promise<void> {
    const validationErrors = results.validationErrors;
    const formatValidation =
      await syncValidationService.validateSampleFormat(sourcePath);

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

    // A file that can't be read or isn't a usable WAV is listed in the
    // summary as a sample that can't be written (RE-08), never copied as-is.
    const unusable = format.issues?.find(isFormatIssueCritical);
    if (unusable) {
      validationErrors.push({
        error: unusable.message,
        filename,
        sourcePath,
        type: "invalid_format",
      });
      return;
    }

    if (format.issues && format.issues.length > 0) {
      this.addSyncFileToConvert(sample, destinationPath, format, results);
    } else {
      this.addSyncFileToCopy(sample, destinationPath, format, results);
    }
  }

  /**
   * Handle file conversion operation
   */
  private async handleFileConversion(
    fileOp: SyncFileOperation,
    _inMemorySettings: Record<string, unknown>,
  ): Promise<void> {
    const forceMonoConversion = Boolean(fileOp.forceMonoConversion);
    const conversionResult = await convertToRampleDefault(
      fileOp.sourcePath,
      fileOp.destinationPath,
      forceMonoConversion,
      fileOp.gainDb,
    );
    if (!conversionResult.success) {
      throw new Error(
        `Failed to convert ${fileOp.filename}: ${conversionResult.error}`,
      );
    }
  }
}

export const syncFileOperationsService = new SyncFileOperationsService();

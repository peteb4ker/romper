import type { Sample } from "@romper/shared/db/schema.js";
import type { SyncValidationError } from "@romper/shared/electronApi.js";

import { DEVICE_SAVE_FOLDER } from "@romper/shared/rampleCardLayout.js";
import {
  type ConversionReason,
  isShorterThanRampleMinimum,
  planConversion,
  type SampleFormat,
} from "@romper/shared/rampleFormat.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";

import {
  type FormatValidationResult,
  isFormatIssueCritical,
} from "../audioUtils.js";
import { cardFileMatches } from "../cardFileMatch.js";
import { convertToRampleDefault } from "../formatConverter.js";
import { withCardWatchdog } from "./cardWatchdog.js";
import {
  reachesDeviceSaveFolder,
  removeAppleDoubleCompanion,
} from "./sdCardSafety.js";
import { syncProgressManager } from "./syncProgressManager.js";
import { syncValidationService } from "./syncValidationService.js";

export interface SyncFileOperation {
  /**
   * The source file's channel count, from its header. Mono conversion keys
   * on this and the voice's stereo setting (RE-29).
   */
  channels?: number;
  /**
   * Why the file is re-encoded (`planConversion`, #576): "format" or
   * "gain"; null when it's copied as it is
   */
  conversion?: ConversionReason | null;
  destinationPath: string;
  filename: string;
  forceMonoConversion?: boolean;
  /** The source file's format, from its header */
  format?: SampleFormat;
  gainDb?: number;
  kitName: string;
  operation: "convert" | "copy";
  originalFormat?: string;
  reason?: string;
  sourcePath: string;
  targetFormat?: string;
  /** Shorter than the Rample's 50 ms minimum (#576) */
  tooShort?: boolean;
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
   * Execute the actual file operation (copy or convert). A file the card
   * already holds byte for byte isn't written again (#650); a conversion
   * checks its output the same way (formatConverter).
   */
  async executeFileOperation(
    fileOp: SyncFileOperation,
    inMemorySettings: Record<string, unknown>,
  ): Promise<void> {
    // Non-zero gain requires decode/re-encode even for "copy" operations
    const needsGainConversion = fileOp.gainDb != null && fileOp.gainDb !== 0;
    if (fileOp.operation === "copy" && !needsGainConversion) {
      if (await cardFileMatches(fileOp.sourcePath, fileOp.destinationPath)) {
        return;
      }
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
   *
   * Writing to a card, it refuses the whole list, before writing anything,
   * if a file would land in the device's `_save` folder (#787): sample
   * files only ever go in kit folders.
   */
  async processAllFiles(
    allFiles: SyncFileOperation[],
    inMemorySettings: Record<string, unknown>,
    sdCardPath?: string,
  ): Promise<number> {
    const intoSaveFolder = sdCardPath
      ? allFiles.find((fileOp) =>
          reachesDeviceSaveFolder(sdCardPath, fileOp.destinationPath),
        )
      : undefined;
    if (intoSaveFolder) {
      throw new Error(
        `Refusing to write ${intoSaveFolder.destinationPath}: the Rample's ${DEVICE_SAVE_FOLDER} folder belongs to the device`,
      );
    }

    let syncedFiles = 0;
    const totalFiles = allFiles.length;

    for (const fileOp of allFiles) {
      if (syncProgressManager.getCurrentSyncJob()?.cancelled) {
        break;
      }

      try {
        // prettier-ignore
        await this.processSingleFile( // NOSONAR - one file at a time so progress and Cancel stay accurate (RE-07)
          fileOp,
          syncedFiles,
          totalFiles,
          inMemorySettings,
        );
        syncedFiles++;
        await yieldToEventLoop(); // NOSONAR - yields to the event loop between files on purpose (RE-07)
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

    // A card that stops responding fails the write rather than leaving it
    // waiting forever (#653)
    await withCardWatchdog(
      (async () => {
        await this.ensureDestinationDirectory(fileOp.destinationPath);
        await this.executeFileOperation(fileOp, inMemorySettings);
        await removeAppleDoubleCompanion(fileOp.destinationPath);
      })(),
    );

    syncProgressManager.emitFileCompletionProgress(fileOp);
  }

  /**
   * Queue a sample's file as a copy or a conversion, as the shared rule
   * plans it (`planConversion`, #576). The voice's stereo setting isn't
   * known yet; `annotateMonoConversion` applies it once the stereo plan is
   * made.
   */
  private addSyncFile(
    sample: Sample,
    destinationPath: string,
    format: FormatValidationResult,
    results: SyncResults,
  ): void {
    const metadata = format.metadata ?? {};
    const plan = planConversion(metadata, { gainDb: sample.gain_db });
    const common = {
      channels: metadata.channels,
      conversion: plan.reason,
      destinationPath,
      filename: sample.filename,
      format: metadata,
      gainDb: sample.gain_db,
      kitName: sample.kit_name,
      sourcePath: sample.source_path,
      tooShort: isShorterThanRampleMinimum(metadata),
      voiceNumber: sample.voice_number,
    };

    // A header the write reads always has the format; were it unknown,
    // converting writes a known one
    if (plan.reason === null && !plan.unknown) {
      results.filesToCopy.push({
        ...common,
        operation: "copy",
        originalFormat: "Compatible audio file",
      });
      return;
    }

    results.filesToConvert.push({
      ...common,
      conversion: plan.reason ?? "format",
      operation: "convert",
      originalFormat: "Audio file (needs conversion)",
      reason:
        plan.reason === "gain"
          ? "Re-encoded to apply the sample's gain"
          : plan.issues.map((issue) => issue.message).join(", "),
      targetFormat: "WAV (16-bit, mono/stereo)",
    });
    if (plan.reason !== "gain") results.hasFormatWarnings = true;
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

    this.addSyncFile(sample, destinationPath, format, results);
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

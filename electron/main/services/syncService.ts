import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";

import type { DbResult, Sample } from "../../../shared/db/schema.js";
import { getAudioMetadata, validateSampleFormat } from "../audioUtils.js";
import { getKitSamples, markKitsAsSynced } from "../db/romperDbCoreORM.js";
import { convertToRampleDefault } from "../formatConverter.js";

export interface SyncFileOperation {
  filename: string;
  sourcePath: string;
  destinationPath: string;
  operation: "copy" | "convert";
  reason?: string;
  originalFormat?: string;
  targetFormat?: string;
  kitName: string; // Track which kit this file belongs to
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
  estimatedTime: number;
  estimatedSize: number;
  hasFormatWarnings: boolean;
  warnings: string[];
  validationErrors: SyncValidationError[];
}

export interface SyncProgress {
  currentFile: string;
  filesCompleted: number;
  totalFiles: number;
  bytesTransferred: number;
  totalBytes: number;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  status: "preparing" | "copying" | "converting" | "complete" | "error";
  currentFileProgress?: number; // 0-100 percentage for current file
  errorDetails?: {
    fileName: string;
    operation: "copy" | "convert";
    error: string;
    canRetry: boolean;
  };
}

class SyncService {
  private currentSyncJob: {
    kitName: string;
    totalFiles: number;
    completedFiles: number;
    startTime: number;
    cancelled: boolean;
    totalBytes: number;
    bytesTransferred: number;
    fileOperations: SyncFileOperation[];
  } | null = null;

  /**
   * Gather all samples from all kits
   */
  private async gatherAllSamples(dbDir: string): Promise<DbResult<any[]>> {
    try {
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

      return { success: true, data: allSamples };
    } catch (error) {
      return {
        success: false,
        error: `Failed to gather samples: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Process a single sample for sync operations
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

    const { filename, source_path: sourcePath, kitName } = sample;

    // Validate source file and handle errors
    const fileValidation = this.validateSyncSourceFile(
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
    this.categorizeSyncFileOperation(
      sample,
      filename,
      sourcePath,
      destinationPath,
      results,
    );
  }

  /**
   * Validates source file existence and gets size for sync
   */
  private validateSyncSourceFile(
    filename: string,
    sourcePath: string,
    results: any,
  ): { isValid: boolean; fileSize: number } {
    if (!fs.existsSync(sourcePath)) {
      results.validationErrors.push({
        filename,
        sourcePath,
        error: `Source file not found: ${sourcePath}`,
        type: "missing_file",
      });
      return { isValid: false, fileSize: 0 };
    }

    const stats = fs.statSync(sourcePath);
    return { isValid: true, fileSize: stats.size };
  }

  /**
   * Categorizes sync file operation as copy or convert
   */
  private categorizeSyncFileOperation(
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
      this.addSyncFileToConvert(
        sample,
        filename,
        sourcePath,
        destinationPath,
        metadataResult,
        formatValidationResult,
        results,
      );
    } else {
      this.addSyncFileToCopy(
        filename,
        sourcePath,
        destinationPath,
        sample.kitName,
        results,
      );
    }
  }

  /**
   * Add file to sync conversion list
   */
  private addSyncFileToConvert(
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
   * Add file to sync copy list
   */
  private addSyncFileToCopy(
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

      // Gather all samples from all kits
      const samplesResult = await this.gatherAllSamples(dbDir);
      if (!samplesResult.success) {
        return { success: false, error: samplesResult.error };
      }

      const samples = samplesResult.data;
      if (!samples) {
        return { success: false, error: "No samples found to sync" };
      }

      const results = {
        filesToCopy: [] as SyncFileOperation[],
        filesToConvert: [] as SyncFileOperation[],
        warnings: [] as string[],
        validationErrors: [] as SyncValidationError[],
        totalSize: 0,
        hasFormatWarnings: false,
      };

      // Process each sample
      for (const sample of samples) {
        this.processSampleForSync(sample, localStorePath, results);
      }

      // Calculate estimates
      const totalFiles =
        results.filesToCopy.length + results.filesToConvert.length;
      const estimatedTime = this.estimateSyncTime(
        totalFiles,
        results.totalSize,
        results.filesToConvert.length,
      );

      const summary: SyncChangeSummary = {
        filesToCopy: results.filesToCopy,
        filesToConvert: results.filesToConvert,
        estimatedTime,
        estimatedSize: results.totalSize,
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
   * Start syncing all kits to SD card
   */
  async startKitSync(
    inMemorySettings: Record<string, any>,
    syncData: {
      filesToCopy: SyncFileOperation[];
      filesToConvert: SyncFileOperation[];
    },
  ): Promise<DbResult<{ syncedFiles: number }>> {
    try {
      const allFiles = [...syncData.filesToCopy, ...syncData.filesToConvert];
      const totalBytes = this.calculateTotalBytes(allFiles);

      this.initializeSyncJob(allFiles, totalBytes);

      const syncedFiles = await this.processAllFiles(
        allFiles,
        inMemorySettings,
      );

      this.emitCompletionProgress(syncedFiles, allFiles.length);

      const wasCancelled = this.finalizeSyncJob();
      if (wasCancelled) {
        return { success: false, error: "Sync operation was cancelled" };
      }

      await this.markKitsAsSynced(inMemorySettings, allFiles, syncedFiles);

      return { success: true, data: { syncedFiles } };
    } catch (error) {
      await this.handleSyncFailure(inMemorySettings, error);
      return {
        success: false,
        error: `Failed to sync kit: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Calculate total bytes for all file operations
   */
  private calculateTotalBytes(allFiles: SyncFileOperation[]): number {
    let totalBytes = 0;
    for (const fileOp of allFiles) {
      try {
        if (fs.existsSync(fileOp.sourcePath)) {
          const stats = fs.statSync(fileOp.sourcePath);
          totalBytes += stats.size;
        }
      } catch (error) {
        console.warn(
          `Failed to get file size for ${fileOp.sourcePath}:`,
          error,
        );
      }
    }
    return totalBytes;
  }

  /**
   * Initialize sync job tracking
   */
  private initializeSyncJob(
    allFiles: SyncFileOperation[],
    totalBytes: number,
  ): void {
    this.currentSyncJob = {
      kitName: "All Kits",
      totalFiles: allFiles.length,
      completedFiles: 0,
      startTime: Date.now(),
      cancelled: false,
      totalBytes,
      bytesTransferred: 0,
      fileOperations: allFiles,
    };
  }

  /**
   * Process all files in the sync operation
   */
  private async processAllFiles(
    allFiles: SyncFileOperation[],
    inMemorySettings: Record<string, any>,
  ): Promise<number> {
    let syncedFiles = 0;

    for (const fileOp of allFiles) {
      if (this.currentSyncJob?.cancelled) {
        break;
      }

      try {
        await this.processSingleFile(
          fileOp,
          syncedFiles,
          allFiles.length,
          inMemorySettings,
        );
        syncedFiles++;
        if (this.currentSyncJob) {
          this.currentSyncJob.completedFiles = syncedFiles;
        }
      } catch (error) {
        this.handleFileProcessingError(
          error,
          fileOp,
          syncedFiles,
          allFiles.length,
        );
      }
    }

    return syncedFiles;
  }

  /**
   * Process a single file operation
   */
  private async processSingleFile(
    fileOp: SyncFileOperation,
    syncedFiles: number,
    totalFiles: number,
    inMemorySettings: Record<string, any>,
  ): Promise<void> {
    const fileSize = this.getFileSizeForProgress(fileOp.sourcePath);

    this.emitFileStartProgress(fileOp, syncedFiles, totalFiles);

    this.ensureDestinationDirectory(fileOp.destinationPath);

    await this.executeFileOperation(fileOp, fileSize, inMemorySettings);

    this.emitFileCompletionProgress(fileOp, syncedFiles + 1, totalFiles);
  }

  /**
   * Get file size for progress tracking
   */
  private getFileSizeForProgress(sourcePath: string): number {
    try {
      if (fs.existsSync(sourcePath)) {
        const stats = fs.statSync(sourcePath);
        return stats.size;
      }
    } catch (error) {
      console.warn(`Failed to get file size for ${sourcePath}:`, error);
    }
    return 0;
  }

  /**
   * Ensure destination directory exists
   */
  private ensureDestinationDirectory(destinationPath: string): void {
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
  }

  /**
   * Execute the actual file operation (copy or convert)
   */
  private async executeFileOperation(
    fileOp: SyncFileOperation,
    fileSize: number,
    inMemorySettings: Record<string, any>,
  ): Promise<void> {
    if (fileOp.operation === "copy") {
      fs.copyFileSync(fileOp.sourcePath, fileOp.destinationPath);
      this.updateBytesTransferred(fileSize);
    } else if (fileOp.operation === "convert") {
      await this.handleFileConversion(fileOp, fileSize, inMemorySettings);
    }
  }

  /**
   * Handle file conversion operation
   */
  private async handleFileConversion(
    fileOp: SyncFileOperation,
    originalFileSize: number,
    inMemorySettings: Record<string, any>,
  ): Promise<void> {
    const forceMonoConversion = Boolean(inMemorySettings.defaultToMonoSamples);
    const conversionResult = await convertToRampleDefault(
      fileOp.sourcePath,
      fileOp.destinationPath,
      forceMonoConversion,
    );

    if (!conversionResult.success) {
      throw new Error(
        `Failed to convert ${fileOp.filename}: ${conversionResult.error}`,
      );
    }

    this.updateBytesTransferredForConversion(
      fileOp.destinationPath,
      originalFileSize,
    );
  }

  /**
   * Update bytes transferred for conversion
   */
  private updateBytesTransferredForConversion(
    destinationPath: string,
    originalFileSize: number,
  ): void {
    try {
      if (fs.existsSync(destinationPath)) {
        const convertedStats = fs.statSync(destinationPath);
        this.updateBytesTransferred(convertedStats.size);
      } else {
        this.updateBytesTransferred(originalFileSize);
      }
    } catch {
      this.updateBytesTransferred(originalFileSize);
    }
  }

  /**
   * Update bytes transferred count
   */
  private updateBytesTransferred(bytes: number): void {
    if (this.currentSyncJob) {
      this.currentSyncJob.bytesTransferred += bytes;
    }
  }

  /**
   * Emit progress at start of file processing
   */
  private emitFileStartProgress(
    fileOp: SyncFileOperation,
    syncedFiles: number,
    totalFiles: number,
  ): void {
    if (!this.currentSyncJob) return;

    this.emitProgress({
      currentFile: fileOp.filename,
      filesCompleted: syncedFiles,
      totalFiles,
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      totalBytes: this.currentSyncJob.totalBytes,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: this.calculateTimeRemaining(),
      status: fileOp.operation === "convert" ? "converting" : "copying",
      currentFileProgress: 0,
    });
  }

  /**
   * Emit progress after file completion
   */
  private emitFileCompletionProgress(
    fileOp: SyncFileOperation,
    completedFiles: number,
    totalFiles: number,
  ): void {
    if (!this.currentSyncJob) return;

    this.emitProgress({
      currentFile: fileOp.filename,
      filesCompleted: completedFiles,
      totalFiles,
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      totalBytes: this.currentSyncJob.totalBytes,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: this.calculateTimeRemaining(),
      status: fileOp.operation === "convert" ? "converting" : "copying",
      currentFileProgress: 100,
    });
  }

  /**
   * Handle file processing errors
   */
  private handleFileProcessingError(
    error: any,
    fileOp: SyncFileOperation,
    syncedFiles: number,
    totalFiles: number,
  ): void {
    const errorInfo = this.categorizeError(error, fileOp.sourcePath);
    console.error(
      `Failed to process file ${fileOp.filename}:`,
      errorInfo.userMessage,
    );

    if (this.currentSyncJob) {
      this.emitProgress({
        currentFile: fileOp.filename,
        filesCompleted: syncedFiles,
        totalFiles,
        bytesTransferred: this.currentSyncJob.bytesTransferred,
        totalBytes: this.currentSyncJob.totalBytes,
        elapsedTime: Date.now() - this.currentSyncJob.startTime,
        estimatedTimeRemaining: this.calculateTimeRemaining(),
        status: "error",
        errorDetails: {
          fileName: fileOp.filename,
          operation: fileOp.operation,
          error: errorInfo.userMessage,
          canRetry: errorInfo.canRetry,
        },
      });
    }

    throw new Error(`${fileOp.filename}: ${errorInfo.userMessage}`);
  }

  /**
   * Emit completion progress
   */
  private emitCompletionProgress(
    syncedFiles: number,
    totalFiles: number,
  ): void {
    if (!this.currentSyncJob) return;

    this.emitProgress({
      currentFile: "",
      filesCompleted: syncedFiles,
      totalFiles,
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      totalBytes: this.currentSyncJob.totalBytes,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: 0,
      status: this.currentSyncJob.cancelled ? "error" : "complete",
      currentFileProgress: 100,
    });
  }

  /**
   * Finalize sync job and return cancellation status
   */
  private finalizeSyncJob(): boolean {
    const wasCancelled = this.currentSyncJob?.cancelled || false;
    this.currentSyncJob = null;
    return wasCancelled;
  }

  /**
   * Mark kits as synced after successful operation
   */
  private async markKitsAsSynced(
    inMemorySettings: Record<string, any>,
    allFiles: SyncFileOperation[],
    syncedFiles: number,
  ): Promise<void> {
    const localStorePath = inMemorySettings.localStorePath;
    if (!localStorePath || !syncedFiles) return;

    const dbDir = path.join(localStorePath, ".romperdb");
    const syncedKitNames = [...new Set(allFiles.map((file) => file.kitName))];

    const markSyncedResult = markKitsAsSynced(dbDir, syncedKitNames);
    if (!markSyncedResult.success) {
      console.warn("Failed to mark kits as synced:", markSyncedResult.error);
    } else {
      console.log(
        `Marked ${syncedKitNames.length} kits as synced:`,
        syncedKitNames,
      );
    }
  }

  /**
   * Handle sync failure and cleanup
   */
  private async handleSyncFailure(
    inMemorySettings: Record<string, any>,
    _error: any,
  ): Promise<void> {
    if (this.currentSyncJob) {
      console.error("Sync failed, attempting cleanup...");

      try {
        const localStorePath = inMemorySettings.localStorePath;
        if (localStorePath) {
          const syncOutputDir = path.join(localStorePath, "sync_output");
          if (fs.existsSync(syncOutputDir)) {
            fs.rmSync(syncOutputDir, { recursive: true, force: true });
            console.log("Cleaned up partial sync files");
          }
        }
      } catch (cleanupError) {
        console.warn("Failed to cleanup partial sync files:", cleanupError);
      }
    }

    this.currentSyncJob = null;
  }

  /**
   * Cancel the current sync operation
   */
  cancelSync(): void {
    if (this.currentSyncJob) {
      this.currentSyncJob.cancelled = true;
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
   * Estimate sync time based on file count, size, and conversion needs
   */
  private estimateSyncTime(
    totalFiles: number,
    totalSize: number,
    conversions: number,
  ): number {
    // Base time per file (seconds)
    const baseTimePerFile = 0.5;
    // Additional time per MB for copying
    const timePerMB = 0.1;
    // Additional time per conversion
    const timePerConversion = 2.0;

    const sizeInMB = totalSize / (1024 * 1024);
    return Math.ceil(
      totalFiles * baseTimePerFile +
        sizeInMB * timePerMB +
        conversions * timePerConversion,
    );
  }

  /**
   * Calculate estimated time remaining based on current progress
   */
  private calculateTimeRemaining(): number {
    if (!this.currentSyncJob) return 0;

    const elapsedTime = Date.now() - this.currentSyncJob.startTime;
    const elapsedSeconds = elapsedTime / 1000;

    if (this.currentSyncJob.completedFiles === 0) return 0;

    // Calculate progress based on files completed and bytes transferred
    const fileProgress =
      this.currentSyncJob.completedFiles / this.currentSyncJob.totalFiles;
    const byteProgress =
      this.currentSyncJob.totalBytes > 0
        ? this.currentSyncJob.bytesTransferred / this.currentSyncJob.totalBytes
        : 0;

    // Use the average of file and byte progress for more accurate estimation
    const overallProgress = (fileProgress + byteProgress) / 2;

    if (overallProgress === 0) return 0;

    const estimatedTotalTime = elapsedSeconds / overallProgress;
    return Math.max(0, Math.ceil(estimatedTotalTime - elapsedSeconds));
  }

  /**
   * Categorize sync errors for better error reporting
   */
  private categorizeError(
    error: any,
    filePath?: string,
  ): {
    type:
      | "file_access"
      | "format_error"
      | "disk_space"
      | "permission"
      | "network"
      | "unknown";
    canRetry: boolean;
    userMessage: string;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorLower = errorMessage.toLowerCase();

    if (
      errorLower.includes("enoent") ||
      errorLower.includes("file not found")
    ) {
      return {
        type: "file_access",
        canRetry: false,
        userMessage: `Source file not found: ${filePath || "unknown file"}`,
      };
    }

    if (
      errorLower.includes("eacces") ||
      errorLower.includes("permission denied")
    ) {
      return {
        type: "permission",
        canRetry: true,
        userMessage: "Permission denied. Check file/folder permissions.",
      };
    }

    if (errorLower.includes("enospc") || errorLower.includes("no space")) {
      return {
        type: "disk_space",
        canRetry: false,
        userMessage: "Not enough disk space on destination drive.",
      };
    }

    if (
      errorLower.includes("format") ||
      errorLower.includes("wav") ||
      errorLower.includes("audio")
    ) {
      return {
        type: "format_error",
        canRetry: false,
        userMessage: `Audio format error: ${errorMessage}`,
      };
    }

    if (errorLower.includes("network") || errorLower.includes("connection")) {
      return {
        type: "network",
        canRetry: true,
        userMessage: "Network error. Check connection and try again.",
      };
    }

    return {
      type: "unknown",
      canRetry: true,
      userMessage: `Unexpected error: ${errorMessage}`,
    };
  }

  /**
   * Emit progress updates to the renderer process
   */
  private emitProgress(progress: SyncProgress): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send("sync-progress", progress);
    }
  }
}

export const syncService = new SyncService();

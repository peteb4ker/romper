import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { BrowserWindow } from "electron";
import * as fs from "fs";
import * as path from "path";

import { getAudioMetadata, validateSampleFormat, type FormatValidationResult, type AudioMetadata, type FormatIssue } from "../audioUtils.js";
import { getKitSamples, markKitsAsSynced } from "../db/romperDbCoreORM.js";
import { convertToRampleDefault } from "../formatConverter.js";

export interface SyncChangeSummary {
  fileCount: number;
  kitCount: number;
}

export interface SyncFileOperation {
  destinationPath: string;
  filename: string;
  kitName: string; // Track which kit this file belongs to
  operation: "convert" | "copy";
  originalFormat?: string;
  reason?: string;
  sourcePath: string;
  targetFormat?: string;
}

export interface SyncProgress {
  bytesTransferred: number;
  currentFile: string;
  currentFileProgress?: number; // 0-100 percentage for current file
  elapsedTime: number;
  errorDetails?: {
    canRetry: boolean;
    error: string;
    fileName: string;
    operation: "convert" | "copy";
  };
  estimatedTimeRemaining: number;
  filesCompleted: number;
  status: "complete" | "converting" | "copying" | "error" | "preparing";
  totalBytes: number;
  totalFiles: number;
}

export interface SyncValidationError {
  error: string;
  filename: string;
  sourcePath: string;
  type: "access_denied" | "invalid_format" | "missing_file" | "other";
}

interface SyncResults {
  filesToConvert: SyncFileOperation[];
  hasFormatWarnings: boolean;
  warnings: string[];
}

class SyncService {
  private currentSyncJob: {
    bytesTransferred: number;
    cancelled: boolean;
    completedFiles: number;
    fileOperations: SyncFileOperation[];
    kitName: string;
    startTime: number;
    totalBytes: number;
    totalFiles: number;
  } | null = null;

  /**
   * Cancel the current sync operation
   */
  cancelSync(): void {
    if (this.currentSyncJob) {
      this.currentSyncJob.cancelled = true;
    }
  }

  /**
   * Generate a summary of changes needed to sync all kits to SD card
   */
  async generateChangeSummary(
    inMemorySettings: Record<string, unknown>,
    _sdCardPath?: string,
  ): Promise<DbResult<SyncChangeSummary>> {
    try {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath || typeof localStorePath !== 'string') {
        return { error: "No local store path configured", success: false };
      }

      const dbDir = path.join(localStorePath, ".romperdb");

      // Get kit count
      const { getKits } = await import("../db/romperDbCoreORM.js");
      const kitsResult = getKits(dbDir);
      if (!kitsResult.success || !kitsResult.data) {
        return {
          error: kitsResult.error ?? "Failed to load kits",
          success: false,
        };
      }
      const kitCount = kitsResult.data.length;

      // Get all samples for counting and size calculation
      const samplesResult = await this.gatherAllSamples(dbDir);
      if (!samplesResult.success) {
        return { error: samplesResult.error, success: false };
      }

      const samples = samplesResult.data;
      const fileCount = samples ? samples.length : 0;

      console.log("[Backend] Samples result:", {
        sampleCount: fileCount,
        success: samplesResult.success,
      });

      const summary: SyncChangeSummary = {
        fileCount,
        kitCount,
      };

      console.log("[Backend] Generated sync summary:", summary);
      return { data: summary, success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        error: `Failed to generate sync summary: ${errorMessage}`,
        success: false,
      };
    }
  }

  /**
   * Start syncing all kits to SD card
   */
  async startKitSync(
    inMemorySettings: Record<string, unknown>,
    options: {
      sdCardPath: string;
      wipeSdCard?: boolean;
    },
  ): Promise<DbResult<{ syncedFiles: number }>> {
    try {
      // For now, we need to generate file operations for sync
      // This is a temporary fix - we should separate summary from sync operations
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath || typeof localStorePath !== 'string') {
        return { error: "No local store path configured", success: false };
      }

      const dbDir = path.join(localStorePath, ".romperdb");
      const samplesResult = await this.gatherAllSamples(dbDir);
      if (!samplesResult.success) {
        return { error: samplesResult.error, success: false };
      }

      // Generate file operations for actual sync using existing logic
      const results = {
        filesToConvert: [] as SyncFileOperation[],
        filesToCopy: [] as SyncFileOperation[],
        hasFormatWarnings: false,
        totalSize: 0,
        validationErrors: [] as SyncValidationError[],
        warnings: [] as string[],
      };

      const samples = samplesResult.data || [];
      for (const sample of samples) {
        this.processSampleForSync(
          sample,
          localStorePath,
          results,
          options.sdCardPath,
        );
      }

      const allFiles = [...results.filesToCopy, ...results.filesToConvert];
      const totalBytes = this.calculateTotalBytes(allFiles);

      // Handle SD card wiping if requested
      if (options.wipeSdCard && options.sdCardPath) {
        await this.wipeSdCard(options.sdCardPath);
      }

      this.initializeSyncJob(allFiles, totalBytes);

      const syncedFiles = await this.processAllFiles(
        allFiles,
        inMemorySettings,
        options.sdCardPath,
      );

      this.emitCompletionProgress(syncedFiles, allFiles.length);

      const wasCancelled = this.finalizeSyncJob();
      if (wasCancelled) {
        return { error: "Sync operation was cancelled", success: false };
      }

      await this.markKitsAsSynced(inMemorySettings, allFiles, syncedFiles);

      return { data: { syncedFiles }, success: true };
    } catch (error) {
      await this.handleSyncFailure(inMemorySettings, error);
      return {
        error: `Failed to sync kit: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  }

  /**
   * Add file to sync conversion list
   */
  private addSyncFileToConvert(
    sample: Sample,
    filename: string,
    sourcePath: string,
    destinationPath: string,
    metadataResult: DbResult<AudioMetadata>,
    formatValidationResult: DbResult<FormatValidationResult>,
    results: SyncResults,
  ): void {
    const issues = formatValidationResult.data?.issues || [];
    const issueMessages = issues.map((issue: FormatIssue) => issue.message);

    results.filesToConvert.push({
      destinationPath,
      filename,
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
    results: unknown,
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
   * Categorize sync errors for better error reporting
   */
  private categorizeError(
    error: unknown,
    filePath?: string,
  ): {
    canRetry: boolean;
    type:
      | "disk_space"
      | "file_access"
      | "format_error"
      | "network"
      | "permission"
      | "unknown";
    userMessage: string;
  } {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorLower = errorMessage.toLowerCase();

    if (
      errorLower.includes("enoent") ||
      errorLower.includes("file not found")
    ) {
      return {
        canRetry: false,
        type: "file_access",
        userMessage: `Source file not found: ${filePath ?? "unknown file"}`,
      };
    }

    if (
      errorLower.includes("eacces") ||
      errorLower.includes("permission denied")
    ) {
      return {
        canRetry: true,
        type: "permission",
        userMessage: "Permission denied. Check file/folder permissions.",
      };
    }

    if (errorLower.includes("enospc") || errorLower.includes("no space")) {
      return {
        canRetry: false,
        type: "disk_space",
        userMessage: "Not enough disk space on destination drive.",
      };
    }

    if (
      errorLower.includes("format") ||
      errorLower.includes("wav") ||
      errorLower.includes("audio")
    ) {
      return {
        canRetry: false,
        type: "format_error",
        userMessage: `Audio format error: ${errorMessage}`,
      };
    }

    if (errorLower.includes("network") || errorLower.includes("connection")) {
      return {
        canRetry: true,
        type: "network",
        userMessage: "Network error. Check connection and try again.",
      };
    }

    return {
      canRetry: true,
      type: "unknown",
      userMessage: `Unexpected error: ${errorMessage}`,
    };
  }

  /**
   * Categorizes sync file operation as copy or convert
   */
  private categorizeSyncFileOperation(
    sample: unknown,
    filename: string,
    sourcePath: string,
    destinationPath: string,
    results: unknown,
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
   * Emit completion progress
   */
  private emitCompletionProgress(
    syncedFiles: number,
    totalFiles: number,
  ): void {
    if (!this.currentSyncJob) return;

    this.emitProgress({
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      currentFile: "",
      currentFileProgress: 100,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: 0,
      filesCompleted: syncedFiles,
      status: this.currentSyncJob.cancelled ? "error" : "complete",
      totalBytes: this.currentSyncJob.totalBytes,
      totalFiles,
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
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      currentFile: fileOp.filename,
      currentFileProgress: 100,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: this.calculateTimeRemaining(),
      filesCompleted: completedFiles,
      status: fileOp.operation === "convert" ? "converting" : "copying",
      totalBytes: this.currentSyncJob.totalBytes,
      totalFiles,
    });
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
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      currentFile: fileOp.filename,
      currentFileProgress: 0,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: this.calculateTimeRemaining(),
      filesCompleted: syncedFiles,
      status: fileOp.operation === "convert" ? "converting" : "copying",
      totalBytes: this.currentSyncJob.totalBytes,
      totalFiles,
    });
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
   * Execute the actual file operation (copy or convert)
   */
  private async executeFileOperation(
    fileOp: SyncFileOperation,
    fileSize: number,
    inMemorySettings: Record<string, unknown>,
  ): Promise<void> {
    if (fileOp.operation === "copy") {
      fs.copyFileSync(fileOp.sourcePath, fileOp.destinationPath);
      this.updateBytesTransferred(fileSize);
    } else if (fileOp.operation === "convert") {
      await this.handleFileConversion(fileOp, fileSize, inMemorySettings);
    }
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
   * Gather all samples from all kits
   */
  private async gatherAllSamples(dbDir: string): Promise<DbResult<Sample[]>> {
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
   * Get the destination path for a sample on the SD card
   */
  private getDestinationPath(
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
   * Handle file conversion operation
   */
  private async handleFileConversion(
    fileOp: SyncFileOperation,
    originalFileSize: number,
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
          this.updateBytesTransferred(originalFileSize);
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

    this.updateBytesTransferredForConversion(
      fileOp.destinationPath,
      originalFileSize,
    );
  }

  /**
   * Handle file processing errors
   */
  private handleFileProcessingError(
    error: unknown,
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
        bytesTransferred: this.currentSyncJob.bytesTransferred,
        currentFile: fileOp.filename,
        elapsedTime: Date.now() - this.currentSyncJob.startTime,
        errorDetails: {
          canRetry: errorInfo.canRetry,
          error: errorInfo.userMessage,
          fileName: fileOp.filename,
          operation: fileOp.operation,
        },
        estimatedTimeRemaining: this.calculateTimeRemaining(),
        filesCompleted: syncedFiles,
        status: "error",
        totalBytes: this.currentSyncJob.totalBytes,
        totalFiles,
      });
    }

    throw new Error(`${fileOp.filename}: ${errorInfo.userMessage}`);
  }

  /**
   * Handle sync failure and cleanup
   */
  private async handleSyncFailure(
    inMemorySettings: Record<string, unknown>,
    _error: unknown,
  ): Promise<void> {
    if (this.currentSyncJob) {
      console.error("Sync failed, attempting cleanup...");

      try {
        const localStorePath = inMemorySettings.localStorePath;
        if (localStorePath) {
          const syncOutputDir = path.join(localStorePath, "sync_output");
          if (fs.existsSync(syncOutputDir)) {
            fs.rmSync(syncOutputDir, { force: true, recursive: true });
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
   * Initialize sync job tracking
   */
  private initializeSyncJob(
    allFiles: SyncFileOperation[],
    totalBytes: number,
  ): void {
    this.currentSyncJob = {
      bytesTransferred: 0,
      cancelled: false,
      completedFiles: 0,
      fileOperations: allFiles,
      kitName: "All Kits",
      startTime: Date.now(),
      totalBytes,
      totalFiles: allFiles.length,
    };
  }

  /**
   * Mark kits as synced after successful operation
   */
  private async markKitsAsSynced(
    inMemorySettings: Record<string, unknown>,
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
   * Process all files in the sync operation
   */
  private async processAllFiles(
    allFiles: SyncFileOperation[],
    inMemorySettings: Record<string, unknown>,
    _sdCardPath?: string,
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
   * Process a single sample for sync operations
   */
  private processSampleForSync(
    sample: unknown,
    localStorePath: string,
    results: {
      filesToConvert: SyncFileOperation[];
      filesToCopy: SyncFileOperation[];
      hasFormatWarnings: boolean;
      totalSize: number;
      validationErrors: SyncValidationError[];
      warnings: string[];
    },
    sdCardPath?: string,
  ): void {
    if (!sample.source_path) {
      return; // Skip samples without source path
    }

    const { filename, kitName, source_path: sourcePath } = sample;

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
      sdCardPath,
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
   * Process a single file operation
   */
  private async processSingleFile(
    fileOp: SyncFileOperation,
    syncedFiles: number,
    totalFiles: number,
    inMemorySettings: Record<string, unknown>,
  ): Promise<void> {
    const fileSize = this.getFileSizeForProgress(fileOp.sourcePath);

    this.emitFileStartProgress(fileOp, syncedFiles, totalFiles);

    this.ensureDestinationDirectory(fileOp.destinationPath);

    await this.executeFileOperation(fileOp, fileSize, inMemorySettings);

    this.emitFileCompletionProgress(fileOp, syncedFiles + 1, totalFiles);
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
   * Validates source file existence and gets size for sync
   */
  private validateSyncSourceFile(
    filename: string,
    sourcePath: string,
    results: unknown,
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

  /**
   * Wipe SD card contents before sync
   */
  private async wipeSdCard(sdCardPath: string): Promise<void> {
    if (!fs.existsSync(sdCardPath)) {
      throw new Error(`SD card path does not exist: ${sdCardPath}`);
    }

    try {
      // List all items in the SD card directory
      const items = fs.readdirSync(sdCardPath);

      for (const item of items) {
        const itemPath = path.join(sdCardPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          // Remove directory recursively
          fs.rmSync(itemPath, { force: true, recursive: true });
        } else {
          // Remove file
          fs.unlinkSync(itemPath);
        }
      }

      console.log(`Successfully wiped SD card at: ${sdCardPath}`);
    } catch (error) {
      throw new Error(
        `Failed to wipe SD card: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const syncService = new SyncService();

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
      const kitsResult = await getKits(dbDir);
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
        const samplesResult = await getKitSamples(dbDir, kit.name);
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

      // Calculate estimates
      const totalFiles = filesToCopy.length + filesToConvert.length;
      const estimatedTime = this.estimateSyncTime(
        totalFiles,
        totalSize,
        filesToConvert.length,
      );

      const summary: SyncChangeSummary = {
        filesToCopy,
        filesToConvert,
        estimatedTime,
        estimatedSize: totalSize,
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

      // Calculate total bytes for all files
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

      // Initialize sync job tracking
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

      let syncedFiles = 0;

      // Process each file
      for (const fileOp of allFiles) {
        if (this.currentSyncJob.cancelled) {
          break;
        }

        try {
          // Get file size for progress tracking
          let fileSize = 0;
          try {
            if (fs.existsSync(fileOp.sourcePath)) {
              const stats = fs.statSync(fileOp.sourcePath);
              fileSize = stats.size;
            }
          } catch (error) {
            console.warn(
              `Failed to get file size for ${fileOp.sourcePath}:`,
              error,
            );
          }

          // Emit progress update at start of file processing
          this.emitProgress({
            currentFile: fileOp.filename,
            filesCompleted: syncedFiles,
            totalFiles: allFiles.length,
            bytesTransferred: this.currentSyncJob.bytesTransferred,
            totalBytes: this.currentSyncJob.totalBytes,
            elapsedTime: Date.now() - this.currentSyncJob.startTime,
            estimatedTimeRemaining: this.calculateTimeRemaining(),
            status: fileOp.operation === "convert" ? "converting" : "copying",
            currentFileProgress: 0,
          });

          // Ensure destination directory exists
          const destDir = path.dirname(fileOp.destinationPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          if (fileOp.operation === "copy") {
            // Simple file copy with progress tracking
            fs.copyFileSync(fileOp.sourcePath, fileOp.destinationPath);

            // Update bytes transferred
            this.currentSyncJob.bytesTransferred += fileSize;
          } else if (fileOp.operation === "convert") {
            // Convert audio format during copy
            const forceMonoConversion =
              inMemorySettings.defaultToMonoSamples === true;
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

            // Update bytes transferred (use converted file size if available)
            try {
              if (fs.existsSync(fileOp.destinationPath)) {
                const convertedStats = fs.statSync(fileOp.destinationPath);
                this.currentSyncJob.bytesTransferred += convertedStats.size;
              } else {
                this.currentSyncJob.bytesTransferred += fileSize;
              }
            } catch (error) {
              this.currentSyncJob.bytesTransferred += fileSize;
            }
          }

          syncedFiles++;
          this.currentSyncJob.completedFiles = syncedFiles;

          // Emit progress update after file completion
          this.emitProgress({
            currentFile: fileOp.filename,
            filesCompleted: syncedFiles,
            totalFiles: allFiles.length,
            bytesTransferred: this.currentSyncJob.bytesTransferred,
            totalBytes: this.currentSyncJob.totalBytes,
            elapsedTime: Date.now() - this.currentSyncJob.startTime,
            estimatedTimeRemaining: this.calculateTimeRemaining(),
            status: fileOp.operation === "convert" ? "converting" : "copying",
            currentFileProgress: 100,
          });
        } catch (error) {
          // Enhanced error handling for individual files
          const errorInfo = this.categorizeError(error, fileOp.sourcePath);
          console.error(
            `Failed to process file ${fileOp.filename}:`,
            errorInfo.userMessage,
          );

          // Emit error progress update with categorized error information
          this.emitProgress({
            currentFile: fileOp.filename,
            filesCompleted: syncedFiles,
            totalFiles: allFiles.length,
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

          // Rethrow with enhanced error message
          throw new Error(`${fileOp.filename}: ${errorInfo.userMessage}`);
        }
      }

      // Emit completion
      this.emitProgress({
        currentFile: "",
        filesCompleted: syncedFiles,
        totalFiles: allFiles.length,
        bytesTransferred: this.currentSyncJob.bytesTransferred,
        totalBytes: this.currentSyncJob.totalBytes,
        elapsedTime: Date.now() - this.currentSyncJob.startTime,
        estimatedTimeRemaining: 0, // Complete, so no time remaining
        status: this.currentSyncJob.cancelled ? "error" : "complete",
        currentFileProgress: 100,
      });

      const wasCancelled = this.currentSyncJob?.cancelled || false;
      this.currentSyncJob = null;

      if (wasCancelled) {
        return { success: false, error: "Sync operation was cancelled" };
      }

      // Task 8.3: Mark all synced kits as no longer modified
      const localStorePath = inMemorySettings.localStorePath;
      if (localStorePath && syncedFiles > 0) {
        const dbDir = path.join(localStorePath, ".romperdb");

        // Collect unique kit names from successfully synced files
        const syncedKitNames = [
          ...new Set(allFiles.map((file) => file.kitName)),
        ];

        const markSyncedResult = markKitsAsSynced(dbDir, syncedKitNames);
        if (!markSyncedResult.success) {
          console.warn(
            "Failed to mark kits as synced:",
            markSyncedResult.error,
          );
          // Don't fail the sync operation, just log the warning
        } else {
          console.log(
            `Marked ${syncedKitNames.length} kits as synced:`,
            syncedKitNames,
          );
        }
      }

      return { success: true, data: { syncedFiles } };
    } catch (error) {
      // Task 8.3.3: Handle sync rollback on failure
      if (this.currentSyncJob) {
        console.error("Sync failed, attempting cleanup...");

        // Attempt to clean up any partially created files
        try {
          const localStorePath = inMemorySettings.localStorePath;
          if (localStorePath) {
            const syncOutputDir = path.join(localStorePath, "sync_output");
            if (fs.existsSync(syncOutputDir)) {
              // Remove the sync output directory to clean up partial files
              fs.rmSync(syncOutputDir, { recursive: true, force: true });
              console.log("Cleaned up partial sync files");
            }
          }
        } catch (cleanupError) {
          console.warn("Failed to cleanup partial sync files:", cleanupError);
        }
      }

      this.currentSyncJob = null;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to sync kit: ${errorMessage}`,
      };
    }
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
    // TODO: This should use the actual SD card path once SD card detection is implemented
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

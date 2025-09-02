import { BrowserWindow } from "electron";

import type { SyncFileOperation } from "./syncFileOperations.js";

export interface SyncProgress {
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
  totalFiles: number;
}

interface SyncJob {
  cancelled: boolean;
  completedFiles: number;
  fileOperations: SyncFileOperation[];
  kitName: string;
  startTime: number;
  status: "complete" | "error" | "in_progress";
  totalFiles: number;
}

/**
 * Service responsible for tracking sync progress and emitting progress updates
 */
export class SyncProgressManager {
  private currentSyncJob: null | SyncJob = null;

  /**
   * Calculate estimated time remaining based on current progress
   */
  calculateTimeRemaining(): number {
    if (!this.currentSyncJob) return 0;

    const elapsedSeconds = (Date.now() - this.currentSyncJob.startTime) / 1000;
    if (elapsedSeconds === 0) return 0;

    // Calculate progress based on files completed only
    const fileProgress =
      this.currentSyncJob.completedFiles / this.currentSyncJob.totalFiles;

    if (fileProgress === 0) return 0;

    const estimatedTotalTime = elapsedSeconds / fileProgress;
    const estimatedRemaining = estimatedTotalTime - elapsedSeconds;

    return Math.max(0, estimatedRemaining);
  }

  /**
   * Mark the current sync job as cancelled
   */
  cancelCurrentSync(): void {
    if (this.currentSyncJob) {
      this.currentSyncJob.cancelled = true;
    }
  }

  /**
   * Emit completion progress
   */
  emitCompletionProgress(syncedFiles: number, totalFiles: number): void {
    if (!this.currentSyncJob) return;

    this.emitProgress({
      currentFile: "",
      currentFileProgress: 100,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: 0,
      filesCompleted: syncedFiles,
      status: "complete",
      totalFiles,
    });
  }

  /**
   * Emit error progress
   */
  emitErrorProgress(
    fileOp: SyncFileOperation,
    errorDetails: {
      canRetry: boolean;
      error: string;
    },
  ): void {
    if (!this.currentSyncJob) return;

    this.emitProgress({
      currentFile: fileOp.filename,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      errorDetails: {
        canRetry: errorDetails.canRetry,
        error: errorDetails.error,
        fileName: fileOp.filename,
        operation: fileOp.operation,
      },
      estimatedTimeRemaining: 0,
      filesCompleted: this.currentSyncJob.completedFiles,
      status: "error",
      totalFiles: this.currentSyncJob.totalFiles,
    });
  }

  /**
   * Emit progress for file completion
   */
  emitFileCompletionProgress(fileOp: SyncFileOperation): void {
    if (!this.currentSyncJob) return;

    this.currentSyncJob.completedFiles++;

    this.emitProgress({
      currentFile: fileOp.filename,
      currentFileProgress: 100,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: this.calculateTimeRemaining(),
      filesCompleted: this.currentSyncJob.completedFiles,
      status: fileOp.operation === "convert" ? "converting" : "copying",
      totalFiles: this.currentSyncJob.totalFiles,
    });
  }

  /**
   * Emit progress for file start
   */
  emitFileStartProgress(fileOp: SyncFileOperation): void {
    if (!this.currentSyncJob) return;

    this.emitProgress({
      currentFile: fileOp.filename,
      currentFileProgress: 0,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: this.calculateTimeRemaining(),
      filesCompleted: this.currentSyncJob.completedFiles,
      status: fileOp.operation === "convert" ? "converting" : "copying",
      totalFiles: this.currentSyncJob.totalFiles,
    });
  }

  /**
   * Emit progress to renderer process
   */
  emitProgress(progress: SyncProgress): void {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send("sync-progress", progress);
    }
  }

  /**
   * Finalize sync job and return if it was cancelled
   */
  finalizeSyncJob(): boolean {
    const wasCancelled = this.currentSyncJob?.cancelled || false;
    this.currentSyncJob = null;
    return wasCancelled;
  }

  /**
   * Get current sync job (for external access)
   */
  getCurrentSyncJob(): null | SyncJob {
    return this.currentSyncJob;
  }

  /**
   * Initialize a new sync job with file operations
   */
  initializeSyncJob(allFiles: SyncFileOperation[]): void {
    this.currentSyncJob = {
      cancelled: false,
      completedFiles: 0,
      fileOperations: allFiles,
      kitName: allFiles[0]?.kitName || "Unknown Kit",
      startTime: Date.now(),
      status: "in_progress",
      totalFiles: allFiles.length,
    };
  }
}

export const syncProgressManager = new SyncProgressManager();

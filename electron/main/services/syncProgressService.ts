import { BrowserWindow } from "electron";

import type { SyncFileOperation } from "./syncPlannerService.js";

export interface SyncJob {
  bytesTransferred: number;
  cancelled: boolean;
  completedFiles: number;
  fileOperations: SyncFileOperation[];
  kitName: string;
  startTime: number;
  totalBytes: number;
  totalFiles: number;
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
  filesCompleted: number;
  status: "complete" | "converting" | "copying" | "error" | "preparing";
  totalBytes: number;
  totalFiles: number;
}

/**
 * Service for tracking sync progress and emitting updates
 * Extracted from syncService.ts for better testability
 */
export class SyncProgressService {
  private currentSyncJob: null | SyncJob = null;

  /**
   * Mark sync job as cancelled
   */
  cancelSync(): boolean {
    if (this.currentSyncJob) {
      this.currentSyncJob.cancelled = true;
      return true;
    }
    return false;
  }

  /**
   * Complete the sync job
   */
  completeSync(): void {
    if (!this.currentSyncJob) return;

    const progress: SyncProgress = {
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      currentFile: "",
      currentFileProgress: 100,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      filesCompleted: this.currentSyncJob.completedFiles,
      status: this.currentSyncJob.cancelled ? "error" : "complete",
      totalBytes: this.currentSyncJob.totalBytes,
      totalFiles: this.currentSyncJob.totalFiles,
    };

    this.emitProgress(progress);
    this.currentSyncJob = null;
  }

  /**
   * Get current sync job info
   */
  getCurrentSyncJob(): null | SyncJob {
    return this.currentSyncJob;
  }

  /**
   * Initialize a new sync job
   */
  initializeSyncJob(
    kitName: string,
    fileOperations: SyncFileOperation[],
    totalBytes: number
  ): void {
    this.currentSyncJob = {
      bytesTransferred: 0,
      cancelled: false,
      completedFiles: 0,
      fileOperations,
      kitName,
      startTime: Date.now(),
      totalBytes,
      totalFiles: fileOperations.length,
    };
  }

  /**
   * Check if current sync job is cancelled
   */
  isCancelled(): boolean {
    return this.currentSyncJob?.cancelled || false;
  }

  /**
   * Update progress after a file operation completes
   */
  updateProgress(
    currentFile: string,
    bytesTransferred: number,
    status: SyncProgress["status"],
    currentFileProgress?: number,
    errorDetails?: SyncProgress["errorDetails"]
  ): void {
    if (!this.currentSyncJob) return;

    // Update job state
    if (status !== "error") {
      this.currentSyncJob.bytesTransferred += bytesTransferred;
      if (currentFileProgress === 100) {
        this.currentSyncJob.completedFiles++;
      }
    }

    // Create progress update
    const progress: SyncProgress = {
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      currentFile,
      currentFileProgress,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      errorDetails,
      filesCompleted: this.currentSyncJob.completedFiles,
      status,
      totalBytes: this.currentSyncJob.totalBytes,
      totalFiles: this.currentSyncJob.totalFiles,
    };

    this.emitProgress(progress);
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

export const syncProgressService = new SyncProgressService();

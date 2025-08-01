import { BrowserWindow } from "electron";

import type { SyncFileOperation } from "./syncPlannerService.js";

export interface SyncProgress {
  currentFile: string;
  filesCompleted: number;
  totalFiles: number;
  bytesTransferred: number;
  totalBytes: number;
  elapsedTime: number;
  status: "preparing" | "copying" | "converting" | "complete" | "error";
  currentFileProgress?: number; // 0-100 percentage for current file
  errorDetails?: {
    fileName: string;
    operation: "copy" | "convert";
    error: string;
    canRetry: boolean;
  };
}

export interface SyncJob {
  kitName: string;
  totalFiles: number;
  completedFiles: number;
  startTime: number;
  cancelled: boolean;
  totalBytes: number;
  bytesTransferred: number;
  fileOperations: SyncFileOperation[];
}

/**
 * Service for tracking sync progress and emitting updates
 * Extracted from syncService.ts for better testability
 */
export class SyncProgressService {
  private currentSyncJob: SyncJob | null = null;

  /**
   * Initialize a new sync job
   */
  initializeSyncJob(
    kitName: string,
    fileOperations: SyncFileOperation[],
    totalBytes: number,
  ): void {
    this.currentSyncJob = {
      kitName,
      totalFiles: fileOperations.length,
      completedFiles: 0,
      startTime: Date.now(),
      cancelled: false,
      totalBytes,
      bytesTransferred: 0,
      fileOperations,
    };
  }

  /**
   * Update progress after a file operation completes
   */
  updateProgress(
    currentFile: string,
    bytesTransferred: number,
    status: SyncProgress["status"],
    currentFileProgress?: number,
    errorDetails?: SyncProgress["errorDetails"],
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
      currentFile,
      filesCompleted: this.currentSyncJob.completedFiles,
      totalFiles: this.currentSyncJob.totalFiles,
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      totalBytes: this.currentSyncJob.totalBytes,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      status,
      currentFileProgress,
      errorDetails,
    };

    this.emitProgress(progress);
  }

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
   * Check if current sync job is cancelled
   */
  isCancelled(): boolean {
    return this.currentSyncJob?.cancelled || false;
  }

  /**
   * Complete the sync job
   */
  completeSync(): void {
    if (!this.currentSyncJob) return;

    const progress: SyncProgress = {
      currentFile: "",
      filesCompleted: this.currentSyncJob.completedFiles,
      totalFiles: this.currentSyncJob.totalFiles,
      bytesTransferred: this.currentSyncJob.bytesTransferred,
      totalBytes: this.currentSyncJob.totalBytes,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      status: this.currentSyncJob.cancelled ? "error" : "complete",
      currentFileProgress: 100,
    };

    this.emitProgress(progress);
    this.currentSyncJob = null;
  }

  /**
   * Get current sync job info
   */
  getCurrentSyncJob(): SyncJob | null {
    return this.currentSyncJob;
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

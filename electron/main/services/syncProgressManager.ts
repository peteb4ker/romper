import { BrowserWindow } from "electron";

import type { SyncFileOperation } from "./syncFileOperations.js";

export interface SyncProgress {
  currentFile: string;
  currentFileProgress?: number; // 0-100 percentage for current file
  currentKitName?: string;
  elapsedTime: number;
  errorDetails?: {
    canRetry: boolean;
    error: string;
    fileName: string;
    kitName?: string;
    operation: "convert" | "copy";
  };
  estimatedTimeRemaining: number;
  filesCompleted: number;
  /**
   * While status is "removing": entries removed from the card so far, of
   * those the store no longer has (#653)
   */
  removal?: { completed: number; total: number };
  status:
    | "complete"
    | "converting"
    | "copying"
    | "error"
    | "finalizing"
    | "preparing"
    | "removing";
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
 * Minimum gap between per-file progress events. A write of a few thousand
 * small samples finishes in seconds; one IPC event per file start and finish
 * floods the renderer, which then lags far behind the real count.
 */
export const PROGRESS_THROTTLE_MS = 50;

/**
 * Service responsible for tracking sync progress and emitting progress updates
 */
export class SyncProgressManager {
  private currentSyncJob: null | SyncJob = null;
  private lastEmitTime: null | number = null;
  private pendingProgress: null | SyncProgress = null;
  private pendingTimer: null | ReturnType<typeof setTimeout> = null;

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

    this.cancelPendingProgress();
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

    this.cancelPendingProgress();
    this.emitProgress({
      currentFile: fileOp.filename,
      currentKitName: fileOp.kitName,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      errorDetails: {
        canRetry: errorDetails.canRetry,
        error: errorDetails.error,
        fileName: fileOp.filename,
        kitName: fileOp.kitName,
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

    this.emitThrottledProgress({
      currentFile: fileOp.filename,
      currentFileProgress: 100,
      currentKitName: fileOp.kitName,
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

    this.emitThrottledProgress({
      currentFile: fileOp.filename,
      currentFileProgress: 0,
      currentKitName: fileOp.kitName,
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: this.calculateTimeRemaining(),
      filesCompleted: this.currentSyncJob.completedFiles,
      status: fileOp.operation === "convert" ? "converting" : "copying",
      totalFiles: this.currentSyncJob.totalFiles,
    });
  }

  /**
   * Every file is written; the write is finishing (bank name files, removing
   * what the store no longer has, recording the write). Sent at once, so
   * the dialog moves on from the last file's count while the card is still
   * being changed (#653).
   */
  emitFinalizingProgress(): void {
    if (!this.currentSyncJob) return;

    this.cancelPendingProgress();
    this.lastEmitTime = Date.now();
    this.emitProgress({
      currentFile: "",
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: 0,
      filesCompleted: this.currentSyncJob.completedFiles,
      status: "finalizing",
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
   * Every file is written and the write is removing what the store no
   * longer has from the card: `completed` of `total` entries (#653).
   * Throttled like per-file progress; the first and last go out at once.
   */
  emitRemovalProgress(completed: number, total: number): void {
    if (!this.currentSyncJob) return;

    this.emitThrottledProgress({
      currentFile: "",
      elapsedTime: Date.now() - this.currentSyncJob.startTime,
      estimatedTimeRemaining: 0,
      filesCompleted: this.currentSyncJob.completedFiles,
      removal: { completed, total },
      status: "removing",
      totalFiles: this.currentSyncJob.totalFiles,
    });
  }

  /**
   * Emit per-file progress at most once per PROGRESS_THROTTLE_MS. The first
   * event and the one that completes the last file go out immediately; an
   * event that arrives too soon is held, replaced by any newer one, and sent
   * when the interval elapses, so the renderer always ends on the latest
   * count.
   */
  emitThrottledProgress(progress: SyncProgress): void {
    const now = Date.now();
    const isFinalFile = progress.removal
      ? progress.removal.completed === 0 ||
        progress.removal.completed >= progress.removal.total
      : progress.totalFiles > 0 &&
        progress.filesCompleted >= progress.totalFiles;
    const sinceLast =
      this.lastEmitTime === null ? Infinity : now - this.lastEmitTime;

    if (isFinalFile || sinceLast >= PROGRESS_THROTTLE_MS) {
      this.cancelPendingProgress();
      this.lastEmitTime = now;
      this.emitProgress(progress);
      return;
    }

    this.pendingProgress = progress;
    this.pendingTimer ??= setTimeout(
      () => this.flushPendingProgress(),
      PROGRESS_THROTTLE_MS - sinceLast,
    );
  }

  /**
   * Finalize sync job and return if it was cancelled
   */
  finalizeSyncJob(): boolean {
    const wasCancelled = this.currentSyncJob?.cancelled || false;
    this.cancelPendingProgress();
    this.lastEmitTime = null;
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
    this.cancelPendingProgress();
    this.lastEmitTime = null;
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

  private cancelPendingProgress(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.pendingProgress = null;
  }

  private flushPendingProgress(): void {
    const progress = this.pendingProgress;
    this.pendingTimer = null;
    this.pendingProgress = null;
    if (!progress || !this.currentSyncJob) return;

    this.lastEmitTime = Date.now();
    this.emitProgress(progress);
  }
}

export const syncProgressManager = new SyncProgressManager();

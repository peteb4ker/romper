import * as path from "path";

import type { DbResult } from "../../../shared/db/schema.js";

import { markKitsAsSynced } from "../db/romperDbCoreORM.js";
import {
  type SyncExecutorService,
  syncExecutorService,
} from "./syncExecutorService.js";
import {
  type SyncChangeSummary,
  type SyncFileOperation,
  type SyncPlannerService,
  syncPlannerService,
} from "./syncPlannerService.js";
import {
  type SyncProgressService,
  syncProgressService,
} from "./syncProgressService.js";

/**
 * Refactored SyncService that orchestrates sync operations using composed services
 * This replaces the monolithic syncService.ts for better testability
 */
export class SyncService {
  constructor(
    private readonly plannerService: SyncPlannerService = syncPlannerService,
    private readonly executorService: SyncExecutorService = syncExecutorService,
    private readonly progressService: SyncProgressService = syncProgressService,
  ) {}

  /**
   * Cancel the current sync operation
   */
  cancelSync(): void {
    this.progressService.cancelSync();
  }

  /**
   * Generate a summary of changes needed to sync all kits to SD card
   */
  async generateChangeSummary(
    inMemorySettings: Record<string, any>,
  ): Promise<DbResult<SyncChangeSummary>> {
    return this.plannerService.generateChangeSummary(inMemorySettings);
  }

  /**
   * Start syncing all kits to SD card
   */
  async startKitSync(
    inMemorySettings: Record<string, any>,
    syncData: {
      filesToConvert: SyncFileOperation[];
      filesToCopy: SyncFileOperation[];
    },
  ): Promise<DbResult<{ syncedFiles: number }>> {
    try {
      const allFiles = [...syncData.filesToCopy, ...syncData.filesToConvert];
      const totalBytes = this.executorService.calculateTotalSize(allFiles);

      this.progressService.initializeSyncJob("All Kits", allFiles, totalBytes);

      const syncedFiles = await this.processAllFiles(
        allFiles,
        inMemorySettings,
      );

      this.progressService.completeSync();

      if (this.progressService.isCancelled()) {
        return { error: "Sync operation was cancelled", success: false };
      }

      await this.markKitsAsSynced(inMemorySettings, allFiles, syncedFiles);

      return { data: { syncedFiles }, success: true };
    } catch (error) {
      await this.handleSyncFailure(error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        error: `Failed to sync kit: ${errorMessage}`,
        success: false,
      };
    }
  }

  private async handleFileError(
    error: unknown,
    fileOp: SyncFileOperation,
  ): Promise<void> {
    const errorInfo = this.executorService.categorizeError(
      error,
      fileOp.sourcePath,
    );

    console.error(
      `Failed to process file ${fileOp.filename}:`,
      errorInfo.userMessage,
    );

    // Emit error progress update
    this.progressService.updateProgress(
      fileOp.filename,
      0,
      "error",
      undefined,
      {
        canRetry: errorInfo.canRetry,
        error: errorInfo.userMessage,
        fileName: fileOp.filename,
        operation: fileOp.operation,
      },
    );

    // Rethrow with enhanced error message
    throw new Error(`${fileOp.filename}: ${errorInfo.userMessage}`);
  }

  private async handleSyncFailure(_error: unknown): Promise<void> {
    const currentSyncJob = this.progressService.getCurrentSyncJob();
    if (currentSyncJob) {
      console.error("Sync failed, attempting cleanup...");
      // Cleanup would be handled by a separate cleanup service in a full refactor
    }
    this.progressService.completeSync();
  }

  private async markKitsAsSynced(
    inMemorySettings: Record<string, any>,
    allFiles: SyncFileOperation[],
    syncedFiles: number,
  ): Promise<void> {
    const localStorePath = inMemorySettings.localStorePath;
    if (!localStorePath || syncedFiles === 0) return;

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

  private async processAllFiles(
    allFiles: SyncFileOperation[],
    inMemorySettings: Record<string, any>,
  ): Promise<number> {
    let syncedFiles = 0;

    for (const fileOp of allFiles) {
      if (this.progressService.isCancelled()) {
        break;
      }

      try {
        syncedFiles += await this.processFile(fileOp, inMemorySettings);
      } catch (error) {
        await this.handleFileError(error, fileOp);
        throw error;
      }
    }

    return syncedFiles;
  }

  private async processFile(
    fileOp: SyncFileOperation,
    inMemorySettings: Record<string, any>,
  ): Promise<number> {
    // Emit progress update at start of file processing
    this.progressService.updateProgress(
      fileOp.filename,
      0,
      fileOp.operation === "convert" ? "converting" : "copying",
      0,
    );

    // Execute the file operation
    const forceMonoConversion = Boolean(inMemorySettings.defaultToMonoSamples);
    const result = await this.executorService.executeFileOperation(
      fileOp,
      forceMonoConversion,
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    // Emit progress update after file completion
    this.progressService.updateProgress(
      fileOp.filename,
      result.data?.bytesTransferred || 0,
      fileOp.operation === "convert" ? "converting" : "copying",
      100,
    );

    return 1;
  }
}

export const syncService = new SyncService();

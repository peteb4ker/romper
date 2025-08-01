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
    private plannerService: SyncPlannerService = syncPlannerService,
    private executorService: SyncExecutorService = syncExecutorService,
    private progressService: SyncProgressService = syncProgressService,
  ) {}

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
      filesToCopy: SyncFileOperation[];
      filesToConvert: SyncFileOperation[];
    },
  ): Promise<DbResult<{ syncedFiles: number }>> {
    try {
      const allFiles = [...syncData.filesToCopy, ...syncData.filesToConvert];
      const totalBytes = this.executorService.calculateTotalSize(allFiles);

      // Initialize sync job tracking
      this.progressService.initializeSyncJob("All Kits", allFiles, totalBytes);

      let syncedFiles = 0;

      // Process each file
      for (const fileOp of allFiles) {
        if (this.progressService.isCancelled()) {
          break;
        }

        try {
          // Emit progress update at start of file processing
          this.progressService.updateProgress(
            fileOp.filename,
            0,
            fileOp.operation === "convert" ? "converting" : "copying",
            0,
          );

          // Execute the file operation
          const forceMonoConversion =
            inMemorySettings.defaultToMonoSamples === true;
          const result = await this.executorService.executeFileOperation(
            fileOp,
            forceMonoConversion,
          );

          if (!result.success) {
            throw new Error(result.error);
          }

          syncedFiles++;

          // Emit progress update after file completion
          this.progressService.updateProgress(
            fileOp.filename,
            result.data?.bytesTransferred || 0,
            fileOp.operation === "convert" ? "converting" : "copying",
            100,
          );
        } catch (error) {
          // Enhanced error handling for individual files
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
              fileName: fileOp.filename,
              operation: fileOp.operation,
              error: errorInfo.userMessage,
              canRetry: errorInfo.canRetry,
            },
          );

          // Rethrow with enhanced error message
          throw new Error(`${fileOp.filename}: ${errorInfo.userMessage}`);
        }
      }

      // Complete sync job
      this.progressService.completeSync();

      const wasCancelled = this.progressService.isCancelled();

      if (wasCancelled) {
        return { success: false, error: "Sync operation was cancelled" };
      }

      // Mark all synced kits as no longer modified
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
      // Handle sync rollback on failure
      const currentSyncJob = this.progressService.getCurrentSyncJob();
      if (currentSyncJob) {
        console.error("Sync failed, attempting cleanup...");
        // Cleanup would be handled by a separate cleanup service in a full refactor
      }

      this.progressService.completeSync();
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
    this.progressService.cancelSync();
  }
}

export const syncService = new SyncService();

import type { DbResult } from "@romper/shared/db/schema.js";

import * as fs from "fs";
import * as path from "path";

import { markKitsAsSynced } from "../db/romperDbCoreORM.js";
import {
  type SyncFileOperation,
  syncFileOperationsService,
} from "./syncFileOperations.js";
import { syncProgressManager } from "./syncProgressManager.js";
import { syncSampleProcessingService } from "./syncSampleProcessing.js";
import { type SyncValidationError } from "./syncValidationService.js";

export interface SyncChangeSummary {
  fileCount: number;
  kitCount: number;
}

class SyncService {
  /**
   * Cancel the current sync operation
   */
  cancelSync(): void {
    syncProgressManager.cancelCurrentSync();
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
      if (!localStorePath || typeof localStorePath !== "string") {
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
      const samplesResult =
        await syncSampleProcessingService.gatherAllSamples(dbDir);
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
      if (!localStorePath || typeof localStorePath !== "string") {
        return { error: "No local store path configured", success: false };
      }

      const dbDir = path.join(localStorePath, ".romperdb");
      const samplesResult =
        await syncSampleProcessingService.gatherAllSamples(dbDir);
      if (!samplesResult.success) {
        return { error: samplesResult.error, success: false };
      }

      // Generate file operations for actual sync using existing logic
      const results = {
        filesToConvert: [] as SyncFileOperation[],
        filesToCopy: [] as SyncFileOperation[],
        hasFormatWarnings: false,
        validationErrors: [] as SyncValidationError[],
        warnings: [] as string[],
      };

      const samples = samplesResult.data || [];
      for (const sample of samples) {
        syncSampleProcessingService.processSampleForSync(
          sample,
          localStorePath,
          results,
          options.sdCardPath,
        );
      }

      const allFiles = [...results.filesToCopy, ...results.filesToConvert];

      // Handle SD card wiping if requested
      if (options.wipeSdCard && options.sdCardPath) {
        await this.wipeSdCard(options.sdCardPath);
      }

      syncProgressManager.initializeSyncJob(allFiles);

      const syncedFiles = await syncFileOperationsService.processAllFiles(
        allFiles,
        inMemorySettings,
        options.sdCardPath,
      );

      syncProgressManager.emitCompletionProgress(syncedFiles, allFiles.length);

      const wasCancelled = syncProgressManager.finalizeSyncJob();
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
   * Estimate sync time based on file count, size, and conversion needs
   */
  private estimateSyncTime(totalFiles: number, conversions: number): number {
    // Base time per file (seconds)
    const baseTimePerFile = 0.5;
    // Additional time per conversion
    const timePerConversion = 2.0;

    return Math.ceil(
      totalFiles * baseTimePerFile + conversions * timePerConversion,
    );
  }

  /**
   * Handle sync failure and cleanup
   */
  private async handleSyncFailure(
    inMemorySettings: Record<string, unknown>,
    _error: unknown,
  ): Promise<void> {
    if (syncProgressManager.getCurrentSyncJob()) {
      console.error("Sync failed, attempting cleanup...");

      try {
        const localStorePath = inMemorySettings.localStorePath;
        if (localStorePath && typeof localStorePath === "string") {
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

    // Cleanup handled by progress manager
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
    if (!localStorePath || !syncedFiles || typeof localStorePath !== "string")
      return;

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

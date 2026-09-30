import type { DbResult } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import * as path from "node:path";

import { getAllBanks, markKitsAsSynced } from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { logger } from "../utils/logger.js";
import { rtfFileService } from "./rtfFileService.js";
import { clearRampleContent, validateSdCardTarget } from "./sdCardSafety.js";
import {
  type SyncFileOperation,
  syncFileOperationsService,
} from "./syncFileOperations.js";
import { annotateMonoConversion } from "./syncMonoAnnotation.js";
import { syncProgressManager } from "./syncProgressManager.js";
import { syncSampleProcessingService } from "./syncSampleProcessing.js";
import { type SyncValidationError } from "./syncValidationService.js";

export interface SyncBankSummary {
  bank: string;
  fileCount: number;
  hasConversions: boolean;
  kitCount: number;
}

export interface SyncChangeSummary {
  banks: SyncBankSummary[];
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
      const localStorePath =
        ServicePathManager.getLocalStorePath(inMemorySettings);
      if (!localStorePath) {
        return { error: "No local store path configured", success: false };
      }

      const dbDir = ServicePathManager.getDbPath(localStorePath);

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

      const samples = samplesResult.data || [];
      const fileCount = samples.length;

      // Group samples by bank (first character of kit name, A-Z) — max 26 banks
      const bankMap = new Map<
        string,
        { fileCount: number; hasConversions: boolean; kitNames: Set<string> }
      >();
      for (const sample of samples) {
        const kitName =
          (sample as { kitName?: string }).kitName || sample.kit_name;
        if (!kitName) continue;
        const bank = kitName.charAt(0).toUpperCase();
        const entry = bankMap.get(bank) || {
          fileCount: 0,
          hasConversions: false,
          kitNames: new Set<string>(),
        };
        entry.fileCount++;
        entry.kitNames.add(kitName);
        if (sample.filename && !/\.wav$/i.test(sample.filename)) {
          entry.hasConversions = true;
        }
        bankMap.set(bank, entry);
      }

      const banks: SyncBankSummary[] = [...bankMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([bank, data]) => ({
          bank,
          fileCount: data.fileCount,
          hasConversions: data.hasConversions,
          kitCount: data.kitNames.size,
        }));

      logger.log("[Backend] Samples result:", {
        sampleCount: fileCount,
        success: samplesResult.success,
      });

      const summary: SyncChangeSummary = {
        banks,
        fileCount,
        kitCount,
      };

      logger.log("[Backend] Generated sync summary:", summary);
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
      const localStorePath =
        ServicePathManager.getLocalStorePath(inMemorySettings);
      if (!localStorePath) {
        return { error: "No local store path configured", success: false };
      }

      // Refuse targets that are clearly not an SD card (system root, the home
      // folder or above it, or anything overlapping a local store) before
      // anything is read or written. The saved path is protected too when
      // ROMPER_LOCAL_PATH overrides it.
      const savedLocalStorePath = inMemorySettings.localStorePath;
      const target = validateSdCardTarget(options.sdCardPath, [
        localStorePath,
        typeof savedLocalStorePath === "string" ? savedLocalStorePath : "",
      ]);
      if (!target.ok) {
        return { error: target.reason, success: false };
      }

      const dbDir = ServicePathManager.getDbPath(localStorePath);
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

      // Process samples with standard sync logic - stereo behavior is now corrected in core processor
      for (const sample of samples) {
        syncSampleProcessingService.processSampleForSync(
          sample,
          localStorePath,
          results,
          options.sdCardPath,
        );
      }

      const allFiles = [...results.filesToCopy, ...results.filesToConvert];

      // Set per-file forceMonoConversion based on voice stereo_mode
      // Mono voices need stereo samples converted to mono; stereo voices pass through
      annotateMonoConversion(allFiles, dbDir);

      // Remove existing kits from the card if requested. Only Rample kit
      // folders and bank RTF files are removed; other files are kept.
      if (options.wipeSdCard) {
        this.clearSdCard(options.sdCardPath);
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

      // Write bank RTF files to SD card root
      this.writeBankRtfFiles(dbDir, options.sdCardPath);

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
   * Remove existing Rample kits and bank files from the SD card before sync
   */
  private clearSdCard(sdCardPath: string): void {
    try {
      const { removed } = clearRampleContent(sdCardPath);
      logger.log(
        `Removed ${removed.length} kit folders and bank files from SD card at: ${sdCardPath}`,
      );
    } catch (error) {
      throw new Error(
        `Failed to clear SD card: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Estimate sync time based on file count, size, and conversion needs
   */
  private estimateSyncTime(totalFiles: number, conversions: number): number {
    // Base time per file (seconds)
    const baseTimePerFile = 0.5;
    // Additional time per conversion
    const timePerConversion = 2;

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
        const localStorePath =
          ServicePathManager.getLocalStorePath(inMemorySettings);
        if (localStorePath) {
          const syncOutputDir = path.join(localStorePath, "sync_output");
          if (fs.existsSync(syncOutputDir)) {
            fs.rmSync(syncOutputDir, { force: true, recursive: true });
            logger.log("Cleaned up partial sync files");
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
    const localStorePath =
      ServicePathManager.getLocalStorePath(inMemorySettings);
    if (!localStorePath || !syncedFiles) return;

    const dbDir = ServicePathManager.getDbPath(localStorePath);
    const syncedKitNames = [...new Set(allFiles.map((file) => file.kitName))];

    const markSyncedResult = markKitsAsSynced(dbDir, syncedKitNames);
    if (markSyncedResult.success) {
      logger.log(
        `Marked ${syncedKitNames.length} kits as synced:`,
        syncedKitNames,
      );
    } else {
      console.warn("Failed to mark kits as synced:", markSyncedResult.error);
    }
  }

  /**
   * Write bank RTF files to the SD card root for banks with artist names
   */
  private writeBankRtfFiles(dbDir: string, sdCardPath: string): void {
    try {
      const banksResult = getAllBanks(dbDir);
      if (banksResult.success && banksResult.data) {
        const written = rtfFileService.writeAllBankRtfFiles(
          sdCardPath,
          banksResult.data,
        );
        if (written > 0) {
          logger.log(`Wrote ${written} bank RTF files to SD card`);
        }
      }
    } catch (error) {
      console.warn("Failed to write bank RTF files to SD card:", error);
    }
  }
}

export const syncService = new SyncService();

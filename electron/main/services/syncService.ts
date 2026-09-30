import type { DbResult } from "@romper/shared/db/schema.js";

import * as fs from "node:fs";
import * as path from "node:path";

import {
  getAllBanks,
  getKits,
  markKitsAsSynced,
} from "../db/romperDbCoreORM.js";
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
  /** Files that will be written to the card */
  fileCount: number;
  kitCount: number;
  /** Samples that can't be written (missing or unreadable source files) */
  validationErrors: SyncValidationError[];
  warnings: string[];
}

export interface SyncOptions {
  sdCardPath: string;
  /**
   * The user has seen the summary's validation errors and chose to write
   * the rest. Without it, sync refuses to start while any sample would be
   * skipped, so a card is never wiped and then only partly written.
   */
  skipInvalidFiles?: boolean;
  wipeSdCard?: boolean;
}

export interface SyncOutcome {
  /** Samples that were not written because they failed validation */
  skippedFiles: SyncValidationError[];
  syncedFiles: number;
  warnings: string[];
}

interface SyncPlan {
  dbDir: string;
  files: SyncFileOperation[];
  localStorePath: string;
  validationErrors: SyncValidationError[];
  warnings: string[];
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
    sdCardPath?: string,
  ): Promise<DbResult<SyncChangeSummary>> {
    try {
      const planResult = await this.planSync(
        inMemorySettings,
        sdCardPath || undefined,
      );
      if (!planResult.success || !planResult.data) {
        return { error: planResult.error, success: false };
      }
      const plan = planResult.data;

      // Get kit count
      const kitsResult = getKits(plan.dbDir);
      if (!kitsResult.success || !kitsResult.data) {
        return {
          error: kitsResult.error ?? "Failed to load kits",
          success: false,
        };
      }
      const kitCount = kitsResult.data.length;
      const fileCount = plan.files.length;

      // Group the planned files by bank (first character of kit name, A-Z)
      const bankMap = new Map<
        string,
        { fileCount: number; hasConversions: boolean; kitNames: Set<string> }
      >();
      for (const file of plan.files) {
        const bank = file.kitName.charAt(0).toUpperCase();
        const entry = bankMap.get(bank) || {
          fileCount: 0,
          hasConversions: false,
          kitNames: new Set<string>(),
        };
        entry.fileCount++;
        entry.kitNames.add(file.kitName);
        if (file.operation === "convert") {
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

      const summary: SyncChangeSummary = {
        banks,
        fileCount,
        kitCount,
        validationErrors: plan.validationErrors,
        warnings: plan.warnings,
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
    options: SyncOptions,
  ): Promise<DbResult<SyncOutcome>> {
    try {
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

      const planResult = await this.planSync(
        inMemorySettings,
        options.sdCardPath,
      );
      if (!planResult.success || !planResult.data) {
        return { error: planResult.error, success: false };
      }
      const {
        dbDir,
        files: allFiles,
        validationErrors,
        warnings,
      } = planResult.data;

      // Samples that can't be written must not be dropped silently. Refuse
      // before touching the card (and before any wipe) unless the user has
      // reviewed them in the summary and chosen to skip them.
      if (validationErrors.length > 0 && !options.skipInvalidFiles) {
        const count = validationErrors.length;
        const samples = count === 1 ? "1 sample" : `${count} samples`;
        return {
          error: `${samples} can't be written to the card. Nothing was written. Confirm skipping them in the write summary to continue.`,
          success: false,
        };
      }

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

      // A kit with a skipped sample isn't in sync with the card, so it keeps
      // its "modified since sync" flag.
      const incompleteKits = new Set(
        validationErrors.map((error) => error.kitName),
      );
      this.markKitsAsSynced(
        inMemorySettings,
        allFiles.filter((file) => !incompleteKits.has(file.kitName)),
        syncedFiles,
      );

      return {
        data: { skippedFiles: validationErrors, syncedFiles, warnings },
        success: true,
      };
    } catch (error) {
      this.handleSyncFailure(inMemorySettings, error);
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
  private handleSyncFailure(
    inMemorySettings: Record<string, unknown>,
    _error: unknown,
  ): void {
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
  private markKitsAsSynced(
    inMemorySettings: Record<string, unknown>,
    allFiles: SyncFileOperation[],
    syncedFiles: number,
  ): void {
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
   * Work out which files a sync would write, and which samples it can't
   * write. The summary and the sync share this so they always agree.
   */
  private async planSync(
    inMemorySettings: Record<string, unknown>,
    sdCardPath?: string,
  ): Promise<DbResult<SyncPlan>> {
    const localStorePath =
      ServicePathManager.getLocalStorePath(inMemorySettings);
    if (!localStorePath) {
      return { error: "No local store path configured", success: false };
    }

    const dbDir = ServicePathManager.getDbPath(localStorePath);
    const samplesResult =
      await syncSampleProcessingService.gatherAllSamples(dbDir);
    if (!samplesResult.success) {
      return { error: samplesResult.error, success: false };
    }

    const results = {
      filesToConvert: [] as SyncFileOperation[],
      filesToCopy: [] as SyncFileOperation[],
      hasFormatWarnings: false,
      validationErrors: [] as SyncValidationError[],
      warnings: [] as string[],
    };
    for (const sample of samplesResult.data || []) {
      syncSampleProcessingService.processSampleForSync(
        sample,
        localStorePath,
        results,
        sdCardPath,
      );
    }

    return {
      data: {
        dbDir,
        files: [...results.filesToCopy, ...results.filesToConvert],
        localStorePath,
        validationErrors: results.validationErrors,
        warnings: results.warnings,
      },
      success: true,
    };
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

import type { DbResult, Sample } from "@romper/shared/db/schema.js";

import { cardSampleFileName } from "@romper/shared/rampleCardLayout.js";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  getAllBanks,
  getKits,
  markAllKitsAsSyncedExcept,
} from "../db/romperDbCoreORM.js";
import { ServicePathManager } from "../utils/fileSystemUtils.js";
import { logger } from "../utils/logger.js";
import {
  bankRtfFileName,
  isWritableBankName,
  rtfFileService,
} from "./rtfFileService.js";
import {
  type CardContents,
  findStaleCardEntries,
  removeCardEntries,
  validateSdCardTarget,
} from "./sdCardSafety.js";
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
  /**
   * Rample content on the card that sync will delete because the store no
   * longer has it (paths relative to the card). Empty without a card path.
   */
  removals: string[];
  /** Samples that can't be written (missing or unreadable source files) */
  validationErrors: SyncValidationError[];
  warnings: string[];
}

export interface SyncOptions {
  sdCardPath: string;
  /**
   * The user has seen the summary's validation errors and chose to write
   * the rest. Without it, sync refuses to start while any sample would be
   * skipped.
   */
  skipInvalidFiles?: boolean;
}

export interface SyncOutcome {
  /**
   * The user cancelled: writing stopped after the file in progress, and
   * nothing was removed from the card or marked as synced.
   */
  cancelled: boolean;
  /** Samples that were not written because they failed validation */
  skippedFiles: SyncValidationError[];
  syncedFiles: number;
  warnings: string[];
}

interface SyncPlan {
  /** What the card should hold once this sync has run */
  cardContents: CardContents;
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
        removals: sdCardPath
          ? findStaleCardEntries(sdCardPath, plan.cardContents)
          : [],
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
        cardContents,
        dbDir,
        files: allFiles,
        validationErrors,
        warnings,
      } = planResult.data;

      // Samples that can't be written must not be dropped silently. Refuse
      // before touching the card unless the user has
      // reviewed them in the summary and chosen to skip them.
      if (validationErrors.length > 0 && !options.skipInvalidFiles) {
        const count = validationErrors.length;
        const samples = count === 1 ? "1 sample" : `${count} samples`;
        return {
          error: `${samples} can't be written to the card. Nothing was written. Confirm skipping them in the write summary to continue.`,
          success: false,
        };
      }

      syncProgressManager.initializeSyncJob(allFiles);

      const syncedFiles = await syncFileOperationsService.processAllFiles(
        allFiles,
        inMemorySettings,
        options.sdCardPath,
      );

      if (syncProgressManager.getCurrentSyncJob()?.cancelled) {
        syncProgressManager.finalizeSyncJob();
        return {
          data: {
            cancelled: true,
            skippedFiles: validationErrors,
            syncedFiles,
            warnings,
          },
          success: true,
        };
      }
      syncProgressManager.emitCompletionProgress(syncedFiles, allFiles.length);
      syncProgressManager.finalizeSyncJob();

      // Write bank RTF files to SD card root
      this.writeBankRtfFiles(dbDir, options.sdCardPath);

      // The card mirrors the store: delete what the store no longer has.
      // Only after every file is written, so a cancelled or failed sync
      // never leaves a kit with less than it had.
      this.removeStaleEntries(options.sdCardPath, cardContents);

      // The card now mirrors the store, so every kit is in step with it,
      // except a kit with a skipped sample: it keeps its "modified since
      // sync" flag.
      const incompleteKits = new Set<string>();
      for (const error of validationErrors) {
        if (error.kitName) incompleteKits.add(error.kitName);
      }
      this.markKitsAsSynced(dbDir, [...incompleteKits]);

      return {
        data: {
          cancelled: false,
          skippedFiles: validationErrors,
          syncedFiles,
          warnings,
        },
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
   * Mark kits as synced after a completed write: every kit but the ones
   * the write left incomplete, including kits with no files to write
   * (RE-35)
   */
  private markKitsAsSynced(dbDir: string, incompleteKits: string[]): void {
    const result = markAllKitsAsSyncedExcept(dbDir, incompleteKits);
    if (result.success) {
      logger.log(`Marked ${result.data} kits as synced`);
    } else {
      console.warn("Failed to mark kits as synced:", result.error);
    }
  }

  /**
   * What the card holds after a sync: every sample's file in its kit folder
   * and a name file for every named bank. A sample that can't be written
   * keeps its file, so skipping it leaves the card's last copy in place.
   */
  private planCardContents(
    dbDir: string,
    samples: Sample[],
    warnings: string[],
  ): CardContents {
    const kits = new Map<string, string[]>();
    for (const sample of samples) {
      const fileNames = kits.get(sample.kit_name) ?? [];
      fileNames.push(
        cardSampleFileName(
          sample.voice_number,
          sample.slot_number,
          sample.filename,
        ),
      );
      kits.set(sample.kit_name, fileNames);
    }

    const banksResult = getAllBanks(dbDir);
    const bankFiles: string[] = [];
    for (const bank of banksResult.success ? (banksResult.data ?? []) : []) {
      if (!bank.artist) continue;
      if (isWritableBankName(bank.artist)) {
        bankFiles.push(bankRtfFileName(bank.letter, bank.artist));
      } else {
        // A name saved before RE-23's checks can't be a file name
        warnings.push(
          `Bank ${bank.letter}'s name "${bank.artist}" can't be written to the card, so the card won't show it. Rename the bank to fix this.`,
        );
      }
    }

    return { bankFiles, kits };
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
    const samples = samplesResult.data || [];
    const cardContents = this.planCardContents(
      dbDir,
      samples,
      results.warnings,
    );
    for (const sample of samples) {
      syncSampleProcessingService.processSampleForSync(
        sample,
        localStorePath,
        results,
        sdCardPath,
      );
    }
    for (const kitName of syncSampleProcessingService.kitsWithoutVoiceOne(
      samples,
    )) {
      results.warnings.push(
        `Kit ${kitName} has no sample on voice 1, so the Rample won't open it`,
      );
    }

    // Decide mono conversion while planning, so the summary shows it too
    const files = [...results.filesToCopy, ...results.filesToConvert];
    annotateMonoConversion(files, dbDir);

    return {
      data: {
        cardContents,
        dbDir,
        files,
        localStorePath,
        validationErrors: results.validationErrors,
        warnings: results.warnings,
      },
      success: true,
    };
  }

  /**
   * Delete the Rample content on the card that the store no longer has.
   */
  private removeStaleEntries(
    sdCardPath: string,
    cardContents: CardContents,
  ): void {
    const stale = findStaleCardEntries(sdCardPath, cardContents);
    removeCardEntries(sdCardPath, stale);
    if (stale.length > 0) {
      logger.log(
        `Removed ${stale.length} stale entries from the SD card:`,
        stale,
      );
    }
  }

  /**
   * Write bank RTF files to the SD card root for banks with artist names.
   * A failure fails the write, like any other file the card can't take,
   * so it isn't only logged (RE-23).
   */
  private writeBankRtfFiles(dbDir: string, sdCardPath: string): void {
    const banksResult = getAllBanks(dbDir);
    if (!banksResult.success) {
      throw new Error(`Couldn't read the bank names: ${banksResult.error}`);
    }
    const written = rtfFileService.writeAllBankRtfFiles(
      sdCardPath,
      banksResult.data ?? [],
    );
    if (written > 0) {
      logger.log(`Wrote ${written} bank RTF files to SD card`);
    }
  }
}

export const syncService = new SyncService();

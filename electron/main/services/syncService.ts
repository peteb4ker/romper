import type { Bank, DbResult, Sample } from "@romper/shared/db/schema.js";
import type { WriteStereoSummary } from "@romper/shared/stereoLinkRules.js";

import { cardSampleFileName } from "@romper/shared/rampleCardLayout.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";

import {
  getSyncPlanData,
  linkVoicesAutomaticallyTx,
  markAllKitsAsSyncedExceptTx,
  updateSampleSourceStatusTx,
  withDbTransaction,
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
  type SyncResults,
} from "./syncFileOperations.js";
import { annotateMonoConversion } from "./syncMonoAnnotation.js";
import { syncProgressManager } from "./syncProgressManager.js";
import { syncSampleProcessingService } from "./syncSampleProcessing.js";
import { type PlannedSampleFile, planWriteStereo } from "./syncStereoPlan.js";
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
  /**
   * Stereo pairs linked automatically, mixdowns, and quarantined kits,
   * which aren't written and whose copy on the card is kept (#537)
   */
  stereo: WriteStereoSummary;
  /** Samples that can't be written (missing source files) */
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
   * nothing was removed from the card or marked as synced. Cancel during
   * the removal of what the store no longer has stops after the entry in
   * progress (#653); the next write removes the rest.
   */
  cancelled: boolean;
  /** Samples that were not written because they failed validation */
  skippedFiles: SyncValidationError[];
  syncedFiles: number;
  warnings: string[];
}

interface SampleFileStatus {
  id: number;
  source_status: "missing" | "unreadable" | null;
}

interface SyncPlan {
  /** The banks the plan was made from; their name files go on the card */
  banks: Bank[];
  /** What the card should hold once this sync has run */
  cardContents: CardContents;
  dbDir: string;
  files: SyncFileOperation[];
  /**
   * What the write found about sample files whose stored status it
   * changes (#537): missing or unreadable, or null (to be read again when
   * the kit opens) for a file last found missing or unreadable that's now
   * fine. Recorded only when the write completes.
   */
  fileStatuses: SampleFileStatus[];
  kitCount: number;
  localStorePath: string;
  /** Quarantined kits, which aren't written (#537 rule 4) */
  quarantinedKits: Set<string>;
  stereo: WriteStereoSummary;
  validationErrors: SyncValidationError[];
  warnings: string[];
}

/**
 * What planning a sample's file found, as a change to its stored
 * `source_status`, or null when there's nothing to record (#537)
 */
function fileStatusChange(
  sample: Sample,
  errors: SyncValidationError[],
): null | SampleFileStatus {
  let found: SampleFileStatus["source_status"] = null;
  if (errors.some((e) => e.unreadable)) found = "unreadable";
  else if (errors.some((e) => e.type === "missing_file")) found = "missing";
  const stored = sample.source_status;
  if (found) {
    return stored === found ? null : { id: sample.id, source_status: found };
  }
  // Fine now, but last found missing or unreadable: read it again on open
  if (
    errors.length === 0 &&
    (stored === "missing" || stored === "unreadable")
  ) {
    return { id: sample.id, source_status: null };
  }
  return null;
}

/**
 * Samples planned together. Their files are read concurrently, and
 * planning yields to the event loop between batches, so IPC and window
 * events are handled while a large library is planned (RE-82).
 */
const PLAN_BATCH_SIZE = 16;

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
        kitCount: plan.kitCount,
        removals: sdCardPath
          ? await findStaleCardEntries(sdCardPath, plan.cardContents)
          : [],
        stereo: plan.stereo,
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
        banks,
        cardContents,
        dbDir,
        files: allFiles,
        fileStatuses,
        quarantinedKits,
        stereo,
        validationErrors,
        warnings,
      } = planResult.data;

      const refusal = unconfirmedSkipRefusal(validationErrors, options);
      if (refusal) return { error: refusal, success: false };

      syncProgressManager.initializeSyncJob(allFiles);

      const syncedFiles = await syncFileOperationsService.processAllFiles(
        allFiles,
        inMemorySettings,
        options.sdCardPath,
      );

      if (syncProgressManager.getCurrentSyncJob()?.cancelled) {
        syncProgressManager.finalizeSyncJob();
        return writeOutcome(true, validationErrors, syncedFiles, warnings);
      }
      syncProgressManager.emitFinalizingProgress();

      // Write bank RTF files to SD card root, from the banks the plan used,
      // so the stale-entry check below keeps exactly these
      this.writeBankRtfFiles(banks, options.sdCardPath);

      // The card mirrors the store: delete what the store no longer has.
      // Only after every file is written, so a cancelled or failed sync
      // never leaves a kit with less than it had. Cancel stops between
      // removals (#653); the next write removes the rest.
      await this.removeStaleEntries(options.sdCardPath, cardContents);
      if (syncProgressManager.getCurrentSyncJob()?.cancelled) {
        syncProgressManager.finalizeSyncJob();
        return writeOutcome(true, validationErrors, syncedFiles, warnings);
      }

      // The card now mirrors the store, so every kit is in step with it,
      // except a kit with a skipped sample or a quarantined kit: each keeps
      // its "modified since sync" flag.
      const incompleteKits = kitsLeftIncomplete(
        quarantinedKits,
        validationErrors,
      );
      // The links the write made automatically (#537 rule 2) are recorded
      // only now the write has completed, with the synced flags, in one
      // transaction: a cancelled or failed write leaves no links behind
      this.completeWrite(dbDir, stereo, incompleteKits, fileStatuses);

      // Only now is the write complete. The dialog says "Write Complete" on
      // this event, so it must not go out while the card is still being
      // changed or the store could still fail to record the write (#634).
      syncProgressManager.emitCompletionProgress(syncedFiles, allFiles.length);
      syncProgressManager.finalizeSyncJob();

      return writeOutcome(false, validationErrors, syncedFiles, warnings);
    } catch (error) {
      await this.handleSyncFailure(inMemorySettings, error);
      syncProgressManager.finalizeSyncJob();
      return {
        error: `Failed to sync kit: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  }

  /**
   * Record a completed write in one transaction (#537): the links its plan
   * made automatically (rule 2), whose stereo files are now on the card;
   * the file problems it found (missing, unreadable), so the kit list
   * shows a quarantined kit straight away; and every kit but the ones the
   * write left incomplete marked as synced, including kits with no files
   * to write (RE-35). A failure here fails the write, so the store never
   * claims links or a sync it didn't make.
   */
  private completeWrite(
    dbDir: string,
    stereo: WriteStereoSummary,
    incompleteKits: string[],
    fileStatuses: SampleFileStatus[],
  ): void {
    const byKit = new Map<string, number[]>();
    for (const { kitName, voiceNumber } of stereo.autoLinks) {
      byKit.set(kitName, [...(byKit.get(kitName) ?? []), voiceNumber]);
    }
    const recorded = withDbTransaction(dbDir, (db) => {
      for (const [kitName, voiceNumbers] of byKit) {
        linkVoicesAutomaticallyTx(db, kitName, voiceNumbers);
      }
      for (const { id, source_status } of fileStatuses) {
        updateSampleSourceStatusTx(db, id, { source_status });
      }
      return markAllKitsAsSyncedExceptTx(db, incompleteKits);
    });
    if (!recorded.success) {
      throw new Error(`Couldn't record the write: ${recorded.error}`);
    }
    logger.log(`Marked ${recorded.data} kits as synced`);
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
   * Handle sync failure and cleanup. The partial output is removed
   * asynchronously, so a large folder doesn't block the main process
   * (#653).
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
          await fs.promises.rm(syncOutputDir, {
            force: true,
            recursive: true,
          });
        }
      } catch (cleanupError) {
        console.warn("Failed to cleanup partial sync files:", cleanupError);
      }
    }

    // Cleanup handled by progress manager
  }

  /**
   * What the card holds after a sync: every sample's file in its kit folder
   * and a name file for every named bank. A sample that can't be written
   * keeps its file, so skipping it leaves the card's last copy in place.
   */
  private planCardContents(
    banks: Bank[],
    samples: Sample[],
    warnings: string[],
    quarantinedKits: Set<string>,
  ): CardContents {
    const kits = new Map<string, string[]>();
    for (const sample of samples) {
      // A quarantined kit's folder is kept as it is (#537 rule 4)
      if (quarantinedKits.has(sample.kit_name)) continue;
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

    const bankFiles: string[] = [];
    for (const bank of banks) {
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

    return { bankFiles, keepKits: quarantinedKits, kits };
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
    // One load for the whole plan: samples, voices, banks and the kit count
    // (RE-82)
    const loaded = getSyncPlanData(dbDir);
    if (!loaded.success || !loaded.data) {
      return {
        error: `Failed to gather samples: ${loaded.error ?? "no data"}`,
        success: false,
      };
    }
    const { banks, kitCount, samples, voices } = loaded.data;

    const results = emptySyncResults();
    // What reading each sample's file found, in sample order
    const sampleFiles: PlannedSampleFile[] = [];
    const fileStatuses: SampleFileStatus[] = [];
    for (let start = 0; start < samples.length; start += PLAN_BATCH_SIZE) {
      const batch = samples.slice(start, start + PLAN_BATCH_SIZE);
      const plans = batch.map(async (sample) => {
        const sampleResults = emptySyncResults();
        await syncSampleProcessingService.processSampleForSync(
          sample,
          localStorePath,
          sampleResults,
          sdCardPath,
        );
        return sampleResults;
      });
      // Batches bound how many files are open at once
      const planned = await Promise.all(plans); // NOSONAR: batched on purpose
      // Merged in sample order, whatever order the reads finished in
      for (const [i, sampleResults] of planned.entries()) {
        const change = fileStatusChange(
          batch[i],
          sampleResults.validationErrors,
        );
        if (change) fileStatuses.push(change);
        sampleFiles.push({
          channels: [
            ...sampleResults.filesToCopy,
            ...sampleResults.filesToConvert,
          ][0]?.channels,
          unreadable: sampleResults.validationErrors.some((e) => e.unreadable),
        });
        results.filesToCopy.push(...sampleResults.filesToCopy);
        results.filesToConvert.push(...sampleResults.filesToConvert);
        results.validationErrors.push(...sampleResults.validationErrors);
      }
      await yieldToEventLoop(); // NOSONAR: yields between batches on purpose (RE-82)
    }
    for (const kitName of syncSampleProcessingService.kitsWithoutVoiceOne(
      samples,
    )) {
      results.warnings.push(
        `Kit ${kitName} has no sample on voice 1, so the Rample won't open it`,
      );
    }

    // The stereo rules (#537): automatic links, mixdowns and quarantine.
    // A quarantined kit isn't written and its card folder is kept.
    const stereo = planWriteStereo(samples, sampleFiles, voices);
    const written = (kitName?: string) =>
      !kitName || !stereo.quarantinedKits.has(kitName);
    const cardContents = this.planCardContents(
      banks,
      samples,
      results.warnings,
      stereo.quarantinedKits,
    );

    // Decide mono conversion while planning, so the summary shows it too
    const files = [...results.filesToCopy, ...results.filesToConvert].filter(
      (file) => written(file.kitName),
    );
    annotateMonoConversion(files, stereo.effectiveVoices);

    return {
      data: {
        banks,
        cardContents,
        dbDir,
        files,
        fileStatuses,
        kitCount,
        localStorePath,
        quarantinedKits: stereo.quarantinedKits,
        stereo: stereo.summary,
        validationErrors: results.validationErrors.filter((error) =>
          written(error.kitName),
        ),
        warnings: results.warnings,
      },
      success: true,
    };
  }

  /**
   * Delete the Rample content on the card that the store no longer has,
   * reporting each removal and stopping between entries if the write is
   * cancelled.
   */
  private async removeStaleEntries(
    sdCardPath: string,
    cardContents: CardContents,
  ): Promise<void> {
    const stale = await findStaleCardEntries(sdCardPath, cardContents);
    if (stale.length === 0) return;
    // The panel counts the removals: "Removing old kits… 3/40" (#653)
    syncProgressManager.emitRemovalProgress(0, stale.length);
    const removed = await removeCardEntries(sdCardPath, stale, {
      onRemoved: (count, total) =>
        syncProgressManager.emitRemovalProgress(count, total),
      shouldStop: () =>
        Boolean(syncProgressManager.getCurrentSyncJob()?.cancelled),
    });
    // What's left (recording the write) is finishing work again
    if (!syncProgressManager.getCurrentSyncJob()?.cancelled) {
      syncProgressManager.emitFinalizingProgress();
    }
    if (removed > 0) {
      logger.log(
        `Removed ${removed} of ${stale.length} stale entries from the SD card:`,
        stale.slice(0, removed),
      );
    }
  }

  /**
   * Write bank RTF files to the SD card root for banks with artist names.
   * A failure fails the write, like any other file the card can't take,
   * so it isn't only logged (RE-23).
   */
  private writeBankRtfFiles(banks: Bank[], sdCardPath: string): void {
    const written = rtfFileService.writeAllBankRtfFiles(sdCardPath, banks);
    if (written > 0) {
      logger.log(`Wrote ${written} bank RTF files to SD card`);
    }
  }
}

export const syncService = new SyncService();

function emptySyncResults(): SyncResults {
  return {
    filesToConvert: [],
    filesToCopy: [],
    hasFormatWarnings: false,
    validationErrors: [],
    warnings: [],
  };
}

/**
 * Kits a completed write leaves flagged "modified since sync": quarantined
 * kits, and kits with a sample the write skipped
 */
function kitsLeftIncomplete(
  quarantinedKits: ReadonlySet<string>,
  validationErrors: readonly SyncValidationError[],
): string[] {
  const incompleteKits = new Set<string>(quarantinedKits);
  for (const error of validationErrors) {
    if (error.kitName) incompleteKits.add(error.kitName);
  }
  return [...incompleteKits];
}

/**
 * Why a write refuses to start: samples that can't be written must not be
 * dropped silently, so it refuses before touching the card unless the user
 * has reviewed them in the summary and chosen to skip them. Null when it
 * can go ahead.
 */
function unconfirmedSkipRefusal(
  validationErrors: readonly SyncValidationError[],
  options: SyncOptions,
): null | string {
  if (validationErrors.length === 0 || options.skipInvalidFiles) return null;
  const count = validationErrors.length;
  const samples = count === 1 ? "1 sample" : `${count} samples`;
  return `${samples} can't be written to the card. Nothing was written. Confirm skipping them in the write summary to continue.`;
}

/** A write's result, completed or cancelled */
function writeOutcome(
  cancelled: boolean,
  skippedFiles: SyncValidationError[],
  syncedFiles: number,
  warnings: string[],
): DbResult<SyncOutcome> {
  return {
    data: { cancelled, skippedFiles, syncedFiles, warnings },
    success: true,
  };
}

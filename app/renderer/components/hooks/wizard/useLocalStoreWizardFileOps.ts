import type { KitScanResult } from "@romper/shared/db/schema";

import { cardKitFolders, isKitName } from "@romper/shared/rampleCardLayout";
import { describeSetupAutoLink } from "@romper/shared/stereoLinkRules";
import { useCallback, useMemo } from "react";

import type { ElectronAPI } from "../../../electron.d";
import type {
  LocalStoreWizardState,
  ProgressEvent,
  StereoImportNotice,
  TruncationWarning,
} from "./useLocalStoreWizardState";

import {
  createRomperDb,
  importSetupBankNames,
  importSetupKit,
} from "../../utils/romperDb";
import { SetupCancelledError } from "./setupCancelled";

export interface UseLocalStoreWizardFileOpsOptions {
  api: ElectronAPI;
  reportProgress: (p: ProgressEvent) => void;
  reportStepProgress: (options: {
    items: string[];
    onStep: (item: string, idx: number) => Promise<void>;
    phase: string;
  }) => Promise<void>;
  setError: (error: null | string) => void;
  setWizardState: (patch: Partial<LocalStoreWizardState>) => void;
  /** Throws once the user has cancelled setup (RE-66) */
  throwIfCancelled?: () => void;
}

/**
 * The folder whose bank name files (`A - Name.rtf`) setup imports into
 * `banks.artist`, the names' only owner: the card for a card setup, since
 * only its kit folders are copied (#564), or the store itself for the
 * factory archive, which was extracted into it (#567). They're read once,
 * here; afterwards the store's name files are only written. A blank store
 * has none.
 */
export function bankNamesSourcePath({
  sdCardSourcePath,
  source,
  targetPath,
}: Pick<LocalStoreWizardState, "sdCardSourcePath" | "source" | "targetPath">):
  | string
  | undefined {
  if (source === "sdcard") return sdCardSourcePath;
  if (source === "squarp") return targetPath;
  return undefined;
}

/**
 * Hook for managing Local Store Wizard file operations
 * Extracted from useLocalStoreWizard to reduce complexity
 */
export function useLocalStoreWizardFileOps({
  api,
  reportProgress,
  reportStepProgress,
  setError,
  setWizardState,
  throwIfCancelled = () => {},
}: UseLocalStoreWizardFileOpsOptions) {
  // --- Kit folder validation ---
  const validateSdCardFolder = useCallback(
    async (sdCardSourcePath: string) => {
      if (!sdCardSourcePath) return null;
      if (!api.listFilesInRoot) return "Cannot access filesystem.";
      const files = await listFolder(api, sdCardSourcePath);
      if (cardKitFolders(files).length === 0) {
        const nonHidden = files.filter((f) => !f.startsWith("."));
        const overflow =
          nonHidden.length > 5 ? ` (+${nonHidden.length - 5} more)` : "";
        const foundList =
          nonHidden.length > 0
            ? `Found: ${nonHidden.slice(0, 5).join(", ")}${overflow}`
            : "The folder is empty";
        return `No kit folders found in ${sdCardSourcePath}. ${foundList}. Expected kit folders named like the Rample's: a bank letter and a number from 0 to 99, such as A0, B1 or Z99.`;
      }
      return null;
    },
    [api],
  );

  // --- SD Card validation and copy combined ---
  const validateAndCopySdCardKits = useCallback(
    async (sdCardSourcePath: string, targetPath: string) => {
      if (!sdCardSourcePath) throw new Error("SD card source path is required");
      const validationError = await validateSdCardFolder(sdCardSourcePath);
      if (validationError) {
        setWizardState({
          kitFolderValidationError: validationError,
          source: null,
        });
        throw new Error(validationError);
      } else {
        setWizardState({ kitFolderValidationError: undefined });
      }
      if (!api.listFilesInRoot || !api.copyDir)
        throw new Error("Missing Electron API");
      const files = await listFolder(api, sdCardSourcePath);
      // Each kit folder goes into the store under its kit's name: `a5` is
      // kit A5, as a write treats it, so setup leaves none behind (#573)
      const kitFolders = new Map(
        cardKitFolders(files).map(({ folder, kitName }) => [kitName, folder]),
      );
      await reportStepProgress({
        items: [...kitFolders.keys()],
        onStep: async (kit) => {
          if (!api.copyDir) throw new Error("Missing Electron API");
          const copied = await api.copyDir(
            `${sdCardSourcePath}/${kitFolders.get(kit)}`,
            `${targetPath}/${kit}`,
          );
          // A failed copy used to go unnoticed and the import carried on
          if (copied && !copied.success) {
            throw new Error(
              `Couldn't copy kit ${kit} from the card: ${copied.error ?? "unknown error"}`,
            );
          }
        },
        phase: "Copying kits...",
      });
    },
    [api, validateSdCardFolder, reportStepProgress, setWizardState],
  );

  const extractSquarpArchive = useCallback(
    async (targetPath: string) => {
      // Main owns the archive URL; the renderer only names the destination.
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Throttle progress updates to avoid thousands of UI refreshes
        let lastProgressUpdate = 0;
        let lastProgressPhase = "";
        const progressThrottle = 100;

        const result = await api.downloadAndExtractArchive?.(
          targetPath,
          (p: unknown) => {
            const progress = p as ProgressEvent;
            const now = Date.now();
            if (
              progress.percent === 100 ||
              progress.phase !== lastProgressPhase ||
              now - lastProgressUpdate > progressThrottle
            ) {
              lastProgressUpdate = now;
              lastProgressPhase = progress.phase;
              reportProgress(progress);
            }
          },
          (e: unknown) => {
            const error = e as Error;
            setError(error.message || String(e));
          },
        );

        if (result?.success) return;
        // Cancelled in main, or here between attempts: never retry
        if (result?.cancelled) throw new SetupCancelledError();
        throwIfCancelled();

        // Main says why it failed. Only a network failure is worth another
        // 313 MiB download: a checksum mismatch, a damaged archive or a full
        // disk would fail the same way again, so show main's reason now
        // instead of retrying behind a generic network error (RE-77).
        const reason =
          result?.error ?? "The factory samples couldn't be installed.";
        if (!result?.retryable) throw new Error(reason);

        if (attempt < maxRetries) {
          const delay = attempt * 2000;
          reportProgress({
            percent: 0,
            phase: `Download failed, retrying (attempt ${attempt + 1} of ${maxRetries})...`,
          });
          await new Promise((resolve) => setTimeout(resolve, delay)); // NOSONAR - retry backoff delay; attempts must be sequential
        } else {
          throw new Error(
            `Factory samples download failed after ${maxRetries} attempts. ${reason}`,
          );
        }
      }
    },
    [throwIfCancelled, api, reportProgress, setError],
  );

  /**
   * Create the store's database and import its kit folders, then the bank
   * names in the `bankNamesPath` folder's name files, if setup has one
   * (see {@link bankNamesSourcePath}).
   */
  const createAndPopulateDb = useCallback(
    async (targetPath: string, bankNamesPath?: string) => {
      const dbDir = `${targetPath}/.romperdb`;
      if (api.ensureDir) await api.ensureDir(dbDir);
      await createRomperDb(dbDir);
      // The store's kit folders, which setup named by their kits
      const validKits = (await listFolder(api, targetPath)).filter(isKitName);
      const truncationWarnings: TruncationWarning[] = [];
      const stereoNotices: StereoImportNotice[] = [];
      if (validKits.length > 0) {
        await reportStepProgress({
          items: validKits,
          onStep: async (kitName) => {
            // Main imports the kit: samples, WAV metadata and voice names
            const result = await importSetupKit(dbDir, kitName);
            truncationWarnings.push(...voiceFullWarnings(kitName, result));
            stereoNotices.push(...stereoImportNotices(kitName, result));
          },
          phase: "Writing to database",
        });
      }
      if (bankNamesPath) {
        await importSetupBankNames(dbDir, bankNamesPath);
      }
      return { dbDir, stereoNotices, truncationWarnings, validKits };
    },
    [api, reportStepProgress],
  );

  return useMemo(
    () => ({
      createAndPopulateDb,
      extractSquarpArchive,
      validateAndCopySdCardKits,
      validateSdCardFolder,
    }),
    [
      createAndPopulateDb,
      extractSquarpArchive,
      validateAndCopySdCardKits,
      validateSdCardFolder,
    ],
  );
}

// --- Helpers ---
/**
 * A folder's entries, from main. A listing that failed (a card that stopped
 * responding, #724) fails setup with main's reason.
 */
async function listFolder(api: ElectronAPI, folder: string): Promise<string[]> {
  if (!api.listFilesInRoot) throw new Error("listFilesInRoot is not available");
  const listed = await api.listFilesInRoot(folder);
  if (!listed.success || !listed.data) {
    throw new Error(listed.error ?? `Failed to read directory: ${folder}`);
  }
  return listed.data;
}

/** The setup summary's lines for the pairs setup linked (#537 rule 2) */
function stereoImportNotices(
  kitName: string,
  result: KitScanResult,
): StereoImportNotice[] {
  return (result.stereo?.autoLinks ?? []).map((voiceNumber) => ({
    kitName,
    message: describeSetupAutoLink(kitName, voiceNumber),
    voiceNumber,
  }));
}

/**
 * One warning per voice that had more files than its 12 slots, naming the
 * files it left out (#518)
 */
function voiceFullWarnings(
  kitName: string,
  result: KitScanResult,
): TruncationWarning[] {
  const skippedByVoice = new Map<number, string[]>();
  for (const file of result.skippedFiles) {
    if (file.reason !== "voice_full") continue;
    const names = skippedByVoice.get(file.voiceNumber) ?? [];
    names.push(file.filename);
    skippedByVoice.set(file.voiceNumber, names);
  }
  return [...skippedByVoice]
    .sort(([a], [b]) => a - b)
    .map(([voiceNumber, skippedFiles]) => ({
      kept: 12,
      kitName,
      skipped: skippedFiles.length,
      skippedFiles,
      total: 12 + skippedFiles.length,
      voiceNumber,
    }));
}

import type { KitScanResult } from "@romper/shared/db/schema";

import { isValidKit } from "@romper/shared/kitUtilsShared";
import { useCallback, useMemo } from "react";

import type { ElectronAPI } from "../../../electron.d";
import type {
  LocalStoreWizardState,
  ProgressEvent,
  TruncationWarning,
} from "./useLocalStoreWizardState";

import { createRomperDb, importSetupKit } from "../../utils/romperDb";

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
}: UseLocalStoreWizardFileOpsOptions) {
  // --- Kit folder validation ---
  const validateSdCardFolder = useCallback(
    async (sdCardSourcePath: string) => {
      if (!sdCardSourcePath) return null;
      if (!api.listFilesInRoot) return "Cannot access filesystem.";
      const files = await api.listFilesInRoot(sdCardSourcePath);
      const kitFolders = getKitFolders(files);
      if (kitFolders.length === 0) {
        const nonHidden = files.filter((f) => !f.startsWith("."));
        const overflow =
          nonHidden.length > 5 ? ` (+${nonHidden.length - 5} more)` : "";
        const foundList =
          nonHidden.length > 0
            ? `Found: ${nonHidden.slice(0, 5).join(", ")}${overflow}`
            : "The folder is empty";
        return `No kit folders found in ${sdCardSourcePath}. ${foundList}. Expected folders named like A0, B1, Drum01 (uppercase letter followed by a number).`;
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
      const files = await api.listFilesInRoot(sdCardSourcePath);
      const kitFolders = getKitFolders(files);
      await reportStepProgress({
        items: kitFolders,
        onStep: async (kit) => {
          if (!api.copyDir) throw new Error("Missing Electron API");
          await api.copyDir(
            `${sdCardSourcePath}/${kit}`,
            `${targetPath}/${kit}`,
          );
        },
        phase: "Copying kits...",
      });
    },
    [api, validateSdCardFolder, reportStepProgress, setWizardState],
  );

  const extractSquarpArchive = useCallback(
    async (targetPath: string) => {
      // Main owns the archive URL; the renderer only names the destination.
      const isTest = process.env.NODE_ENV === "test";
      const maxRetries = isTest ? 1 : 3;

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

        if (attempt < maxRetries) {
          const delay = attempt * 2000;
          reportProgress({
            percent: 0,
            phase: `Download failed, retrying (attempt ${attempt + 1} of ${maxRetries})...`,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw new Error(
            `Factory samples download failed after ${maxRetries} attempts. Please check your internet connection and try again.`,
          );
        }
      }
    },
    [api, reportProgress, setError],
  );

  const createAndPopulateDb = useCallback(
    async (targetPath: string) => {
      const dbDir = `${targetPath}/.romperdb`;
      if (api.ensureDir) await api.ensureDir(dbDir);
      await createRomperDb(dbDir);
      if (!api.listFilesInRoot)
        throw new Error("listFilesInRoot is not available");
      const kitFolders = await api.listFilesInRoot(targetPath);
      const validKits = getKitFolders(kitFolders);
      const truncationWarnings: TruncationWarning[] = [];
      if (validKits.length > 0) {
        await reportStepProgress({
          items: validKits,
          onStep: async (kitName) => {
            // Main imports the kit: samples, WAV metadata and voice names
            const result = await importSetupKit(dbDir, kitName);
            truncationWarnings.push(...voiceFullWarnings(kitName, result));
          },
          phase: "Writing to database",
        });
      }
      return { dbDir, truncationWarnings, validKits };
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
// The folders the Rample reads as kits (A0-Z99); main imports only these
function getKitFolders(files: string[]): string[] {
  return files.filter(isValidKit);
}

/** One warning per voice that had more files than its 12 slots */
function voiceFullWarnings(
  kitName: string,
  result: KitScanResult,
): TruncationWarning[] {
  const skippedByVoice = new Map<number, number>();
  for (const file of result.skippedFiles) {
    if (file.reason !== "voice_full") continue;
    skippedByVoice.set(
      file.voiceNumber,
      (skippedByVoice.get(file.voiceNumber) ?? 0) + 1,
    );
  }
  return [...skippedByVoice]
    .sort(([a], [b]) => a - b)
    .map(([voiceNumber, skipped]) => ({
      kept: 12,
      kitName,
      skipped,
      total: 12 + skipped,
      voiceNumber,
    }));
}

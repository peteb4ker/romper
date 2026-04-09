import { groupSamplesByVoice } from "@romper/shared/kitUtilsShared";
import { useCallback, useMemo } from "react";

import type { ElectronAPI } from "../../../electron.d";
import type {
  LocalStoreWizardState,
  ProgressEvent,
} from "./useLocalStoreWizardState";

import { config } from "../../../config";
import { createRomperDb, insertKit, insertSample } from "../../utils/romperDb";

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
        const foundList =
          nonHidden.length > 0
            ? `Found: ${nonHidden.slice(0, 5).join(", ")}${nonHidden.length > 5 ? ` (+${nonHidden.length - 5} more)` : ""}`
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
      if (!sdCardSourcePath) throw new Error();
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
      const url = config.squarpArchiveUrl;
      const isTest = process.env.NODE_ENV === "test";
      const maxRetries = isTest ? 1 : 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Throttle progress updates to avoid thousands of UI refreshes
        let lastProgressUpdate = 0;
        let lastProgressPhase = "";
        const progressThrottle = 100;

        const result = await api.downloadAndExtractArchive?.(
          url,
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
      const truncationWarnings: Array<{
        kept: number;
        kitName: string;
        skipped: number;
        total: number;
        voiceNumber: number;
      }> = [];
      if (validKits.length > 0) {
        await reportStepProgress({
          items: validKits,
          onStep: async (kitName) => {
            const kitPath = `${targetPath}/${kitName}`;
            if (!api.listFilesInRoot)
              throw new Error("listFilesInRoot is not available");
            const files = await api.listFilesInRoot(kitPath);
            const wavFiles = files.filter((f: string) => /\.wav$/i.test(f));
            // Extract bank letter from kit name (e.g., "A0" -> "A", "B12" -> "B")
            const bankLetter = kitName.charAt(0);
            const insertedKitName = await insertKit(dbDir, {
              bank_letter: bankLetter,
              editable: false,
              name: kitName,
            });
            const voices = groupSamplesByVoice(wavFiles);
            for (const voiceNum of Object.keys(voices)) {
              const voiceSamples = voices[Number(voiceNum)];
              if (voiceSamples && voiceSamples.length > 0) {
                // Only process the first 12 samples per voice (slot limit)
                const maxSamples = Math.min(voiceSamples.length, 12);
                for (let idx = 0; idx < maxSamples; idx++) {
                  const filename = voiceSamples[idx];
                  // Set source_path to the absolute path for reference-only architecture
                  const sourcePath = `${kitPath}/${filename}`;
                  await insertSample(dbDir, {
                    filename,
                    is_stereo: false,
                    kit_name: insertedKitName,
                    slot_number: idx, // 0-based slot indexing (0-11)
                    source_path: sourcePath,
                    voice_number: Number(voiceNum),
                  });
                }
                if (voiceSamples.length > 12) {
                  truncationWarnings.push({
                    kept: 12,
                    kitName,
                    skipped: voiceSamples.length - 12,
                    total: voiceSamples.length,
                    voiceNumber: Number(voiceNum),
                  });
                }
              }
            }
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
function getKitFolders(files: string[]): string[] {
  const kitRegex = /^\p{Lu}.*?(?:[1-9]?\d)$/u;
  return files.filter((f) => kitRegex.test(f));
}

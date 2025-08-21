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
        return "No valid kit folders found. Please choose a folder with kit subfolders (e.g. A0, B12, etc).";
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

      // Throttle progress updates to avoid thousands of UI refreshes
      let lastProgressUpdate = 0;
      let lastProgressPhase = "";
      const progressThrottle = 100; // Update at most every 100ms

      const result = await api.downloadAndExtractArchive?.(
        url,
        targetPath,
        (p: unknown) => {
          const progress = p as ProgressEvent;
          const now = Date.now();
          // Always report phase changes and completion
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
      if (!result?.success)
        throw new Error(result?.error || "Failed to extract archive");
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
                // Log if samples were skipped
                if (voiceSamples.length > 12) {
                  const isDev = process.env.NODE_ENV === "development";
                  isDev &&
                    console.debug(
                      `[Hook] Skipped ${voiceSamples.length - 12} samples in voice ${voiceNum} (exceeds 12 slot limit)`,
                    );
                }
              }
            }
          },
          phase: "Writing to database",
        });
      }
      return { dbDir, validKits };
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

import { useCallback, useEffect, useRef, useState } from "react";

import { groupSamplesByVoice } from "../../../../shared/kitUtilsShared";
import { config } from "../../config";
import type { ElectronAPI } from "../../electron.d";
import { createRomperDb, insertKit, insertSample } from "../utils/romperDb";
import { executeFullKitScan } from "../utils/scanners/orchestrationFunctions";
import type { FullKitScanInput } from "../utils/scanners/types";

export type LocalStoreSource = "sdcard" | "squarp" | "blank";

export interface LocalStoreWizardState {
  targetPath: string;
  source: LocalStoreSource | null;
  sdCardMounted: boolean;
  isInitializing: boolean;
  error: string | null;
  sdCardSourcePath?: string; // Renamed from localStorePath for clarity
  kitFolderValidationError?: string | null;
  sourceConfirmed?: boolean;
}

export interface ProgressEvent {
  phase: string;
  percent?: number;
  file?: string;
}

// --- Electron API wrappers ---
// Use the global ElectronAPI type from electron.d.ts for DRYness
// (no local interface needed)

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

function getElectronAPI(): ElectronAPI {
  // Use type assertion to avoid type conflict with window.electronAPI
  return typeof window !== "undefined" && window.electronAPI
    ? window.electronAPI
    : ({} as ElectronAPI);
}

function useElectronAPI(): ElectronAPI {
  return getElectronAPI();
}

// --- Helpers ---
function getKitFolders(files: string[]): string[] {
  const kitRegex = /^[A-Z].*?(?:[1-9]?\d)$/;
  return files.filter((f) => kitRegex.test(f));
}

async function getDefaultRomperPathAsync(api: any): Promise<string> {
  if (api.getUserHomeDir) {
    const homeDir = await api.getUserHomeDir();
    if (typeof homeDir === "string" && homeDir.length > 0) {
      return homeDir + "/Documents/romper";
    }
  }
  return "";
}

// --- Main Hook ---
export function useLocalStoreWizard(
  onProgress?: (p: ProgressEvent) => void,
  setLocalStorePath?: (path: string) => void,
) {
  const api = useElectronAPI();
  const [state, setState] = useState<LocalStoreWizardState>({
    targetPath: "",
    source: null,
    sdCardMounted: false,
    isInitializing: false,
    error: null,
    sourceConfirmed: false,
  });
  const [defaultPath, setDefaultPath] = useState("");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const progressCb = useRef(onProgress);
  progressCb.current = onProgress;

  // --- Progress reporting ---
  const reportProgress = useCallback((p: ProgressEvent) => {
    setProgress(p);
    if (progressCb.current) progressCb.current(p);
  }, []);

  // --- State setters ---
  const setTargetPath = useCallback(
    (targetPath: string) => setState((s) => ({ ...s, targetPath })),
    [],
  );
  const setSource = useCallback(
    (source: LocalStoreSource) => setState((s) => ({ ...s, source })),
    [],
  );
  const setSdCardMounted = useCallback(
    (mounted: boolean) => setState((s) => ({ ...s, sdCardMounted: mounted })),
    [],
  );
  const setError = useCallback(
    (error: string | null) => setState((s) => ({ ...s, error })),
    [],
  );
  const setIsInitializing = useCallback(
    (isInitializing: boolean) => setState((s) => ({ ...s, isInitializing })),
    [],
  );
  const setSdCardPath = useCallback(
    (sdCardSourcePath: string) =>
      setState((s) => ({
        ...s,
        sdCardSourcePath,
        kitFolderValidationError: undefined,
      })),
    [],
  );
  const setSourceConfirmed = useCallback(
    (confirmed: boolean) =>
      setState((s) => ({ ...s, sourceConfirmed: confirmed })),
    [],
  );

  // --- State update helper ---
  const setWizardState = useCallback(
    (patch: Partial<LocalStoreWizardState>) => {
      setState((s) => ({ ...s, ...patch }));
    },
    [],
  );

  // --- Error message normalization ---
  function normalizeErrorMessage(msg: string) {
    if (msg.includes("premature close")) {
      return "Download failed: The connection was closed before completion. Please check your internet connection and try again.";
    }
    return msg;
  }

  // --- Progress reporting helper ---
  const reportStepProgress = useCallback(
    ({
      items,
      phase,
      onStep,
    }: {
      items: string[];
      phase: string;
      onStep: (item: string, idx: number) => Promise<void>;
    }) => {
      // Sequentially process items for correct progress updates
      return (async () => {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          reportProgress({
            phase,
            percent: Math.round(((idx + 1) / items.length) * 100),
            file: item,
          });
          await onStep(item, idx);
        }
        if (items.length > 0) reportProgress({ phase, percent: 100 });
      })();
    },
    [reportProgress],
  );

  // --- Load default path on mount ---
  useEffect(() => {
    (async () => {
      let path = await getDefaultRomperPathAsync(api);
      setDefaultPath(path);
      // Do NOT set targetPath here; only set defaultPath
      // Do NOT read from system settings
    })();
    // Clear targetPath and source on wizard mount (start)
    setState((s) => ({
      ...s,
      targetPath: "",
      source: null,
      sdCardSourcePath: undefined,
      kitFolderValidationError: undefined,
      error: null,
      isInitializing: false,
      sdCardMounted: false,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        phase: "Copying kits...",
        onStep: async (kit) => {
          if (!api.copyDir) throw new Error("Missing Electron API");
          await api.copyDir(
            `${sdCardSourcePath}/${kit}`,
            `${targetPath}/${kit}`,
          );
        },
      });
    },
    [api, validateSdCardFolder, reportStepProgress, setWizardState],
  );

  const extractSquarpArchive = useCallback(
    async (targetPath: string) => {
      const url = config.squarpArchiveUrl;
      const result = await api.downloadAndExtractArchive?.(
        url,
        targetPath,
        (p: any) => reportProgress(p),
        (e: any) => setError(e?.message || String(e)),
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
          phase: "Writing to database",
          onStep: async (kitName) => {
            const kitPath = `${targetPath}/${kitName}`;
            if (!api.listFilesInRoot)
              throw new Error("listFilesInRoot is not available");
            const files = await api.listFilesInRoot(kitPath);
            const wavFiles = files.filter((f: string) => /\.wav$/i.test(f));
            // Extract bank letter from kit name (e.g., "A0" -> "A", "B12" -> "B")
            const bankLetter = kitName.charAt(0);
            const insertedKitName = await insertKit(dbDir, {
              name: kitName,
              bank_letter: bankLetter,
              editable: false,
            });
            const voices = groupSamplesByVoice(wavFiles);
            for (const voiceNum of Object.keys(voices)) {
              const voiceSamples = voices[Number(voiceNum)];
              if (voiceSamples && voiceSamples.length > 0) {
                // Only process the first 12 samples per voice (slot limit)
                const maxSamples = Math.min(voiceSamples.length, 12);
                for (let idx = 0; idx < maxSamples; idx++) {
                  const filename = voiceSamples[idx];
                  await insertSample(dbDir, {
                    kit_name: insertedKitName,
                    filename,
                    voice_number: Number(voiceNum),
                    slot_number: idx + 1,
                    is_stereo: false,
                  });
                }
                // Log if samples were skipped
                if (voiceSamples.length > 12) {
                  console.log(
                    `[Hook] Skipped ${voiceSamples.length - 12} samples in voice ${voiceNum} (exceeds 12 slot limit)`,
                  );
                }
              }
            }
          },
        });
      }
      return { dbDir, validKits };
    },
    [api, reportStepProgress],
  );

  const runScanning = useCallback(
    async (targetPath: string, dbDir: string, kitNames: string[]) => {
      if (kitNames.length === 0) {
        console.log("[Hook] No kits to scan, skipping scanning phase");
        return;
      }

      console.log(
        "[Hook] Starting scanning operations for",
        kitNames.length,
        "kits",
      );

      // Create a file reader that works with Electron APIs
      const createFileReader = () => {
        return async (filePath: string): Promise<ArrayBuffer> => {
          if (!api.readFile) {
            throw new Error("File reading not available");
          }
          const result = await api.readFile(filePath);
          if (!result.success || !result.data) {
            throw new Error(result.error || "Failed to read file");
          }
          return result.data;
        };
      };

      await reportStepProgress({
        items: kitNames,
        phase: "Scanning kits for metadata...",
        onStep: async (kitName) => {
          try {
            const kitPath = `${targetPath}/${kitName}`;
            if (!api.listFilesInRoot) {
              throw new Error("listFilesInRoot is not available");
            }

            const files = await api.listFilesInRoot(kitPath);
            const wavFiles = files
              .filter((f: string) => /\.wav$/i.test(f))
              .map((f: string) => `${kitPath}/${f}`);

            // Group samples by voice for voice inference
            const wavFileNames = files.filter((f: string) => /\.wav$/i.test(f));
            const samples = groupSamplesByVoice(wavFileNames);

            // Prepare scan input
            const scanInput: FullKitScanInput = {
              samples,
              wavFiles,
              fileReader: createFileReader(),
            };

            // Execute the full scan chain with error handling
            const scanResult = await executeFullKitScan(
              scanInput,
              undefined, // No detailed progress callback for now
              "continue", // Continue on errors
            );

            // Update kit metadata based on scan results
            const updates: {
              alias?: string;
              artist?: string;
              tags?: string[];
              description?: string;
            } = {};

            // Artist metadata is now handled by bank scanning, not kit scanning

            // Apply voice inference results as tags if available
            if (
              scanResult.success &&
              scanResult.results.voiceInference?.voiceNames
            ) {
              const voiceNames = scanResult.results.voiceInference.voiceNames;
              const voiceTags = Object.values(voiceNames).filter(
                (name): name is string => Boolean(name),
              );
              if (voiceTags.length > 0) {
                updates.tags = voiceTags;
              }
            }

            // Update kit metadata if we have any updates
            if (Object.keys(updates).length > 0 && api.updateKit) {
              const updateResult = await api.updateKit(dbDir, kitName, updates);
              if (!updateResult.success) {
                console.warn(
                  `[Hook] Failed to update metadata for kit ${kitName}:`,
                  updateResult.error,
                );
              } else {
                console.log(
                  `[Hook] Updated metadata for kit ${kitName}:`,
                  updates,
                );
              }
            }

            // Log scan results for debugging
            if (scanResult.errors.length > 0) {
              console.warn(
                `[Hook] Scan warnings for kit ${kitName}:`,
                scanResult.errors,
              );
            }
          } catch (error) {
            console.error(`[Hook] Scanning failed for kit ${kitName}:`, error);
            // Continue with other kits even if one fails
          }
        },
      });

      console.log("[Hook] Scanning operations completed");
    },
    [api, reportStepProgress],
  );

  const initialize = useCallback(async () => {
    console.log("[Hook] initialize starting with state:", state);
    setIsInitializing(true);
    setError(null);
    setProgress(null);
    try {
      if (!state.targetPath) throw new Error("No target path specified");
      if (!state.source) throw new Error("No source selected");
      if (api.ensureDir) await api.ensureDir(state.targetPath);

      // Set the local store path early in the process, before potentially failing operations
      console.log(
        "[Hook] setLocalStorePath callback available:",
        !!setLocalStorePath,
      );
      console.log("[Hook] state.targetPath:", state.targetPath);
      if (setLocalStorePath) {
        console.log("[Hook] Calling setLocalStorePath with:", state.targetPath);
        setLocalStorePath(state.targetPath);
        console.log("[Hook] setLocalStorePath called successfully");
      } else if (api.setSetting) {
        console.log("[Hook] Falling back to api.setSetting");
        await api.setSetting("localStorePath", state.targetPath);
        console.log("[Hook] api.setSetting called successfully");
      } else {
        console.log("[Hook] No method available to set local store path!");
      }

      if (state.source === "sdcard") {
        if (!state.sdCardSourcePath)
          throw new Error("No SD card path selected");
        console.log("[Hook] initialize - copying SD card kits");
        await validateAndCopySdCardKits(
          state.sdCardSourcePath,
          state.targetPath,
        );
      }
      if (state.source === "squarp") {
        console.log("[Hook] initialize - extracting Squarp archive");
        await extractSquarpArchive(state.targetPath);
        console.log("[Hook] initialize - Squarp archive extraction completed");
        // Add a small delay to ensure filesystem sync
        await new Promise((resolve) => setTimeout(resolve, 100));
        console.log("[Hook] initialize - filesystem sync delay completed");
      }
      console.log("[Hook] initialize - creating and populating database");
      const { dbDir, validKits } = await createAndPopulateDb(state.targetPath);
      console.log("[Hook] initialize - database creation completed");

      // Run scanning operations as the final step
      console.log("[Hook] initialize - starting scanning operations");
      await runScanning(state.targetPath, dbDir, validKits);
      console.log("[Hook] initialize - scanning operations completed");

      console.log("[Hook] initialize completed successfully");
      return { success: true };
    } catch (e: any) {
      console.error("[Hook] initialize error:", e);
      setError(normalizeErrorMessage(e.message || "Unknown error"));
      if (state.source === "sdcard") {
        setWizardState({ source: null });
      }
      return { success: false, error: e.message || "Unknown error" };
    } finally {
      setIsInitializing(false);
      setProgress(null);
    }
  }, [
    state,
    api,
    validateAndCopySdCardKits,
    extractSquarpArchive,
    createAndPopulateDb,
    runScanning,
    setIsInitializing,
    setError,
    setWizardState,
    setLocalStorePath,
  ]);

  // --- Source selection handler ---
  const handleSourceSelect = useCallback(
    async (value: string) => {
      // For SD card, use config value if available, otherwise prompt for folder
      if (value === "sdcard") {
        let folder = config.sdCardPath; // Check config first (used in E2E tests)

        if (!folder && api.selectLocalStorePath) {
          // Fall back to native picker if no config value
          folder = await api.selectLocalStorePath();
        }

        if (folder) {
          setState((s) => ({
            ...s,
            source: "sdcard",
            sdCardSourcePath: folder,
            kitFolderValidationError: undefined,
            targetPath: "",
          }));
        }
        // If no folder available (neither config nor picked), do not advance
        return;
      }
      // For squarp/blank, set source and clear targetPath, but do not advance to step 2 until user picks target
      setState((s) => ({
        ...s,
        source: value as LocalStoreSource,
        kitFolderValidationError: undefined,
        targetPath: "",
        sdCardSourcePath: undefined,
      }));
    },
    [api],
  );

  // --- Derived UI helpers ---
  const isSdCardSource = state.source === "sdcard";
  const errorMessage = state.error || state.kitFolderValidationError || null;
  const canInitialize = Boolean(
    state.targetPath &&
      state.source &&
      (!isSdCardSource ||
        (state.sdCardSourcePath && !state.kitFolderValidationError)) &&
      !state.isInitializing,
  );

  return {
    state,
    defaultPath,
    progress,
    setTargetPath,
    setSource,
    setSdCardMounted,
    setError,
    setIsInitializing,
    setSdCardPath,
    setSourceConfirmed,
    initialize,
    validateSdCardFolder,
    handleSourceSelect,
    errorMessage,
    canInitialize,
    isSdCardSource,
  };
}

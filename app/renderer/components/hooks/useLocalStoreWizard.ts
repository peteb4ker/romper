import type { ElectronAPI } from "../../electron.d";
import { useCallback, useEffect, useRef, useState } from "react";

import { groupSamplesByVoice } from "../../../../shared/kitUtilsShared";
import { createRomperDb, insertKit, insertSample } from "../utils/romperDb";

export type LocalStoreSource = "sdcard" | "squarp" | "blank";

export interface LocalStoreWizardState {
  targetPath: string;
  source: LocalStoreSource | null;
  sdCardMounted: boolean;
  isInitializing: boolean;
  error: string | null;
  sdCardPath?: string;
  kitFolderValidationError?: string | null;
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
export function useLocalStoreWizard(onProgress?: (p: ProgressEvent) => void) {
  const api = useElectronAPI();
  const [state, setState] = useState<LocalStoreWizardState>({
    targetPath: "",
    source: null,
    sdCardMounted: false,
    isInitializing: false,
    error: null,
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
    (sdCardPath: string) =>
      setState((s) => ({
        ...s,
        sdCardPath,
        kitFolderValidationError: undefined,
      })),
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
  function reportStepProgress({
    items,
    phase,
    onStep,
  }: {
    items: string[];
    phase: string;
    onStep: (item: string, idx: number) => Promise<void>;
  }) {
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
  }

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
      sdCardPath: undefined,
      kitFolderValidationError: undefined,
      error: null,
      isInitializing: false,
      sdCardMounted: false,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Kit folder validation ---
  const validateSdCardFolder = useCallback(
    async (sdCardPath: string) => {
      if (!sdCardPath) return null;
      if (!api.listFilesInRoot) return "Cannot access filesystem.";
      const files = await api.listFilesInRoot(sdCardPath);
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
    async (sdCardPath: string, targetPath: string) => {
      if (!sdCardPath) throw new Error();
      const validationError = await validateSdCardFolder(sdCardPath);
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
      const files = await api.listFilesInRoot(sdCardPath);
      const kitFolders = getKitFolders(files);
      await reportStepProgress({
        items: kitFolders,
        phase: "Copying kits...",
        onStep: async (kit) => {
          if (!api.copyDir) throw new Error("Missing Electron API");
          await api.copyDir(`${sdCardPath}/${kit}`, `${targetPath}/${kit}`);
        },
      });
    },
    [api, validateSdCardFolder],
  );

  const extractSquarpArchive = useCallback(
    async (targetPath: string) => {
      const url = "https://data.squarp.net/RampleSamplesV1-2.zip";
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
      await reportStepProgress({
        items: validKits,
        phase: "Writing to database",
        onStep: async (kitName) => {
          const kitPath = `${targetPath}/${kitName}`;
          if (!api.listFilesInRoot)
            throw new Error("listFilesInRoot is not available");
          const files = await api.listFilesInRoot(kitPath);
          const wavFiles = files.filter((f: string) => /\.wav$/i.test(f));
          const kitId = await insertKit(dbDir, {
            name: kitName,
            plan_enabled: false,
          });
          const voices = groupSamplesByVoice(wavFiles);
          for (const voiceNum of Object.keys(voices)) {
            voices[Number(voiceNum)]?.forEach?.(
              (filename: string, idx: number) => {
                insertSample(dbDir, {
                  kit_id: kitId,
                  filename,
                  slot_number: idx + 1,
                  is_stereo: false,
                });
              },
            );
          }
        },
      });
    },
    [api, reportProgress],
  );

  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    setProgress(null);
    try {
      if (!state.targetPath) throw new Error("No target path specified");
      if (!state.source) throw new Error("No source selected");
      if (api.ensureDir) await api.ensureDir(state.targetPath);
      if (state.source === "sdcard") {
        if (!state.sdCardPath) throw new Error("No SD card path selected");
        await validateAndCopySdCardKits(state.sdCardPath, state.targetPath);
      }
      if (state.source === "squarp") {
        await extractSquarpArchive(state.targetPath);
      }
      await createAndPopulateDb(state.targetPath);
      if (api.setSetting)
        await api.setSetting("localStorePath", state.targetPath);
    } catch (e: any) {
      setError(normalizeErrorMessage(e.message || "Unknown error"));
      if (state.source === "sdcard") {
        setWizardState({ source: null });
      }
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
    setIsInitializing,
    setError,
  ]);

  // --- Source selection handler ---
  const handleSourceSelect = useCallback(
    async (value: string) => {
      // For SD card, prompt for folder and only set source/step if folder is picked
      if (value === "sdcard" && api.selectLocalStorePath) {
        const folder = await api.selectLocalStorePath();
        if (folder) {
          setState((s) => ({
            ...s,
            source: "sdcard",
            sdCardPath: folder,
            kitFolderValidationError: undefined,
            targetPath: "",
          }));
        }
        // If no folder picked, do not advance
        return;
      }
      // For squarp/blank, set source and clear targetPath, but do not advance to step 2 until user picks target
      setState((s) => ({
        ...s,
        source: value as LocalStoreSource,
        kitFolderValidationError: undefined,
        targetPath: "",
        sdCardPath: undefined,
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
        (state.sdCardPath && !state.kitFolderValidationError)) &&
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
    initialize,
    validateSdCardFolder,
    handleSourceSelect,
    errorMessage,
    canInitialize,
    isSdCardSource,
  };
}

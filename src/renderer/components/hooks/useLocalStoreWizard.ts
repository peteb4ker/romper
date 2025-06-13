import { useCallback, useEffect, useState } from "react";
import { createRomperDb } from "../utils/romperDb";

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

export function getDefaultRomperPath(): string {
  // Use Electron preload bridge to get homedir from main process
  if (
    typeof window !== "undefined" &&
    window.electronAPI &&
    typeof window.electronAPI.getUserHomeDir === "function"
  ) {
    // NOTE: getUserHomeDir is now async, so this function must be async too
    // For backward compatibility, return empty string and require async usage
    return "";
  }
  // Fallback for browser: empty string
  return "";
}

export async function getDefaultRomperPathAsync(): Promise<string> {
  if (
    typeof window !== "undefined" &&
    window.electronAPI &&
    typeof window.electronAPI.getUserHomeDir === "function"
  ) {
    const homeDir = await window.electronAPI.getUserHomeDir();
    if (typeof homeDir === "string" && homeDir.length > 0) {
      return homeDir + "/Documents/romper";
    }
  }
  return "";
}

// Helper: get kit folders from a list of filenames
function getKitFolders(files: string[]): string[] {
  const kitRegex = /^[A-Z].*?(?:[1-9]?\d)$/;
  return files.filter((f) => kitRegex.test(f));
}

// Helper: create Romper DB in .romperdb folder
async function createRomperDbHelper(targetPath: string) {
  if (!window.electronAPI?.ensureDir) throw new Error("Cannot access filesystem");
  const dbDir = `${targetPath}/.romperdb`;
  await window.electronAPI.ensureDir(dbDir);
  await createRomperDb(dbDir);
  return dbDir;
}

export function useLocalStoreWizard() {
  const [state, setState] = useState<LocalStoreWizardState>({
    targetPath: "",
    source: null,
    sdCardMounted: false,
    isInitializing: false,
    error: null,
  });
  const [defaultPath, setDefaultPath] = useState("");
  const [progress, setProgress] = useState<{
    phase: string;
    percent?: number;
    file?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const path = await getDefaultRomperPathAsync();
      setDefaultPath(path);
      setState((s) => ({ ...s, targetPath: path }));
    })();
  }, []);

  const setTargetPath = useCallback((targetPath: string) => {
    setState((s) => ({ ...s, targetPath }));
  }, []);

  const setSource = useCallback((source: LocalStoreSource) => {
    setState((s) => ({ ...s, source }));
  }, []);

  const setSdCardMounted = useCallback((mounted: boolean) => {
    setState((s) => ({ ...s, sdCardMounted: mounted }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error }));
  }, []);

  const setIsInitializing = useCallback((isInitializing: boolean) => {
    setState((s) => ({ ...s, isInitializing }));
  }, []);

  const setSdCardPath = useCallback((sdCardPath: string) => {
    setState((s) => ({ ...s, sdCardPath }));
  }, []);

  // Validate SD card folder for kit subfolders
  const validateSdCardFolder = useCallback(async (sdCardPath: string) => {
    if (!sdCardPath) return null; // Don't show error if nothing picked, UI should handle this
    if (!window.electronAPI?.listFilesInRoot) return "Cannot access filesystem.";
    const files = await window.electronAPI.listFilesInRoot(sdCardPath);
    const kitFolders = getKitFolders(files);
    if (kitFolders.length === 0) {
      return "No valid kit folders found. Please choose a folder with kit subfolders (e.g. A0, B12, etc).";
    }
    return null;
  }, []);

  // DRY: Single handler for source selection, including SD card logic
  const handleSourceSelect = useCallback((value: string) => {
    if (value === "sdcard") {
      setSource("sdcard");
      setSdCardPath(""); // Always clear to force folder picker
    } else {
      setSource(value as any);
    }
  }, [setSource, setSdCardPath]);

  // DRY: Single error/warning display
  const errorMessage = state.error || state.kitFolderValidationError;

  const isSdCardSource = state.source === "sdcard";
  const canInitialize =
    !!state.targetPath &&
    !!state.source &&
    (!isSdCardSource || (!!state.sdCardPath && !state.kitFolderValidationError));

  // Placeholder for actual initialization logic
  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    setProgress(null);
    try {
      if (!state.targetPath) throw new Error("No target path specified");
      if (!state.source) throw new Error("No source selected");
      if (
        typeof window !== "undefined" &&
        window.electronAPI &&
        typeof window.electronAPI.ensureDir === "function"
      ) {
        await window.electronAPI.ensureDir(state.targetPath);
      }
      if (state.source === "sdcard") {
        if (!state.sdCardPath) throw new Error(); // Don't show error, UI should handle this
        const validationError = await validateSdCardFolder(state.sdCardPath);
        if (validationError) {
          setState((s) => ({ ...s, kitFolderValidationError: validationError, source: null }));
          throw new Error(validationError);
        } else {
          setState((s) => ({ ...s, kitFolderValidationError: undefined }));
        }
        // Copy all valid kit folders to local store with progress
        const files = await window.electronAPI.listFilesInRoot(state.sdCardPath);
        const kitFolders = getKitFolders(files);
        for (let i = 0; i < kitFolders.length; i++) {
          setProgress({
            phase: `Copying kits...`,
            percent: Math.round((i / kitFolders.length) * 100),
            file: kitFolders[i],
          });
          await window.electronAPI.copyDir(
            `${state.sdCardPath}/${kitFolders[i]}`,
            `${state.targetPath}/${kitFolders[i]}`,
          );
        }
        setProgress({
          phase: `Copying kits...`,
          percent: 100,
        });
      }
      if (
        typeof window !== "undefined" &&
        window.electronAPI &&
        typeof window.electronAPI.getUserHomeDir === "function"
      ) {
        if (state.source === "blank") {
          // Done: no files copied
          setIsInitializing(false);
          setProgress(null);
          return;
        }
      }
      if (state.source === "squarp") {
        const url = "https://data.squarp.net/RampleSamplesV1-2.zip";
        const result = await window.electronAPI.downloadAndExtractArchive?.(
          url,
          state.targetPath,
          (p: any) => setProgress(p),
          (e: any) => {
            // Robust error handling, including premature close
            let msg = e?.message || String(e);
            if (msg.includes("premature close")) {
              msg =
                "Download failed: The connection was closed before completion. Please check your internet connection and try again.";
            }
            setError(msg);
          },
        );
        if (!result?.success)
          throw new Error(result?.error || "Failed to extract archive");
      }
      // TODO: SD card copy logic (future)
      // After local store is created, create .romperdb folder
      await createRomperDbHelper(state.targetPath);
    } catch (e: any) {
      let msg = e.message || "Unknown error";
      if (msg.includes("premature close")) {
        msg =
          "Download failed: The connection was closed before completion. Please check your internet connection and try again.";
      }
      setError(msg);
      // If SD card error, allow reselect by clearing source
      if (state.source === "sdcard") {
        setState((s) => ({ ...s, source: null }));
      }
    } finally {
      setIsInitializing(false);
      setProgress(null);
    }
  }, [
    setIsInitializing,
    setError,
    setProgress,
    state.targetPath,
    state.source,
    state.sdCardPath,
    validateSdCardFolder,
  ]);

  return {
    state,
    setTargetPath,
    setSource,
    setSdCardMounted,
    setError,
    setIsInitializing,
    setSdCardPath,
    validateSdCardFolder,
    initialize,
    defaultPath,
    progress,
    handleSourceSelect,
    errorMessage,
    canInitialize,
    isSdCardSource,
  };
}

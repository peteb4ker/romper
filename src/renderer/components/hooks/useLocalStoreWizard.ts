import { useState, useCallback, useEffect } from "react";

export type LocalStoreSource = "sdcard" | "squarp" | "blank";

export interface LocalStoreWizardState {
  targetPath: string;
  source: LocalStoreSource | null;
  sdCardMounted: boolean;
  isInitializing: boolean;
  error: string | null;
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

export function useLocalStoreWizard() {
  const [state, setState] = useState<LocalStoreWizardState>({
    targetPath: "",
    source: null,
    sdCardMounted: false,
    isInitializing: false,
    error: null,
  });
  const [defaultPath, setDefaultPath] = useState("");

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

  // Placeholder for actual initialization logic
  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    try {
      if (!state.targetPath) throw new Error("No target path specified");
      if (!state.source) throw new Error("No source selected");
      // Always create the target directory
      if (
        typeof window !== "undefined" &&
        window.electronAPI &&
        typeof window.electronAPI.getUserHomeDir === "function"
      ) {
        // Ensure directory exists (handled by main process for archive, but always call for blank)
        if (state.source === "blank") {
          await window.electronAPI.downloadAndExtractArchive?.("about:blank", state.targetPath); // NOP, just mkdir
        }
      }
      if (state.source === "squarp") {
        // Download and extract Squarp.net archive
        const url = "https://data.squarp.net/RampleSamplesV1-2.zip";
        const result = await window.electronAPI.downloadAndExtractArchive?.(url, state.targetPath);
        if (!result?.success) throw new Error(result?.error || "Failed to extract archive");
      }
      // TODO: SD card copy logic (future)
    } catch (e: any) {
      setError(e.message || "Unknown error");
    } finally {
      setIsInitializing(false);
    }
  }, [setIsInitializing, setError, state.targetPath, state.source]);

  return {
    state,
    setTargetPath,
    setSource,
    setSdCardMounted,
    setError,
    setIsInitializing,
    initialize,
    defaultPath,
  };
}

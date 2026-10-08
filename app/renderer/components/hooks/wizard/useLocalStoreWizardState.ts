import { useCallback, useEffect, useMemo, useState } from "react";

import type { ElectronAPI } from "../../../electron.d";

export type LocalStoreSource = "blank" | "sdcard" | "squarp";

export interface LocalStoreWizardState {
  error: null | string;
  isInitializing: boolean;
  kitFolderValidationError?: null | string;
  sdCardMounted: boolean;
  sdCardSourcePath?: string; // Renamed from localStorePath for clarity
  source: LocalStoreSource | null;
  sourceConfirmed?: boolean;
  targetPath: string;
}

export interface ProgressEvent {
  currentKit?: number;
  file?: string;
  kitName?: string;
  percent?: number;
  phase: string;
  totalKits?: number;
}

/**
 * A setup summary line for a pair setup linked automatically (#537 rule 2).
 * `message` names the kit.
 */
export interface StereoImportNotice {
  kitName: string;
  message: string;
  voiceNumber: number;
}

export interface TruncationWarning {
  kept: number;
  kitName: string;
  skipped: number;
  /** The files left out, in the order the scan met them (#518) */
  skippedFiles: string[];
  total: number;
  voiceNumber: number;
}

export interface UseLocalStoreWizardStateOptions {
  api: ElectronAPI;
}

/**
 * Hook for managing Local Store Wizard state
 * Extracted from useLocalStoreWizard to reduce complexity
 */
export function useLocalStoreWizardState({
  api,
}: UseLocalStoreWizardStateOptions) {
  // Each mount starts the wizard with no source or target chosen
  const [state, setState] = useState<LocalStoreWizardState>({
    error: null,
    isInitializing: false,
    sdCardMounted: false,
    source: null,
    sourceConfirmed: false,
    targetPath: "",
  });
  const [defaultPath, setDefaultPath] = useState("");
  const [progress, setProgress] = useState<null | ProgressEvent>(null);

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
    (error: null | string) => setState((s) => ({ ...s, error })),
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
        kitFolderValidationError: undefined,
        sdCardSourcePath,
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

  // Progress management
  const setProgressState = useCallback((newProgress: null | ProgressEvent) => {
    setProgress(newProgress);
  }, []);

  // --- Load default path on mount ---
  useEffect(() => {
    const loadDefaultPath = async () => {
      try {
        // Safely call getUserHomeDir without passing the whole API object
        if (api?.getUserHomeDir) {
          const homeDir = await api.getUserHomeDir();
          if (typeof homeDir === "string" && homeDir.length > 0) {
            setDefaultPath(homeDir + "/Documents/romper");
            return;
          }
        }
      } catch (error) {
        console.error("Failed to get home directory:", error);
      }

      // Fallback to empty string if API call fails
      setDefaultPath("");
    };

    void loadDefaultPath();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return useMemo(
    () => ({
      canInitialize,
      defaultPath,
      errorMessage,

      // Computed
      isSdCardSource,
      progress,
      setError,

      setIsInitializing,
      setProgress: setProgressState,
      setSdCardMounted,
      setSdCardPath,
      setSource,
      setSourceConfirmed,
      // Setters
      setTargetPath,
      setWizardState,
      // State
      state,
    }),
    [
      canInitialize,
      defaultPath,
      errorMessage,
      isSdCardSource,
      progress,
      setError,
      setIsInitializing,
      setProgressState,
      setSdCardMounted,
      setSdCardPath,
      setSource,
      setSourceConfirmed,
      setTargetPath,
      setWizardState,
      state,
    ],
  );
}

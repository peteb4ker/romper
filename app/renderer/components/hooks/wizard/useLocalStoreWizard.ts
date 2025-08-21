import { useCallback, useMemo, useRef } from "react";

import type { ElectronAPI } from "../../../electron.d";

import { config } from "../../../config";
import { useLocalStoreWizardFileOps } from "./useLocalStoreWizardFileOps";
import { useLocalStoreWizardScanning } from "./useLocalStoreWizardScanning";
import {
  type LocalStoreSource,
  type LocalStoreWizardState,
  type ProgressEvent,
  useLocalStoreWizardState,
} from "./useLocalStoreWizardState";

// Re-export types for convenience
export type { LocalStoreSource, LocalStoreWizardState, ProgressEvent };

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// --- Main Hook ---
export function useLocalStoreWizard(
  onProgress?: (p: ProgressEvent) => void,
  setLocalStorePath?: (path: string) => void,
) {
  const api = useElectronAPI();
  const progressCb = useRef(onProgress);
  progressCb.current = onProgress;

  // State management hook
  const stateHook = useLocalStoreWizardState({ api });
  const { defaultPath, progress, state } = stateHook;

  // --- Progress reporting ---
  const reportProgress = useCallback(
    (p: ProgressEvent) => {
      stateHook.setProgress(p);
      if (progressCb.current) progressCb.current(p);
    },
    [stateHook],
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
      onStep,
      phase,
    }: {
      items: string[];
      onStep: (item: string, idx: number) => Promise<void>;
      phase: string;
    }) => {
      // Sequentially process items for correct progress updates
      return (async () => {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          reportProgress({
            file: item,
            percent: Math.round(((idx + 1) / items.length) * 100),
            phase,
          });
          await onStep(item, idx);
        }
        if (items.length > 0) reportProgress({ percent: 100, phase });
      })();
    },
    [reportProgress],
  );

  // File operations hook
  const fileOpsHook = useLocalStoreWizardFileOps({
    api,
    reportProgress,
    reportStepProgress,
    setError: stateHook.setError,
    setWizardState: stateHook.setWizardState,
  });

  // Scanning operations hook
  const scanningHook = useLocalStoreWizardScanning({
    api,
    reportStepProgress,
  });

  // Helper function to set the local store path
  const setLocalStorePathHelper = useCallback(async () => {
    const isDev = process.env.NODE_ENV === "development";
    isDev &&
      console.debug(
        "[Hook] setLocalStorePath callback available:",
        !!setLocalStorePath,
      );
    isDev && console.debug("[Hook] state.targetPath:", state.targetPath);

    if (setLocalStorePath) {
      isDev &&
        console.debug(
          "[Hook] Calling setLocalStorePath with:",
          state.targetPath,
        );
      setLocalStorePath(state.targetPath);
      isDev && console.debug("[Hook] setLocalStorePath called successfully");
    } else if (api.setSetting) {
      isDev && console.debug("[Hook] Falling back to api.setSetting");
      await api.setSetting("localStorePath", state.targetPath);
      isDev && console.debug("[Hook] api.setSetting called successfully");
    } else {
      isDev &&
        console.debug("[Hook] No method available to set local store path!");
    }
  }, [state.targetPath, setLocalStorePath, api]);

  // Helper function to handle source-specific operations
  const processSource = useCallback(async () => {
    const isDev = process.env.NODE_ENV === "development";

    if (state.source === "sdcard") {
      if (!state.sdCardSourcePath) throw new Error("No SD card path selected");
      isDev && console.debug("[Hook] initialize - copying SD card kits");
      await fileOpsHook.validateAndCopySdCardKits(
        state.sdCardSourcePath,
        state.targetPath,
      );
    } else if (state.source === "squarp") {
      isDev && console.debug("[Hook] initialize - extracting Squarp archive");
      await fileOpsHook.extractSquarpArchive(state.targetPath);
      isDev &&
        console.debug(
          "[Hook] initialize - Squarp archive extraction completed",
        );
      // Add a small delay to ensure filesystem sync
      await new Promise((resolve) => setTimeout(resolve, 100));
      isDev &&
        console.debug("[Hook] initialize - filesystem sync delay completed");
    }
  }, [state.source, state.sdCardSourcePath, state.targetPath, fileOpsHook]);

  const initialize = useCallback(async () => {
    const isDev = process.env.NODE_ENV === "development";
    isDev && console.debug("[Hook] initialize starting with state:", state);
    stateHook.setIsInitializing(true);
    stateHook.setError(null);
    stateHook.setProgress(null);

    try {
      if (!state.targetPath) throw new Error("No target path specified");
      if (!state.source) throw new Error("No source selected");
      if (api.ensureDir) await api.ensureDir(state.targetPath);

      // Process source-specific operations
      await processSource();

      // Create and populate database
      isDev &&
        console.debug("[Hook] initialize - creating and populating database");
      const { dbDir, validKits } = await fileOpsHook.createAndPopulateDb(
        state.targetPath,
      );
      isDev && console.debug("[Hook] initialize - database creation completed");

      // Run scanning operations as the final step
      isDev &&
        console.debug("[Hook] initialize - starting scanning operations");
      await scanningHook.runScanning(state.targetPath, dbDir, validKits);
      isDev &&
        console.debug("[Hook] initialize - scanning operations completed");

      // Set the local store path only after everything is ready
      await setLocalStorePathHelper();

      isDev && console.debug("[Hook] initialize completed successfully");
      return { success: true };
    } catch (e: unknown) {
      console.error("[Hook] initialize error:", e);
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      stateHook.setError(normalizeErrorMessage(errorMessage));
      if (state.source === "sdcard") {
        stateHook.setWizardState({ source: null });
      }
      return { error: errorMessage, success: false };
    } finally {
      stateHook.setIsInitializing(false);
      stateHook.setProgress(null);
    }
  }, [
    state,
    api,
    fileOpsHook,
    scanningHook,
    stateHook,
    setLocalStorePathHelper,
    processSource,
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
          stateHook.setWizardState({
            kitFolderValidationError: undefined,
            sdCardSourcePath: folder,
            source: "sdcard",
            targetPath: "",
          });
        }
        // If no folder available (neither config nor picked), do not advance
        return;
      }
      // For squarp/blank, set source and clear targetPath, but do not advance to step 2 until user picks target
      stateHook.setWizardState({
        kitFolderValidationError: undefined,
        sdCardSourcePath: undefined,
        source: value as LocalStoreSource,
        targetPath: "",
      });
    },
    [api, stateHook],
  );

  return useMemo(
    () => ({
      canInitialize: stateHook.canInitialize,
      defaultPath,
      errorMessage: stateHook.errorMessage,
      handleSourceSelect,
      initialize,
      isSdCardSource: stateHook.isSdCardSource,
      progress,
      setError: stateHook.setError,
      setIsInitializing: stateHook.setIsInitializing,
      setSdCardMounted: stateHook.setSdCardMounted,
      setSdCardPath: stateHook.setSdCardPath,
      setSource: stateHook.setSource,
      setSourceConfirmed: stateHook.setSourceConfirmed,
      setTargetPath: stateHook.setTargetPath,
      state,
      validateSdCardFolder: fileOpsHook.validateSdCardFolder,
    }),
    [
      stateHook.canInitialize,
      defaultPath,
      stateHook.errorMessage,
      handleSourceSelect,
      initialize,
      stateHook.isSdCardSource,
      progress,
      stateHook.setError,
      stateHook.setIsInitializing,
      stateHook.setSdCardMounted,
      stateHook.setSdCardPath,
      stateHook.setSource,
      stateHook.setSourceConfirmed,
      stateHook.setTargetPath,
      state,
      fileOpsHook.validateSdCardFolder,
    ],
  );
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

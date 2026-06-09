import { useCallback, useMemo } from "react";

import type { ElectronAPI } from "../../../electron.d";

import { config } from "../../../config";
import { createLogger } from "../../../utils/logger";
import { useLocalStoreWizardFileOps } from "./useLocalStoreWizardFileOps";
import { useLocalStoreWizardScanning } from "./useLocalStoreWizardScanning";
import {
  type LocalStoreSource,
  type ProgressEvent,
  useLocalStoreWizardState,
} from "./useLocalStoreWizardState";
import { useWizardProgress } from "./useWizardProgress";
import {
  getElectronAPI,
  normalizeErrorMessage,
  runPreChecks,
} from "./wizardInitUtils";

// Re-export types for convenience
export type { LocalStoreSource, ProgressEvent };
export type { LocalStoreWizardState } from "./useLocalStoreWizardState";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const log = createLogger("LocalStoreWizard");

// --- Main Hook ---
export function useLocalStoreWizard(
  onProgress?: (p: ProgressEvent) => void,
  setLocalStorePath?: (path: string) => void,
) {
  const api = useElectronAPI();

  // State management hook
  const stateHook = useLocalStoreWizardState({ api });
  const { defaultPath, progress, state } = stateHook;

  // Progress reporting (wizard state + optional external callback)
  const { reportProgress, reportStepProgress } = useWizardProgress(
    stateHook.setProgress,
    onProgress,
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
    log.debug(
      `setLocalStorePath callback available: ${!!setLocalStorePath}, targetPath: ${state.targetPath}`,
    );

    if (setLocalStorePath) {
      setLocalStorePath(state.targetPath);
    } else if (api.setSetting) {
      log.debug("Falling back to api.setSetting");
      await api.setSetting("localStorePath", state.targetPath);
    } else {
      log.debug("No method available to set local store path!");
    }
  }, [state.targetPath, setLocalStorePath, api]);

  // Helper function to handle source-specific operations
  const processSource = useCallback(async () => {
    if (state.source === "sdcard") {
      if (!state.sdCardSourcePath) throw new Error("No SD card path selected");
      log.debug("initialize - copying SD card kits");
      await fileOpsHook.validateAndCopySdCardKits(
        state.sdCardSourcePath,
        state.targetPath,
      );
    } else if (state.source === "squarp") {
      log.debug("initialize - extracting Squarp archive");
      await fileOpsHook.extractSquarpArchive(state.targetPath);
      log.debug("initialize - Squarp archive extraction completed");
      // Add a small delay to ensure filesystem sync
      await new Promise((resolve) => setTimeout(resolve, 100));
      log.debug("initialize - filesystem sync delay completed");
    }
  }, [state.source, state.sdCardSourcePath, state.targetPath, fileOpsHook]);

  const initialize = useCallback(async () => {
    log.debug("initialize starting");
    stateHook.setIsInitializing(true);
    stateHook.setError(null);
    stateHook.setProgress(null);

    try {
      if (!state.targetPath) throw new Error("No target path specified");
      if (!state.source) throw new Error("No source selected");

      await runPreChecks(api, state.targetPath, state.source);

      if (api.ensureDir) await api.ensureDir(state.targetPath);

      // Process source-specific operations
      await processSource();

      // Create and populate database
      log.debug("initialize - creating and populating database");
      const { dbDir, truncationWarnings, validKits } =
        await fileOpsHook.createAndPopulateDb(state.targetPath);
      log.debug("initialize - database creation completed");
      if (truncationWarnings && truncationWarnings.length > 0) {
        stateHook.setWizardState({ truncationWarnings });
      }

      // Run scanning operations as the final step
      log.debug("initialize - starting scanning operations");
      await scanningHook.runScanning(state.targetPath, dbDir, validKits);
      log.debug("initialize - scanning operations completed");

      // Set the local store path only after everything is ready
      await setLocalStorePathHelper();

      log.debug("initialize completed successfully");
      return { success: true };
    } catch (e: unknown) {
      log.error("initialize error:", e);
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      stateHook.setError(normalizeErrorMessage(errorMessage));

      // Clean up partial database on failure so retry starts fresh
      if (state.targetPath && api.cleanupPartialInit) {
        try {
          await api.cleanupPartialInit(state.targetPath);
          log.debug("Cleaned up partial .romperdb after failed initialization");
        } catch {
          // Cleanup is best-effort; don't mask the original error
        }
      }

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

function useElectronAPI(): ElectronAPI {
  return getElectronAPI();
}

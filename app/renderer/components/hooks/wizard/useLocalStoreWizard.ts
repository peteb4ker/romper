import { useCallback, useMemo, useRef } from "react";

import type { ElectronAPI } from "../../../electron.d";

import { config } from "../../../config";
import { createLogger } from "../../../utils/logger";
import { SetupCancelledError } from "./setupCancelled";
import { useLocalStoreWizardFileOps } from "./useLocalStoreWizardFileOps";
import {
  type LocalStoreSource,
  type ProgressEvent,
  useLocalStoreWizardState,
} from "./useLocalStoreWizardState";
import {
  type StepProgressParams,
  useWizardProgress,
} from "./useWizardProgress";
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
  setLocalStorePath?: (path: string) => Promise<boolean> | void,
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

  // Cancel (RE-66): main aborts its download or extraction, and the wizard
  // stops before its next step or kit
  const cancelRequested = useRef(false);
  const throwIfCancelled = useCallback(() => {
    if (cancelRequested.current) throw new SetupCancelledError();
  }, []);
  const cancellableStepProgress = useCallback(
    (params: StepProgressParams) =>
      reportStepProgress({
        ...params,
        onStep: async (item, idx) => {
          throwIfCancelled();
          await params.onStep(item, idx);
        },
      }),
    [reportStepProgress, throwIfCancelled],
  );
  const cancelSetup = useCallback(async () => {
    cancelRequested.current = true;
    await api.cancelSetup?.();
  }, [api]);

  // File operations hook
  const fileOpsHook = useLocalStoreWizardFileOps({
    api,
    reportProgress,
    reportStepProgress: cancellableStepProgress,
    setError: stateHook.setError,
    setWizardState: stateHook.setWizardState,
    throwIfCancelled,
  });

  // Helper function to set the local store path
  const setLocalStorePathHelper = useCallback(async () => {
    log.debug(
      `setLocalStorePath callback available: ${!!setLocalStorePath}, targetPath: ${state.targetPath}`,
    );

    if (setLocalStorePath) {
      await setLocalStorePath(state.targetPath);
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
    cancelRequested.current = false;
    // Only a run that got as far as writing into the target has anything to
    // clean up; main removes only what this setup created
    let writingStarted = false;

    try {
      if (!state.targetPath) throw new Error("No target path specified");
      if (!state.source) throw new Error("No source selected");

      await runPreChecks(api, state.targetPath, state.source);
      throwIfCancelled();

      if (api.ensureDir) await api.ensureDir(state.targetPath);

      // Process source-specific operations
      writingStarted = true;
      await processSource();
      throwIfCancelled();

      // Create the database and import the kits (main names the voices)
      log.debug("initialize - creating and populating database");
      const { stereoNotices, truncationWarnings } =
        await fileOpsHook.createAndPopulateDb(state.targetPath);
      log.debug("initialize - database creation completed");
      throwIfCancelled();

      // Set the local store path only after everything is ready
      await setLocalStorePathHelper();

      log.debug("initialize completed successfully");
      // Returned, not stored: the caller decides what to show from this
      // run's result, never from state captured before it ran (RE-42)
      return {
        stereoNotices: stereoNotices ?? [],
        success: true,
        truncationWarnings: truncationWarnings ?? [],
      };
    } catch (e: unknown) {
      const cancelled =
        e instanceof SetupCancelledError || cancelRequested.current;
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      if (cancelled) {
        log.debug("initialize cancelled");
      } else {
        log.error("initialize error:", e);
        stateHook.setError(normalizeErrorMessage(errorMessage));
      }

      // Remove what this run wrote (kit folders it extracted or copied) and
      // move its database aside, so a retry starts fresh. Main only acts on
      // what this setup created (RE-10, RE-66).
      if (writingStarted && state.targetPath && api.cleanupPartialInit) {
        try {
          const cleanup = await api.cleanupPartialInit(state.targetPath);
          if (cleanup.removed) {
            log.debug("Cleaned up the partial local store");
          } else {
            log.debug("Partial local store not cleaned up:", cleanup.error);
          }
        } catch {
          // Cleanup is best-effort; don't mask the original error
        }
      }

      if (state.source === "sdcard") {
        stateHook.setWizardState({ source: null });
      }
      return cancelled
        ? { cancelled: true, success: false }
        : { error: errorMessage, success: false };
    } finally {
      stateHook.setIsInitializing(false);
      stateHook.setProgress(null);
    }
  }, [
    state,
    api,
    fileOpsHook,
    stateHook,
    setLocalStorePathHelper,
    processSource,
    throwIfCancelled,
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
      cancelSetup,
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
      cancelSetup,
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

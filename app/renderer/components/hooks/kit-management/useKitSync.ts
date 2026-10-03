import { useCallback, useEffect, useState } from "react";

import type { SyncChangeSummary } from "../../dialogs/SyncUpdateDialog.types";

import { createLogger } from "../../../utils/logger";
import { useSyncUpdate } from "../shared/useSyncUpdate";

const log = createLogger("KitSync");

export interface UseKitSyncOptions {
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onRefreshKits?: () => Promise<void>;
}

/**
 * Hook for managing kit sync functionality including dialog state and operations
 * Extracted from KitBrowser to reduce component complexity
 */
export function useKitSync({ onMessage, onRefreshKits }: UseKitSyncOptions) {
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [currentSyncKit, setCurrentSyncKit] = useState<null | string>(null);
  const [currentChangeSummary, setCurrentChangeSummary] =
    useState<null | SyncChangeSummary>(null);
  const [sdCardPath, setSdCardPath] = useState<null | string>(null);

  // Get SD card path from settings (includes environment overrides)
  useEffect(() => {
    const getSettings = async () => {
      if (globalThis.electronAPI?.readSettings) {
        try {
          const settings = await globalThis.electronAPI.readSettings();
          log.debug("Settings loaded:", settings);
          if (settings?.sdCardPath) {
            log.debug(
              "Setting SD card path from settings:",
              settings.sdCardPath,
            );
            setSdCardPath(settings.sdCardPath);
          }
        } catch (error) {
          log.error("Failed to read settings:", error);
        }
      }
    };
    void getSettings();
  }, []);

  // Sync functionality from useSyncUpdate hook
  const {
    cancelSync,
    clearError: clearSyncError,
    error: syncError,
    generateChangeSummary,
    isLoading: isSyncLoading,
    startSync,
    syncProgressStore,
  } = useSyncUpdate();

  // Handler to initiate sync to SD card
  const handleSyncToSdCard = useCallback(() => {
    try {
      // Sync all kits to SD card
      setCurrentSyncKit("All Kits");

      // Don't generate change summary here - it will be generated when SD card is selected
      setCurrentChangeSummary(null);
      setShowSyncDialog(true);
    } catch (error) {
      log.error("Error initiating sync:", error);
      if (onMessage) {
        onMessage(
          `Failed to initiate sync: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error",
        );
      }
    }
  }, [onMessage]);

  // Handler to confirm sync operation
  const handleConfirmSync = useCallback(
    async (options: {
      sdCardPath: null | string;
      skipInvalidFiles: boolean;
    }) => {
      if (!options.sdCardPath) return;

      const success = await startSync({
        sdCardPath: options.sdCardPath,
        skipInvalidFiles: options.skipInvalidFiles,
      });
      if (success) {
        // Keep the dialog open so the user sees the "Write Complete" state.
        // They will close it manually via the Close button.

        // Refresh kit data to ensure UI shows updated unsaved states
        if (onRefreshKits) {
          log.debug("Refreshing kit data after successful sync");
          try {
            await onRefreshKits();
          } catch (error) {
            log.error("Failed to refresh kit data:", error);
          }
        }
      } else {
        // Not syncError: this render's value is from before the write, so
        // it's never the reason (RE-40). The write panel shows the reason.
        onMessage?.(
          "The write to the SD card didn't finish. The write panel says why; fix that, then write again.",
          "error",
        );
      }
    },
    [startSync, onMessage, onRefreshKits],
  );

  // Handler to close sync dialog
  const handleCloseSyncDialog = useCallback(() => {
    setShowSyncDialog(false);
    setCurrentSyncKit(null);
    setCurrentChangeSummary(null);
    clearSyncError();
  }, [clearSyncError]);

  // Handler for SD card path change that persists to settings
  const handleSdCardPathChange = useCallback(
    async (path: null | string) => {
      setSdCardPath(path);

      // Save to settings if electronAPI is available
      if (globalThis.electronAPI?.writeSettings) {
        try {
          await globalThis.electronAPI.writeSettings("sdCardPath", path);
          log.debug("SD card path saved to settings:", path);
        } catch (error) {
          log.error("Failed to save SD card path to settings:", error);
          if (onMessage) {
            onMessage("Failed to save SD card path", "warning");
          }
        }
      }
    },
    [onMessage],
  );

  return {
    cancelSync,
    currentChangeSummary,
    currentSyncKit,
    generateChangeSummary,
    handleCloseSyncDialog,
    handleConfirmSync,
    // Handlers
    handleSyncToSdCard,

    isSyncLoading,
    onSdCardPathChange: handleSdCardPathChange,
    sdCardPath,
    // State
    showSyncDialog,
    syncError,
    syncProgressStore,
  };
}

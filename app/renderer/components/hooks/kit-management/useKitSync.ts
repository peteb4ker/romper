import { useCallback, useEffect, useState } from "react";

import { useSyncUpdate } from "../shared/useSyncUpdate";

export interface UseKitSyncOptions {
  onMessage?: (text: string, type?: string, duration?: number) => void;
}

/**
 * Hook for managing kit sync functionality including dialog state and operations
 * Extracted from KitBrowser to reduce component complexity
 */
export function useKitSync({ onMessage }: UseKitSyncOptions) {
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [currentSyncKit, setCurrentSyncKit] = useState<null | string>(null);
  const [currentChangeSummary, setCurrentChangeSummary] = useState<any>(null);
  const [sdCardPath, setSdCardPath] = useState<null | string>(null);

  // Get SD card path from settings (includes environment overrides)
  useEffect(() => {
    const getSettings = async () => {
      if (window.electronAPI?.readSettings) {
        try {
          const settings = await window.electronAPI.readSettings();
          console.log("Settings loaded:", settings);
          if (settings && settings.sdCardPath) {
            console.log(
              "Setting SD card path from settings:",
              settings.sdCardPath,
            );
            setSdCardPath(settings.sdCardPath);
          }
        } catch (error) {
          console.error("Failed to read settings:", error);
        }
      }
    };
    getSettings();
  }, []);

  // Sync functionality from useSyncUpdate hook
  const {
    clearError: clearSyncError,
    error: syncError,
    generateChangeSummary,
    isLoading: isSyncLoading,
    startSync,
    syncProgress,
  } = useSyncUpdate();

  // Handler to initiate sync to SD card
  const handleSyncToSdCard = useCallback(async () => {
    try {
      // Sync all kits to SD card
      setCurrentSyncKit("All Kits");

      // Don't generate change summary here - it will be generated when SD card is selected
      setCurrentChangeSummary(null);
      setShowSyncDialog(true);
    } catch (error) {
      console.error("Error initiating sync:", error);
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
    async (options: { sdCardPath: null | string; wipeSdCard: boolean }) => {
      if (!options.sdCardPath) return;

      const success = await startSync({
        sdCardPath: options.sdCardPath,
        wipeSdCard: options.wipeSdCard,
      });
      if (success) {
        setShowSyncDialog(false);
        setCurrentSyncKit(null);
        setCurrentChangeSummary(null);
        if (onMessage) {
          onMessage(
            `All kits synced successfully to ${options.sdCardPath}!`,
            "success",
            3000,
          );
        }
      } else if (onMessage && syncError) {
        onMessage(`Sync failed: ${syncError}`, "error");
      }
    },
    [startSync, onMessage, syncError],
  );

  // Handler to close sync dialog
  const handleCloseSyncDialog = useCallback(() => {
    setShowSyncDialog(false);
    setCurrentSyncKit(null);
    setCurrentChangeSummary(null);
    clearSyncError();
  }, [clearSyncError]);

  return {
    currentChangeSummary,
    currentSyncKit,
    generateChangeSummary,
    handleCloseSyncDialog,
    handleConfirmSync,
    // Handlers
    handleSyncToSdCard,

    isSyncLoading,
    onSdCardPathChange: setSdCardPath,
    sdCardPath,
    // State
    showSyncDialog,
    syncError,
    syncProgress,
  };
}

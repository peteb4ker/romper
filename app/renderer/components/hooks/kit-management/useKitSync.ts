import { useCallback, useState } from "react";

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

  // Sync functionality from useSyncUpdate hook
  const {
    clearError: clearSyncError,
    error: syncError,
    generateChangeSummary,
    isLoading: isSyncLoading,
    startSync,
  } = useSyncUpdate();

  // Handler to initiate sync to SD card
  const handleSyncToSdCard = useCallback(async () => {
    // Sync all kits to SD card
    setCurrentSyncKit("All Kits");

    // Generate change summary before showing dialog
    const changeSummary = await generateChangeSummary();
    if (!changeSummary) {
      if (onMessage && syncError) {
        onMessage(`Failed to analyze kits: ${syncError}`, "error");
      }
      return;
    }

    setCurrentChangeSummary(changeSummary);
    setShowSyncDialog(true);
  }, [generateChangeSummary, onMessage, syncError]);

  // Handler to confirm sync operation
  const handleConfirmSync = useCallback(async () => {
    if (!currentChangeSummary) return;

    const success = await startSync(currentChangeSummary);
    if (success) {
      setShowSyncDialog(false);
      setCurrentSyncKit(null);
      setCurrentChangeSummary(null);
      if (onMessage) {
        onMessage(`All kits synced successfully!`, "success", 3000);
      }
    } else if (onMessage && syncError) {
      onMessage(`Sync failed: ${syncError}`, "error");
    }
  }, [currentChangeSummary, startSync, onMessage, syncError]);

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
    handleCloseSyncDialog,
    handleConfirmSync,
    // Handlers
    handleSyncToSdCard,

    isSyncLoading,
    // State
    showSyncDialog,
    syncError,
  };
}

import { useCallback, useState } from "react";

export interface UseKitDialogsOptions {
  onMessage?: (text: string, type?: string, duration?: number) => void;
  setLocalStorePath?: (path: string) => void;
}

/**
 * Hook for managing various dialog states in KitBrowser
 * Extracted from KitBrowser to reduce component complexity
 */
export function useKitDialogs({
  onMessage,
  setLocalStorePath,
}: UseKitDialogsOptions) {
  // Local Store Wizard state
  const [showLocalStoreWizard, setShowLocalStoreWizard] = useState(false);

  // Validation dialog state
  const [showValidationDialog, setShowValidationDialog] = useState(false);

  // Handler to show local store wizard
  const handleShowLocalStoreWizard = useCallback(() => {
    setShowLocalStoreWizard(true);
  }, []);

  // Handler to close local store wizard
  const handleCloseLocalStoreWizard = useCallback(() => {
    setShowLocalStoreWizard(false);
  }, []);

  // Handler for successful local store setup
  const handleLocalStoreSuccess = useCallback(() => {
    setShowLocalStoreWizard(false);
    if (onMessage) {
      onMessage("Local store initialized successfully!", "success", 5000);
    }
  }, [onMessage]);

  // Handler to show validation dialog
  const handleShowValidationDialog = useCallback(() => {
    setShowValidationDialog(true);
  }, []);

  // Handler to close validation dialog
  const handleCloseValidationDialog = useCallback(() => {
    setShowValidationDialog(false);
  }, []);

  return {
    handleCloseLocalStoreWizard,
    handleCloseValidationDialog,

    handleLocalStoreSuccess,
    // Handlers
    handleShowLocalStoreWizard,
    handleShowValidationDialog,
    // Props for child components
    localStoreWizardProps: {
      onClose: handleCloseLocalStoreWizard,
      onSuccess: handleLocalStoreSuccess,
      setLocalStorePath: setLocalStorePath || (() => {}),
    },
    // State
    showLocalStoreWizard,

    showValidationDialog,
  };
}

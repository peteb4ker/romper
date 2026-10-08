import { useCallback, useState } from "react";

/**
 * Hook for the validation results dialog's state in KitBrowser
 * Extracted from KitBrowser to reduce component complexity
 */
export function useKitDialogs() {
  const [showValidationDialog, setShowValidationDialog] = useState(false);

  const handleShowValidationDialog = useCallback(() => {
    setShowValidationDialog(true);
  }, []);

  const handleCloseValidationDialog = useCallback(() => {
    setShowValidationDialog(false);
  }, []);

  return {
    handleCloseValidationDialog,
    handleShowValidationDialog,
    showValidationDialog,
  };
}

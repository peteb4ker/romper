import { useCallback, useState } from "react";

interface UseDialogStateReturn {
  closeChangeDirectory: () => void;
  closePreferences: () => void;

  closeWizard: () => void;
  openChangeDirectory: () => void;

  openPreferences: () => void;
  // Helper functions
  openWizard: () => void;

  setShowChangeDirectoryDialog: (show: boolean) => void;
  setShowPreferencesDialog: (show: boolean) => void;
  setShowWizard: (show: boolean) => void;
  // Change directory dialog
  showChangeDirectoryDialog: boolean;
  // Preferences dialog
  showPreferencesDialog: boolean;
  // Wizard dialog
  showWizard: boolean;
}

/**
 * Custom hook for managing dialog visibility states
 * Provides a centralized way to handle multiple dialogs in KitsView
 */
export function useDialogState(): UseDialogStateReturn {
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [showChangeDirectoryDialog, setShowChangeDirectoryDialog] =
    useState<boolean>(false);
  const [showPreferencesDialog, setShowPreferencesDialog] =
    useState<boolean>(false);

  // Helper functions for cleaner API
  const openWizard = useCallback(() => setShowWizard(true), []);
  const closeWizard = useCallback(() => setShowWizard(false), []);

  const openChangeDirectory = useCallback(
    () => setShowChangeDirectoryDialog(true),
    []
  );
  const closeChangeDirectory = useCallback(
    () => setShowChangeDirectoryDialog(false),
    []
  );

  const openPreferences = useCallback(() => setShowPreferencesDialog(true), []);
  const closePreferences = useCallback(
    () => setShowPreferencesDialog(false),
    []
  );

  return {
    closeChangeDirectory,
    closePreferences,
    closeWizard,
    openChangeDirectory,
    openPreferences,
    // Helper functions
    openWizard,

    setShowChangeDirectoryDialog,
    setShowPreferencesDialog,
    setShowWizard,
    showChangeDirectoryDialog,
    showPreferencesDialog,
    // State values
    showWizard,
  };
}

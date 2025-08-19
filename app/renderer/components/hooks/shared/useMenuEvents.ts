import { useEffect } from "react";

export interface MenuEventHandlers {
  onAbout?: () => void;
  onChangeLocalStoreDirectory?: () => void;
  onPreferences?: () => void;
  onRedo?: () => void;
  onScanAllKits?: () => void;
  onScanBanks?: () => void;
  onSetupLocalStore?: () => void;
  onUndo?: () => void;
  onValidateDatabase?: () => void;
}

/**
 * Hook to handle menu events sent from the main process
 */
export function useMenuEvents(handlers: MenuEventHandlers) {
  useEffect(() => {
    // Set up event listeners for menu events
    const handleScanAllKits = () => {
      if (handlers.onScanAllKits) {
        handlers.onScanAllKits();
      }
    };

    const handleScanBanks = () => {
      if (handlers.onScanBanks) {
        handlers.onScanBanks();
      }
    };

    const handleValidateDatabase = () => {
      if (handlers.onValidateDatabase) {
        handlers.onValidateDatabase();
      }
    };

    const handleSetupLocalStore = () => {
      if (handlers.onSetupLocalStore) {
        handlers.onSetupLocalStore();
      }
    };

    const handleChangeLocalStoreDirectory = () => {
      if (handlers.onChangeLocalStoreDirectory) {
        handlers.onChangeLocalStoreDirectory();
      }
    };

    const handlePreferences = () => {
      if (handlers.onPreferences) {
        handlers.onPreferences();
      }
    };

    const handleAbout = () => {
      if (handlers.onAbout) {
        handlers.onAbout();
      }
    };

    const handleUndo = () => {
      if (handlers.onUndo) {
        handlers.onUndo();
      }
    };

    const handleRedo = () => {
      if (handlers.onRedo) {
        handlers.onRedo();
      }
    };

    // Register electron event listeners
    if (window.electronAPI) {
      // Use electron's ipcRenderer.on equivalent through the preload script
      // We need to add these event listeners to the electron API
      window.addEventListener("menu-scan-all-kits", handleScanAllKits);
      window.addEventListener("menu-scan-banks", handleScanBanks);
      window.addEventListener("menu-validate-database", handleValidateDatabase);
      window.addEventListener("menu-setup-local-store", handleSetupLocalStore);
      window.addEventListener(
        "menu-change-local-store-directory",
        handleChangeLocalStoreDirectory
      );
      window.addEventListener("menu-preferences", handlePreferences);
      window.addEventListener("menu-about", handleAbout);
      window.addEventListener("menu-undo", handleUndo);
      window.addEventListener("menu-redo", handleRedo);
    }

    // Cleanup event listeners
    return () => {
      window.removeEventListener("menu-scan-all-kits", handleScanAllKits);
      window.removeEventListener("menu-scan-banks", handleScanBanks);
      window.removeEventListener(
        "menu-validate-database",
        handleValidateDatabase
      );
      window.removeEventListener(
        "menu-setup-local-store",
        handleSetupLocalStore
      );
      window.removeEventListener(
        "menu-change-local-store-directory",
        handleChangeLocalStoreDirectory
      );
      window.removeEventListener("menu-preferences", handlePreferences);
      window.removeEventListener("menu-about", handleAbout);
      window.removeEventListener("menu-undo", handleUndo);
      window.removeEventListener("menu-redo", handleRedo);
    };
  }, [handlers]);
}

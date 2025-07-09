import { useEffect } from "react";

export interface MenuEventHandlers {
  onScanAllKits?: () => void;
  onValidateDatabase?: () => void;
  onSetupLocalStore?: () => void;
  onAbout?: () => void;
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

    const handleAbout = () => {
      if (handlers.onAbout) {
        handlers.onAbout();
      }
    };

    // Register electron event listeners
    if (window.electronAPI) {
      // Use electron's ipcRenderer.on equivalent through the preload script
      // We need to add these event listeners to the electron API
      window.addEventListener("menu-scan-all-kits", handleScanAllKits);
      window.addEventListener("menu-validate-database", handleValidateDatabase);
      window.addEventListener("menu-setup-local-store", handleSetupLocalStore);
      window.addEventListener("menu-about", handleAbout);
    }

    // Cleanup event listeners
    return () => {
      window.removeEventListener("menu-scan-all-kits", handleScanAllKits);
      window.removeEventListener("menu-validate-database", handleValidateDatabase);
      window.removeEventListener("menu-setup-local-store", handleSetupLocalStore);
      window.removeEventListener("menu-about", handleAbout);
    };
  }, [handlers]);
}

import { useEffect } from "react";

export interface MenuEventHandlers {
  onAbout?: () => void;
  onChangeLocalStoreDirectory?: () => void;
  onPreferences?: () => void;
  onRedo?: () => void;
  onScanAll?: () => void;
  onUndo?: () => void;
}

/**
 * Hook to handle menu events sent from the main process
 */
export function useMenuEvents(handlers: MenuEventHandlers) {
  useEffect(() => {
    // Set up event listeners for menu events
    const handleScanAll = () => {
      if (handlers.onScanAll) {
        handlers.onScanAll();
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
    if (globalThis.electronAPI) {
      globalThis.addEventListener("menu-scan-all-kits", handleScanAll);
      globalThis.addEventListener(
        "menu-change-local-store-directory",
        handleChangeLocalStoreDirectory,
      );
      globalThis.addEventListener("menu-preferences", handlePreferences);
      globalThis.addEventListener("menu-about", handleAbout);
      globalThis.addEventListener("menu-undo", handleUndo);
      globalThis.addEventListener("menu-redo", handleRedo);
    }

    // Cleanup event listeners
    return () => {
      globalThis.removeEventListener("menu-scan-all-kits", handleScanAll);
      globalThis.removeEventListener(
        "menu-change-local-store-directory",
        handleChangeLocalStoreDirectory,
      );
      globalThis.removeEventListener("menu-preferences", handlePreferences);
      globalThis.removeEventListener("menu-about", handleAbout);
      globalThis.removeEventListener("menu-undo", handleUndo);
      globalThis.removeEventListener("menu-redo", handleRedo);
    };
  }, [handlers]);
}

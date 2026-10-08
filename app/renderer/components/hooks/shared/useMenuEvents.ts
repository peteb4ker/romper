import { useEffect } from "react";

import { useLatestRef } from "./useLatestRef";

export interface MenuEventHandlers {
  onAbout?: () => void;
  onChangeLocalStoreDirectory?: () => void;
  onPreferences?: () => void;
  onRedo?: () => void;
  onScanAll?: () => void;
  onUndo?: () => void;
}

// Each menu event and the handler it calls
const MENU_EVENTS: ReadonlyArray<[string, keyof MenuEventHandlers]> = [
  ["menu-scan-all-kits", "onScanAll"],
  ["menu-change-local-store-directory", "onChangeLocalStoreDirectory"],
  ["menu-preferences", "onPreferences"],
  ["menu-about", "onAbout"],
  ["menu-undo", "onUndo"],
  ["menu-redo", "onRedo"],
];

/**
 * Hook to handle menu events sent from the main process. The listeners call
 * the latest handlers, so they subscribe once, not on every render (#462).
 */
export function useMenuEvents(handlers: MenuEventHandlers) {
  const handlersRef = useLatestRef(handlers);

  useEffect(() => {
    // Register electron event listeners
    if (!globalThis.electronAPI) return;

    const listeners = MENU_EVENTS.map(([event, handler]) => {
      const listener = () => handlersRef.current[handler]?.();
      globalThis.addEventListener(event, listener);
      return [event, listener] as const;
    });

    // Cleanup event listeners
    return () => {
      for (const [event, listener] of listeners) {
        globalThis.removeEventListener(event, listener);
      }
    };
  }, [handlersRef]);
}

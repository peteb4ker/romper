import { useCallback, useEffect } from "react";

import { isBrowserFavoriteKey } from "../../../utils/keyboardShortcuts";

export interface UseKitKeyboardNavOptions {
  focusedKit: null | string;
  globalBankHotkeyHandler: (e: KeyboardEvent) => void;
  onToggleFavorite?: (kitName: string) => void;
}

/**
 * Hook for managing keyboard navigation and shortcuts in KitBrowser
 * Extracted from KitBrowser to reduce component complexity
 */
export function useKitKeyboardNav({
  focusedKit,
  globalBankHotkeyHandler,
  onToggleFavorite,
}: UseKitKeyboardNavOptions) {
  // Task 20.1.3: Favorite toggle keyboard shortcut handler
  const favoritesKeyboardHandler = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle hotkeys when typing in inputs
      const target = e.target as Element;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
        return;
      }

      // Shift+F stars the focused kit; plain "F" jumps to bank F (#504)
      if (isBrowserFavoriteKey(e) && focusedKit && onToggleFavorite) {
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite(focusedKit);
      }
    },
    [focusedKit, onToggleFavorite],
  );

  // Register global A-Z navigation for bank selection and kit focus
  useEffect(() => {
    globalThis.addEventListener("keydown", globalBankHotkeyHandler);
    globalThis.addEventListener("keydown", favoritesKeyboardHandler);

    return () => {
      globalThis.removeEventListener("keydown", globalBankHotkeyHandler);
      globalThis.removeEventListener("keydown", favoritesKeyboardHandler);
    };
  }, [globalBankHotkeyHandler, favoritesKeyboardHandler]);

  return {
    favoritesKeyboardHandler,
  };
}

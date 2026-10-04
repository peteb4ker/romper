import { useCallback, useEffect } from "react";

import { isFavoriteKey } from "../../../utils/keyboardShortcuts";
import { isModalDialogOpen } from "../../../utils/modalDialog";

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
  // The favorite key, for the focused kit
  const favoritesKeyboardHandler = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle hotkeys when typing in inputs
      const target = e.target as Element;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
        return;
      }
      // Keys pressed in a dialog are the dialog's (#500)
      if (isModalDialogOpen()) return;

      // ";" makes the focused kit a favorite, or stops it being one (#552)
      if (isFavoriteKey(e) && focusedKit && onToggleFavorite) {
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

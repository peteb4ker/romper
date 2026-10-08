import { useEffect, useRef } from "react";

import {
  clearSavedSelectedKit,
  isHmrAvailable,
  restoreSelectedKitIfExists,
  saveSelectedKitState,
} from "../../../utils/hmrStateManager";

interface UseHmrSelectedKitProps {
  kits: Array<{ name: string }>;
  selectedKit: null | string;
  setSelectedKit: (kitName: string) => void;
}

/**
 * Keeps the open kit across a live reload during development (#770).
 *
 * Saves the open kit, forgets it when the user closes it, and after a
 * reload reopens it once the kits have loaded, unless the user has just
 * navigated (see restoreSelectedKitIfExists). Production builds have no
 * HMR, so this does nothing there.
 */
export function useHmrSelectedKit({
  kits,
  selectedKit,
  setSelectedKit,
}: UseHmrSelectedKitProps): void {
  const previousKitRef = useRef(selectedKit);
  const restoreAttemptedRef = useRef(false);

  // Save the open kit, and forget it when the user closes it, so a later
  // reload doesn't reopen a kit they left
  useEffect(() => {
    if (!isHmrAvailable()) return;
    const previousKit = previousKitRef.current;
    previousKitRef.current = selectedKit;
    if (selectedKit) {
      saveSelectedKitState(selectedKit);
    } else if (previousKit) {
      clearSavedSelectedKit();
    }
  }, [selectedKit]);

  // Reopen the saved kit once, when the kits first load after a reload.
  // Later kit refreshes leave the selection to the user.
  useEffect(() => {
    if (!isHmrAvailable() || restoreAttemptedRef.current) return;
    if (kits.length === 0) return;
    restoreAttemptedRef.current = true;
    restoreSelectedKitIfExists(kits, selectedKit, setSelectedKit);
  }, [kits, selectedKit, setSelectedKit]);
}

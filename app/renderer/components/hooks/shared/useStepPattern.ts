import type { KitEdit } from "@romper/shared/db/schema";

import { useCallback, useEffect, useState } from "react";

import { ensureValidStepPattern } from "./stepPatternConstants";
import { useLatestRef } from "./useLatestRef";
import { useSettingSave } from "./useSettingSave";

export interface UseStepPatternParams {
  initialPattern?: null | number[][];
  kitName: string;
  /** Tells the user the steps weren't saved */
  onMessage?: (text: string, type?: string, duration?: number) => void;
  /** Called once main saved the pattern, with the kit it returned (#452) */
  onSaved?: (edited?: KitEdit) => Promise<void> | void;
}

export const STEPS_NOT_SAVED =
  "Couldn't save the steps, so they're back as they were. Try again.";

/**
 * Hook for managing step patterns
 */
export function useStepPattern({
  initialPattern,
  kitName,
  onMessage,
  onSaved,
}: UseStepPatternParams) {
  // useState is already destructured as [value, setter]; NOSONAR
  // suppresses S6754 false positive.
  // prettier-ignore
  const [stepPatternState, setStepPatternState] = useState<null | number[][]>(() => ensureValidStepPattern(initialPattern)); // NOSONAR

  // The pattern on screen, so rapid edits each see the one before
  const latestRef = useLatestRef(stepPatternState);
  const kitRef = useLatestRef(kitName);

  // A failed save puts the last saved pattern back and says so (#511)
  const { reset, save } = useSettingSave<string, number[][], KitEdit>();

  // Show the kit's saved pattern whenever it's loaded or reloaded
  const [shownPattern, setShownPattern] = useState(initialPattern);
  if (shownPattern !== initialPattern) {
    setShownPattern(initialPattern);
    setStepPatternState(ensureValidStepPattern(initialPattern));
  }
  useEffect(() => {
    reset();
  }, [initialPattern, reset]);

  // Resolves to whether main saved the pattern and the kit is still open,
  // so the sequencer's undo history only keeps saved edits (#570)
  const updateStepPattern = useCallback(
    async (pattern: number[][]): Promise<boolean> => {
      if (!globalThis.electronAPI?.updateStepPattern || !kitName) return false;

      // Update UI state immediately for responsive feedback
      const current =
        latestRef.current ?? ensureValidStepPattern(initialPattern);
      latestRef.current = pattern;
      setStepPatternState(pattern);

      const saved = await save({
        current,
        key: kitName,
        onSaved: (edited) => void onSaved?.(edited),
        report: () => onMessage?.(STEPS_NOT_SAVED, "error"),
        restore: (saved) => {
          // The kit changed while this was saving; its steps are on screen
          if (kitRef.current !== kitName) return;
          latestRef.current = saved;
          setStepPatternState(saved);
        },
        send: () => globalThis.electronAPI.updateStepPattern(kitName, pattern),
        value: pattern,
        what: `the steps for kit ${kitName}`,
      });
      return saved && kitRef.current === kitName;
    },
    [kitName, kitRef, initialPattern, latestRef, onMessage, onSaved, save],
  );

  return {
    setStepPattern: updateStepPattern,
    stepPattern: stepPatternState,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";

import { ensureValidStepPattern } from "./stepPatternConstants";
import { useSettingSave } from "./useSettingSave";

export interface UseStepPatternParams {
  initialPattern?: null | number[][];
  kitName: string;
  /** Tells the user the steps weren't saved */
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onSaved?: () => Promise<void> | void;
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
  const [stepPatternState, setStepPatternState] = useState<null | number[][]>(null); // NOSONAR

  // The pattern on screen, so rapid edits each see the one before
  const latestRef = useRef(stepPatternState);
  latestRef.current = stepPatternState;
  const kitRef = useRef(kitName);
  kitRef.current = kitName;

  // A failed save puts the last saved pattern back and says so (#511)
  const { reset, save } = useSettingSave<string, number[][]>();

  useEffect(() => {
    setStepPatternState(ensureValidStepPattern(initialPattern));
    reset();
  }, [initialPattern, reset]);

  const updateStepPattern = useCallback(
    async (pattern: number[][]) => {
      if (!globalThis.electronAPI?.updateStepPattern || !kitName) return;

      // Update UI state immediately for responsive feedback
      const current =
        latestRef.current ?? ensureValidStepPattern(initialPattern);
      latestRef.current = pattern;
      setStepPatternState(pattern);

      await save({
        current,
        key: kitName,
        onSaved: () => void onSaved?.(),
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
    },
    [kitName, initialPattern, onMessage, onSaved, save],
  );

  return {
    setStepPattern: updateStepPattern,
    stepPattern: stepPatternState,
  };
}

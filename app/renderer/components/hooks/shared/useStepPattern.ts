import { useCallback, useEffect, useState } from "react";

import { ensureValidStepPattern } from "./stepPatternConstants";

export interface UseStepPatternParams {
  initialPattern?: null | number[][];
  kitName: string;
  onSaved?: () => Promise<void> | void;
}

/**
 * Hook for managing step patterns
 */
export function useStepPattern({
  initialPattern,
  kitName,
  onSaved,
}: UseStepPatternParams) {
  const [stepPatternState, setStepPatternState] = useState<null | number[][]>(
    null,
  );

  useEffect(() => {
    setStepPatternState(ensureValidStepPattern(initialPattern));
  }, [initialPattern]);

  const updateStepPattern = useCallback(
    async (pattern: number[][]) => {
      if (!globalThis.electronAPI?.updateStepPattern || !kitName) return;

      // Update UI state immediately for responsive feedback
      setStepPatternState(pattern);

      try {
        const result = await globalThis.electronAPI.updateStepPattern(
          kitName,
          pattern,
        );
        if (result.success) {
          onSaved?.();
        } else {
          console.error("Failed to save step pattern:", result.error);
          // Revert UI state on failure
          setStepPatternState(ensureValidStepPattern(initialPattern));
        }
      } catch (e) {
        console.error("Exception saving step pattern:", e);
        // Revert UI state on failure
        setStepPatternState(ensureValidStepPattern(initialPattern));
      }
    },
    [kitName, initialPattern, onSaved],
  );

  return {
    setStepPattern: updateStepPattern,
    stepPattern: stepPatternState,
  };
}

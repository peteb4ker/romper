import { useCallback, useEffect, useState } from "react";

import { ensureValidStepPattern } from "./stepPatternConstants";

export interface UseStepPatternParams {
  kitName: string;
  initialPattern?: number[][] | null;
}

/**
 * Hook for managing step patterns
 */
export function useStepPattern({
  kitName,
  initialPattern,
}: UseStepPatternParams) {
  const [stepPattern, setStepPatternState] = useState<number[][] | null>(null);

  useEffect(() => {
    setStepPatternState(ensureValidStepPattern(initialPattern));
  }, [initialPattern]);

  const updateStepPattern = useCallback(
    async (pattern: number[][]) => {
      if (!window.electronAPI?.updateStepPattern || !kitName) return;

      // Update UI state immediately for responsive feedback
      setStepPatternState(pattern);

      try {
        const result = await window.electronAPI.updateStepPattern(
          kitName,
          pattern,
        );
        if (!result.success) {
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
    [kitName, initialPattern],
  );

  return {
    stepPattern,
    setStepPattern: updateStepPattern,
  };
}

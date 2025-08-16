import { useCallback, useEffect, useState } from "react";

export interface UseBpmParams {
  initialBpm?: number;
  kitName: string;
}

/**
 * Hook for managing BPM values
 */
export function useBpm({ initialBpm, kitName }: UseBpmParams) {
  const [bpm, setBpmState] = useState<number>(initialBpm || 120);

  useEffect(() => {
    setBpmState(initialBpm || 120);
  }, [initialBpm]);

  const updateBpm = useCallback(
    async (newBpm: number) => {
      if (!window.electronAPI?.updateKitBpm || !kitName) return;

      // Validate BPM range
      if (newBpm < 30 || newBpm > 180) {
        console.error("BPM must be between 30 and 180");
        return;
      }

      // Update UI state immediately for responsive feedback
      setBpmState(newBpm);

      try {
        const result = await window.electronAPI.updateKitBpm(kitName, newBpm);
        if (!result.success) {
          console.error("Failed to save BPM:", result.error);
          // Revert UI state on failure
          setBpmState(initialBpm || 120);
        }
      } catch (e) {
        console.error("Exception saving BPM:", e);
        // Revert UI state on failure
        setBpmState(initialBpm || 120);
      }
    },
    [kitName, initialBpm],
  );

  return {
    bpm,
    setBpm: updateBpm,
  };
}

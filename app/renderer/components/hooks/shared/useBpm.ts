import React from "react";

interface UseBpmParams {
  initialBpm?: number;
  kitName: string;
}

/**
 * Hook for managing BPM state and persistence
 * Provides BPM state, validation, and persistence functionality
 */
export function useBpm({ initialBpm = 120, kitName }: UseBpmParams) {
  const [bpm, setBpmState] = React.useState(initialBpm);
  const [isEditing, setIsEditing] = React.useState(false);

  // Update local state when initial BPM changes (kit switching)
  React.useEffect(() => {
    setBpmState(initialBpm);
  }, [initialBpm]);

  const setBpm = React.useCallback(
    async (newBpm: number) => {
      // Validate BPM range
      const clampedBpm = Math.max(30, Math.min(180, Math.round(newBpm)));
      setBpmState(clampedBpm);

      // Persist to database
      if (kitName && window.electronAPI?.updateKitBpm) {
        try {
          await window.electronAPI.updateKitBpm(kitName, clampedBpm);
        } catch (error) {
          console.error("Failed to update BPM:", error);
          // Revert on error
          setBpmState(initialBpm);
        }
      }
    },
    [kitName, initialBpm]
  );

  const validateBpm = React.useCallback((value: number): boolean => {
    return value >= 30 && value <= 180 && Number.isInteger(value);
  }, []);

  return {
    bpm,
    isEditing,
    setBpm,
    setIsEditing,
    validateBpm,
  };
}

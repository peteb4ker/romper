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
  // S6754 NOSONAR suppressions: both useState calls below are already
  // destructured as [value, setter] -- the rule fires as a false positive.
  const [bpmState, setBpmState] = React.useState(initialBpm); // NOSONAR
  const [isEditing, setIsEditing] = React.useState(false); // NOSONAR

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
      if (kitName && globalThis.electronAPI?.updateKitBpm) {
        try {
          const result = await globalThis.electronAPI.updateKitBpm(
            kitName,
            clampedBpm,
          );
          // updateKitBpm returns a DbResult and does NOT reject on a DB
          // failure — revert when it reports success: false so the UI never
          // shows a BPM that was not persisted.
          if (result && !result.success) {
            console.error("Failed to update BPM:", result.error);
            setBpmState(initialBpm);
          }
        } catch (error) {
          console.error("Failed to update BPM:", error);
          // Revert on error
          setBpmState(initialBpm);
        }
      }
    },
    [kitName, initialBpm],
  );

  const validateBpm = React.useCallback((value: number): boolean => {
    return value >= 30 && value <= 180 && Number.isInteger(value);
  }, []);

  return {
    bpm: bpmState,
    isEditing,
    setBpm,
    setIsEditing,
    validateBpm,
  };
}

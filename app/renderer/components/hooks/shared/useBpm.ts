import React from "react";

import { useSettingSave } from "./useSettingSave";

interface UseBpmParams {
  initialBpm?: number;
  kitName: string;
  /** Tells the user the BPM wasn't saved */
  onMessage?: (text: string, type?: string, duration?: number) => void;
}

export function bpmNotSaved(bpm: number): string {
  return `Couldn't save the BPM, so it's back to ${bpm}. Try again.`;
}

/**
 * Hook for managing BPM state and persistence
 * Provides BPM state, validation, and persistence functionality
 */
export function useBpm({ initialBpm = 120, kitName, onMessage }: UseBpmParams) {
  // S6754 NOSONAR suppressions: both useState calls below are already
  // destructured as [value, setter] -- the rule fires as a false positive.
  const [bpmState, setBpmState] = React.useState(initialBpm); // NOSONAR
  const [isEditing, setIsEditing] = React.useState(false); // NOSONAR

  // The BPM on screen, so wheel nudges each see the one before
  const latestRef = React.useRef(bpmState);
  latestRef.current = bpmState;
  const kitRef = React.useRef(kitName);
  kitRef.current = kitName;

  // updateKitBpm resolves with success: false on a database failure rather
  // than rejecting. Either way the last saved BPM goes back and the user is
  // told (#511); a save doesn't reload the kit, so initialBpm can be stale.
  const { reset, save } = useSettingSave<string, number>();

  // Update local state when initial BPM changes (kit switching)
  React.useEffect(() => {
    setBpmState(initialBpm);
    reset();
  }, [initialBpm, reset]);

  const setBpm = React.useCallback(
    async (newBpm: number) => {
      // Validate BPM range
      const clampedBpm = Math.max(30, Math.min(180, Math.round(newBpm)));
      const current = latestRef.current;
      latestRef.current = clampedBpm;
      setBpmState(clampedBpm);

      // Persist to database
      if (!kitName || !globalThis.electronAPI?.updateKitBpm) return;
      await save({
        current,
        key: kitName,
        report: (saved) => onMessage?.(bpmNotSaved(saved), "error"),
        restore: (saved) => {
          // The kit changed while this was saving; its BPM is on screen
          if (kitRef.current !== kitName) return;
          latestRef.current = saved;
          setBpmState(saved);
        },
        send: () => globalThis.electronAPI.updateKitBpm(kitName, clampedBpm),
        value: clampedBpm,
        what: `the BPM for kit ${kitName}`,
      });
    },
    [kitName, onMessage, save],
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

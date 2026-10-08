import React from "react";

import { useLatestRef } from "./useLatestRef";
import { useSettingSave } from "./useSettingSave";

interface UseBpmParams {
  initialBpm?: number;
  kitName: string;
  /** Tells the user the BPM wasn't saved */
  onMessage?: (text: string, type?: string, duration?: number) => void;
  /**
   * Called once main has saved a kit's BPM, so the kit's loaded copy can be
   * patched: a save doesn't reload the kit (#565)
   */
  onSaved?: (kitName: string, bpm: number) => void;
}

export function bpmNotSaved(bpm: number): string {
  return `Couldn't save the BPM, so it's back to ${bpm}. Try again.`;
}

/**
 * Hook for managing BPM state and persistence
 * Provides BPM state, validation, and persistence functionality
 */
export function useBpm({
  initialBpm = 120,
  kitName,
  onMessage,
  onSaved,
}: UseBpmParams) {
  // S6754 NOSONAR suppressions: both useState calls below are already
  // destructured as [value, setter] -- the rule fires as a false positive.
  const [bpmState, setBpmState] = React.useState(initialBpm); // NOSONAR
  const [isEditing, setIsEditing] = React.useState(false); // NOSONAR

  // The BPM on screen, so wheel nudges each see the one before
  const latestRef = useLatestRef(bpmState);
  const kitRef = useLatestRef(kitName);

  // updateKitBpm resolves with success: false on a database failure rather
  // than rejecting. Either way the last saved BPM goes back and the user is
  // told (#511). A save doesn't reload the kit, so onSaved patches its copy.
  const { reset, save } = useSettingSave<string, number>();

  // Show the kit's own BPM when it's reloaded or patched, and when you step
  // to another kit: two kits can have the same BPM, so a kit change alone
  // must reset it too (#565)
  const [shown, setShown] = React.useState({ initialBpm, kitName });
  if (shown.initialBpm !== initialBpm || shown.kitName !== kitName) {
    setShown({ initialBpm, kitName });
    setBpmState(initialBpm);
  }
  React.useEffect(() => {
    reset();
  }, [initialBpm, kitName, reset]);

  const setBpm = React.useCallback(
    async (newBpm: number) => {
      // Nothing to save to, so nothing changes on screen (#543)
      if (!kitName || !globalThis.electronAPI?.updateKitBpm) return;

      // Validate BPM range
      const clampedBpm = Math.max(30, Math.min(180, Math.round(newBpm)));
      const current = latestRef.current;
      latestRef.current = clampedBpm;
      setBpmState(clampedBpm);

      await save({
        current,
        key: kitName,
        onSaved: () => onSaved?.(kitName, clampedBpm),
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
    [kitName, kitRef, latestRef, onMessage, onSaved, save],
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

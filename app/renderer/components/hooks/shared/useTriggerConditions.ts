import { useCallback, useEffect, useState } from "react";

import {
  createDefaultTriggerConditions,
  ensureValidTriggerConditions,
} from "./stepPatternConstants";
import { useLatestRef } from "./useLatestRef";
import { useSettingSave } from "./useSettingSave";

export interface UseTriggerConditionsParams {
  initialConditions?: (null | string)[][] | null;
  kitName: string;
  /** Tells the user the trigger conditions weren't saved */
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onSaved?: () => Promise<void> | void;
}

export const CONDITIONS_NOT_SAVED =
  "Couldn't save the trigger conditions, so they're back as they were. Try again.";

type TriggerConditionsState = (null | string)[][];

/**
 * Hook for managing trigger conditions (mirrors useStepPattern structure)
 */
export function useTriggerConditions({
  initialConditions,
  kitName,
  onMessage,
  onSaved,
}: UseTriggerConditionsParams) {
  // useState is already destructured as [value, setter]; NOSONAR
  // suppresses S6754 false positive.
  // prettier-ignore
  const [triggerConditionsState, setTriggerConditionsState] = useState<TriggerConditionsState>(() => ensureValidTriggerConditions(initialConditions)); // NOSONAR

  // The conditions on screen, so rapid edits each see the one before
  const latestRef = useLatestRef(triggerConditionsState);
  const kitRef = useLatestRef(kitName);

  // A failed save puts the last saved conditions back and says so (#511)
  const { reset, save } = useSettingSave<string, TriggerConditionsState>();

  // Show the loaded kit's conditions; when the kit changes before its data
  // arrives, show the defaults until it does
  const [shown, setShown] = useState({ initialConditions, kitName });
  if (
    shown.initialConditions !== initialConditions ||
    shown.kitName !== kitName
  ) {
    setShown({ initialConditions, kitName });
    setTriggerConditionsState(
      shown.initialConditions === initialConditions
        ? createDefaultTriggerConditions()
        : ensureValidTriggerConditions(initialConditions),
    );
  }
  useEffect(() => {
    reset();
  }, [initialConditions, reset]);

  // Resolves to whether main saved the conditions and the kit is still
  // open, so the sequencer's undo history only keeps saved edits (#570)
  const updateTriggerConditions = useCallback(
    async (conditions: (null | string)[][]): Promise<boolean> => {
      if (!globalThis.electronAPI?.updateTriggerConditions || !kitName) {
        return false;
      }

      // Update UI state immediately for responsive feedback
      const current = latestRef.current;
      latestRef.current = conditions;
      setTriggerConditionsState(conditions);

      const saved = await save({
        current,
        key: kitName,
        onSaved: () => void onSaved?.(),
        report: () => onMessage?.(CONDITIONS_NOT_SAVED, "error"),
        restore: (saved) => {
          // The kit changed while this was saving; its conditions are on screen
          if (kitRef.current !== kitName) return;
          latestRef.current = saved;
          setTriggerConditionsState(saved);
        },
        send: () =>
          globalThis.electronAPI.updateTriggerConditions(kitName, conditions),
        value: conditions,
        what: `the trigger conditions for kit ${kitName}`,
      });
      return saved && kitRef.current === kitName;
    },
    [kitName, kitRef, latestRef, onMessage, onSaved, save],
  );

  return {
    setTriggerConditions: updateTriggerConditions,
    triggerConditions: triggerConditionsState,
  };
}

import React, { useCallback, useEffect, useState } from "react";

import {
  createDefaultTriggerConditions,
  ensureValidTriggerConditions,
} from "./stepPatternConstants";

export interface UseTriggerConditionsParams {
  initialConditions?: (null | string)[][] | null;
  kitName: string;
  onSaved?: () => Promise<void> | void;
}

type TriggerConditionsState = (null | string)[][];

/**
 * Hook for managing trigger conditions (mirrors useStepPattern structure)
 */
export function useTriggerConditions({
  initialConditions,
  kitName,
  onSaved,
}: UseTriggerConditionsParams) {
  // useState is already destructured as [value, setter]; NOSONAR
  // suppresses S6754 false positive.
  // prettier-ignore
  const [triggerConditionsState, setTriggerConditionsState] = useState<TriggerConditionsState>(() => ensureValidTriggerConditions(initialConditions)); // NOSONAR

  // Reset to defaults when kit changes, before new kit data arrives
  const prevKitNameRef = React.useRef(kitName);
  React.useEffect(() => {
    if (prevKitNameRef.current !== kitName) {
      prevKitNameRef.current = kitName;
      setTriggerConditionsState(createDefaultTriggerConditions());
    }
  }, [kitName]);

  // Sync from loaded kit data
  useEffect(() => {
    setTriggerConditionsState(ensureValidTriggerConditions(initialConditions));
  }, [initialConditions]);

  const updateTriggerConditions = useCallback(
    async (conditions: (null | string)[][]) => {
      if (!globalThis.electronAPI?.updateTriggerConditions || !kitName) return;

      // Update UI state immediately for responsive feedback
      setTriggerConditionsState(conditions);

      try {
        const result = await globalThis.electronAPI.updateTriggerConditions(
          kitName,
          conditions,
        );
        if (result.success) {
          onSaved?.();
        } else {
          console.error("Failed to save trigger conditions:", result.error);
          setTriggerConditionsState(
            ensureValidTriggerConditions(initialConditions),
          );
        }
      } catch (e) {
        console.error("Exception saving trigger conditions:", e);
        setTriggerConditionsState(
          ensureValidTriggerConditions(initialConditions),
        );
      }
    },
    [kitName, initialConditions, onSaved],
  );

  return {
    setTriggerConditions: updateTriggerConditions,
    triggerConditions: triggerConditionsState,
  };
}

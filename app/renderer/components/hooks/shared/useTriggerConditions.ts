import React, { useCallback, useEffect, useState } from "react";

import {
  createDefaultTriggerConditions,
  ensureValidTriggerConditions,
} from "./stepPatternConstants";

export interface UseTriggerConditionsParams {
  initialConditions?: (null | string)[][] | null;
  kitName: string;
  onSaved?: () => void;
}

/**
 * Hook for managing trigger conditions (mirrors useStepPattern structure)
 */
export function useTriggerConditions({
  initialConditions,
  kitName,
  onSaved,
}: UseTriggerConditionsParams) {
  const [triggerConditions, setTriggerConditionsState] = useState<
    (null | string)[][]
  >(() => ensureValidTriggerConditions(initialConditions));

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
      if (!window.electronAPI?.updateTriggerConditions || !kitName) return;

      // Update UI state immediately for responsive feedback
      setTriggerConditionsState(conditions);

      try {
        const result = await window.electronAPI.updateTriggerConditions(
          kitName,
          conditions,
        );
        if (!result.success) {
          console.error("Failed to save trigger conditions:", result.error);
          setTriggerConditionsState(
            ensureValidTriggerConditions(initialConditions),
          );
        } else {
          onSaved?.();
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
    triggerConditions,
  };
}

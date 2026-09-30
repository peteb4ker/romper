import {
  DEFAULT_SLICER_DIVISION,
  isSlicerDivision,
  type SlicerDivision,
  type SliceStep,
} from "@romper/shared/sliceTypes";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { createEmptySliceSteps, ensureValidSliceSteps } from "./sliceConstants";

export interface UseSliceStepsParams {
  initialDivision?: null | number;
  initialSliceSteps?: (null | SliceStep)[][] | null;
  kitName: string;
  onSaved?: () => Promise<void> | void;
}

type SliceStepsState = (null | SliceStep)[][];
type SliceStepsUpdate =
  | ((prev: SliceStepsState) => SliceStepsState)
  | SliceStepsState;

// Kit reloads after a save are debounced so rapid edits (scroll-wheel
// nudges, drags) don't bounce the grid back to an older saved state.
const RELOAD_DEBOUNCE_MS = 400;

/**
 * Hook for the sequencer slicer's per-step slice data and the kit-wide
 * division (mirrors useTriggerConditions: optimistic update, IPC save,
 * rollback on failure).
 */
export function useSliceSteps({
  initialDivision,
  initialSliceSteps,
  kitName,
  onSaved,
}: UseSliceStepsParams) {
  // useState is already destructured as [value, setter]; NOSONAR
  // suppresses S6754 false positive.
  // prettier-ignore
  const [sliceSteps, setSliceStepsState] = useState<SliceStepsState>(() => ensureValidSliceSteps(initialSliceSteps)); // NOSONAR
  // prettier-ignore
  const [slicerDivision, setSlicerDivisionState] = useState<SlicerDivision>(() => toDivision(initialDivision)); // NOSONAR

  // Latest value, so updater functions compose correctly across rapid edits
  const latestRef = useRef(sliceSteps);
  latestRef.current = sliceSteps;

  // Reset to defaults when kit changes, before new kit data arrives
  const prevKitNameRef = React.useRef(kitName);
  React.useEffect(() => {
    if (prevKitNameRef.current !== kitName) {
      prevKitNameRef.current = kitName;
      setSliceStepsState(createEmptySliceSteps());
      setSlicerDivisionState(DEFAULT_SLICER_DIVISION);
    }
  }, [kitName]);

  // Sync from loaded kit data
  useEffect(() => {
    setSliceStepsState(ensureValidSliceSteps(initialSliceSteps));
  }, [initialSliceSteps]);

  useEffect(() => {
    setSlicerDivisionState(toDivision(initialDivision));
  }, [initialDivision]);

  const reloadTimerRef = useRef<null | ReturnType<typeof setTimeout>>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      void onSaved?.();
    }, RELOAD_DEBOUNCE_MS);
  }, [onSaved]);

  useEffect(
    () => () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    },
    [],
  );

  const setSliceSteps = useCallback(
    async (update: SliceStepsUpdate) => {
      if (!globalThis.electronAPI?.updateSliceSteps || !kitName) return;

      const next =
        typeof update === "function" ? update(latestRef.current) : update;
      latestRef.current = next;
      setSliceStepsState(next);

      try {
        const result = await globalThis.electronAPI.updateSliceSteps(
          kitName,
          next,
        );
        if (result.success) {
          scheduleReload();
        } else {
          console.error("Failed to save slice steps:", result.error);
          setSliceStepsState(ensureValidSliceSteps(initialSliceSteps));
        }
      } catch (e) {
        console.error("Exception saving slice steps:", e);
        setSliceStepsState(ensureValidSliceSteps(initialSliceSteps));
      }
    },
    [kitName, initialSliceSteps, scheduleReload],
  );

  const setSlicerDivision = useCallback(
    async (division: SlicerDivision) => {
      if (!globalThis.electronAPI?.updateKitSlicerDivision || !kitName) return;

      const previous = slicerDivision;
      setSlicerDivisionState(division);

      try {
        const result = await globalThis.electronAPI.updateKitSlicerDivision(
          kitName,
          division,
        );
        if (result.success) {
          scheduleReload();
        } else {
          console.error("Failed to save slicer division:", result.error);
          setSlicerDivisionState(previous);
        }
      } catch (e) {
        console.error("Exception saving slicer division:", e);
        setSlicerDivisionState(previous);
      }
    },
    [kitName, slicerDivision, scheduleReload],
  );

  return {
    setSlicerDivision,
    setSliceSteps,
    slicerDivision,
    sliceSteps,
  };
}

function toDivision(value: null | number | undefined): SlicerDivision {
  return isSlicerDivision(value) ? value : DEFAULT_SLICER_DIVISION;
}

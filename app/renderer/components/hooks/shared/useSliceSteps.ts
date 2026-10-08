import {
  DEFAULT_SLICER_DIVISION,
  isSlicerDivision,
  type SlicerDivision,
  type SliceStep,
} from "@romper/shared/sliceTypes";
import { useCallback, useEffect, useRef, useState } from "react";

import { createEmptySliceSteps, ensureValidSliceSteps } from "./sliceConstants";
import { useLatestRef } from "./useLatestRef";
import { useSettingSave } from "./useSettingSave";

export interface UseSliceStepsParams {
  initialDivision?: null | number;
  initialSliceSteps?: (null | SliceStep)[][] | null;
  kitName: string;
  /** Tells the user slices or the division weren't saved */
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onSaved?: () => Promise<void> | void;
}

export const SLICES_NOT_SAVED =
  "Couldn't save the slices, so they're back as they were. Try again.";

type SliceStepsState = (null | SliceStep)[][];

type SliceStepsUpdate =
  | ((prev: SliceStepsState) => SliceStepsState)
  | SliceStepsState;
export function divisionNotSaved(division: SlicerDivision): string {
  return `Couldn't save the slice division, so it's back to ${division} slices. Try again.`;
}

// Kit reloads after a save are debounced so rapid edits (scroll-wheel
// nudges, drags) don't bounce the grid back to an older saved state.
const RELOAD_DEBOUNCE_MS = 400;

/**
 * Hook for the sequencer slicer's per-step slice data and the kit-wide
 * division (mirrors useTriggerConditions: optimistic update, IPC save,
 * and on failure the last saved value back with a message, #511).
 */
export function useSliceSteps({
  initialDivision,
  initialSliceSteps,
  kitName,
  onMessage,
  onSaved,
}: UseSliceStepsParams) {
  // useState is already destructured as [value, setter]; NOSONAR
  // suppresses S6754 false positive.
  // prettier-ignore
  const [sliceSteps, setSliceStepsState] = useState<SliceStepsState>(() => ensureValidSliceSteps(initialSliceSteps)); // NOSONAR
  // prettier-ignore
  const [slicerDivision, setSlicerDivisionState] = useState<SlicerDivision>(() => toDivision(initialDivision)); // NOSONAR

  // Latest value, so updater functions compose correctly across rapid edits
  const latestRef = useLatestRef(sliceSteps);
  const divisionRef = useLatestRef(slicerDivision);
  const kitRef = useLatestRef(kitName);

  const { reset: resetStepSaves, save: saveSteps } = useSettingSave<
    string,
    SliceStepsState
  >();
  const { reset: resetDivisionSaves, save: saveDivision } = useSettingSave<
    string,
    SlicerDivision
  >();

  // Show the loaded kit's slices and division; when the kit changes before
  // its data arrives, show the defaults until it does
  const [shown, setShown] = useState({
    initialDivision,
    initialSliceSteps,
    kitName,
  });
  const kitChanged = shown.kitName !== kitName;
  const stepsChanged = shown.initialSliceSteps !== initialSliceSteps;
  const divisionChanged = shown.initialDivision !== initialDivision;
  if (kitChanged || stepsChanged || divisionChanged) {
    setShown({ initialDivision, initialSliceSteps, kitName });
    if (stepsChanged) {
      setSliceStepsState(ensureValidSliceSteps(initialSliceSteps));
    } else if (kitChanged) {
      setSliceStepsState(createEmptySliceSteps());
    }
    if (divisionChanged) {
      setSlicerDivisionState(toDivision(initialDivision));
    } else if (kitChanged) {
      setSlicerDivisionState(DEFAULT_SLICER_DIVISION);
    }
  }
  useEffect(() => {
    resetStepSaves();
  }, [initialSliceSteps, resetStepSaves]);
  useEffect(() => {
    resetDivisionSaves();
  }, [initialDivision, resetDivisionSaves]);

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

  // Resolves to whether main saved the slices and the kit is still open,
  // so the sequencer's undo history only keeps saved edits (#570)
  const setSliceSteps = useCallback(
    async (update: SliceStepsUpdate): Promise<boolean> => {
      if (!globalThis.electronAPI?.updateSliceSteps || !kitName) return false;

      const current = latestRef.current;
      const next = typeof update === "function" ? update(current) : update;
      latestRef.current = next;
      setSliceStepsState(next);

      const saved = await saveSteps({
        current,
        key: kitName,
        onSaved: scheduleReload,
        report: () => onMessage?.(SLICES_NOT_SAVED, "error"),
        restore: (saved) => {
          // The kit changed while this was saving; its slices are on screen
          if (kitRef.current !== kitName) return;
          latestRef.current = saved;
          setSliceStepsState(saved);
        },
        send: () => globalThis.electronAPI.updateSliceSteps(kitName, next),
        value: next,
        what: `the slices for kit ${kitName}`,
      });
      return saved && kitRef.current === kitName;
    },
    [kitName, kitRef, latestRef, onMessage, saveSteps, scheduleReload],
  );

  const setSlicerDivision = useCallback(
    async (division: SlicerDivision) => {
      if (!globalThis.electronAPI?.updateKitSlicerDivision || !kitName) return;

      const current = divisionRef.current;
      divisionRef.current = division;
      setSlicerDivisionState(division);

      await saveDivision({
        current,
        key: kitName,
        onSaved: scheduleReload,
        report: (saved) => onMessage?.(divisionNotSaved(saved), "error"),
        restore: (saved) => {
          if (kitRef.current !== kitName) return;
          divisionRef.current = saved;
          setSlicerDivisionState(saved);
        },
        send: () =>
          globalThis.electronAPI.updateKitSlicerDivision(kitName, division),
        value: division,
        what: `the slice division for kit ${kitName}`,
      });
    },
    [divisionRef, kitName, kitRef, onMessage, saveDivision, scheduleReload],
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

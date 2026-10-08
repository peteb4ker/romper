import type { SliceStep } from "@romper/shared/sliceTypes";
import type { AnyUndoAction, SequenceSnapshot } from "@romper/shared/undoTypes";

import React from "react";

import { createSequenceEditAction } from "../shared/sequenceUndo";
import { ensureValidStepPattern } from "../shared/stepPatternConstants";
import { useLatestRef } from "../shared/useLatestRef";

/** How an edit appears in the undo history. */
export interface SequenceEditMeta {
  description?: string;
  /** Edits with the same key in quick succession merge into one undo step. */
  mergeKey?: string;
}

type SliceSteps = (null | SliceStep)[][];
type SliceStepsUpdate = ((prev: SliceSteps) => SliceSteps) | SliceSteps;

/** Each setter resolves to whether main saved the change */
interface UseSequenceHistoryParams {
  onAddUndoAction?: (action: AnyUndoAction) => void;
  setSliceSteps: (update: SliceStepsUpdate) => Promise<boolean>;
  setStepPattern: (pattern: number[][]) => Promise<boolean>;
  setTriggerConditions: (conditions: (null | string)[][]) => Promise<boolean>;
  sliceSteps: SliceSteps;
  stepPattern: null | number[][];
  triggerConditions: (null | string)[][];
}

/**
 * Wraps the sequencer's setters so every edit (steps, conditions, slices)
 * lands on the kit's undo stack with its before and after state, once main
 * has saved it: a refused edit is put back on screen and isn't undoable
 * (#570).
 */
export function useSequenceHistory({
  onAddUndoAction,
  setSliceSteps,
  setStepPattern,
  setTriggerConditions,
  sliceSteps,
  stepPattern,
  triggerConditions,
}: UseSequenceHistoryParams) {
  // The current sequence. Updated on every commit and by each edit, so
  // several edits in one event see each other.
  const latestRef = useLatestRef<SequenceSnapshot>({
    sliceSteps,
    stepPattern: ensureValidStepPattern(stepPattern),
    triggerConditions,
  });

  // The edit's before and after are taken now, so the next edit in the same
  // event builds on it; it goes on the stack once `save` succeeds
  const record = React.useCallback(
    async (
      change: Partial<SequenceSnapshot>,
      fallbackDescription: string,
      meta: SequenceEditMeta | undefined,
      save: () => Promise<boolean>,
    ) => {
      const before = latestRef.current;
      const after = { ...before, ...change };
      latestRef.current = after;
      const action = createSequenceEditAction(
        meta?.description ?? fallbackDescription,
        before,
        after,
        meta?.mergeKey,
      );
      if (await save()) onAddUndoAction?.(action);
    },
    [latestRef, onAddUndoAction],
  );

  const recordStepPattern = React.useCallback(
    (pattern: number[][], meta?: SequenceEditMeta) =>
      record({ stepPattern: pattern }, "Edit steps", meta, () =>
        setStepPattern(pattern),
      ),
    [record, setStepPattern],
  );

  const recordTriggerConditions = React.useCallback(
    (conditions: (null | string)[][], meta?: SequenceEditMeta) =>
      record({ triggerConditions: conditions }, "Change condition", meta, () =>
        setTriggerConditions(conditions),
      ),
    [record, setTriggerConditions],
  );

  const recordSliceSteps = React.useCallback(
    (update: SliceStepsUpdate, meta?: SequenceEditMeta) => {
      const next =
        typeof update === "function"
          ? update(latestRef.current.sliceSteps)
          : update;
      return record({ sliceSteps: next }, "Edit slices", meta, () =>
        setSliceSteps(next),
      );
    },
    [latestRef, record, setSliceSteps],
  );

  return {
    setSliceSteps: recordSliceSteps,
    setStepPattern: recordStepPattern,
    setTriggerConditions: recordTriggerConditions,
  };
}

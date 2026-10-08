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

interface UseSequenceHistoryParams {
  onAddUndoAction?: (action: AnyUndoAction) => void;
  setSliceSteps: (update: SliceStepsUpdate) => Promise<void> | void;
  setStepPattern: (pattern: number[][]) => void;
  setTriggerConditions: (conditions: (null | string)[][]) => void;
  sliceSteps: SliceSteps;
  stepPattern: null | number[][];
  triggerConditions: (null | string)[][];
}

/**
 * Wraps the sequencer's setters so every edit (steps, conditions, slices)
 * lands on the kit's undo stack with its before and after state.
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

  const record = React.useCallback(
    (
      change: Partial<SequenceSnapshot>,
      fallbackDescription: string,
      meta?: SequenceEditMeta,
    ) => {
      const before = latestRef.current;
      const after = { ...before, ...change };
      latestRef.current = after;
      onAddUndoAction?.(
        createSequenceEditAction(
          meta?.description ?? fallbackDescription,
          before,
          after,
          meta?.mergeKey,
        ),
      );
    },
    [latestRef, onAddUndoAction],
  );

  const recordStepPattern = React.useCallback(
    (pattern: number[][], meta?: SequenceEditMeta) => {
      record({ stepPattern: pattern }, "Edit steps", meta);
      setStepPattern(pattern);
    },
    [record, setStepPattern],
  );

  const recordTriggerConditions = React.useCallback(
    (conditions: (null | string)[][], meta?: SequenceEditMeta) => {
      record({ triggerConditions: conditions }, "Change condition", meta);
      setTriggerConditions(conditions);
    },
    [record, setTriggerConditions],
  );

  const recordSliceSteps = React.useCallback(
    (update: SliceStepsUpdate, meta?: SequenceEditMeta) => {
      const next =
        typeof update === "function"
          ? update(latestRef.current.sliceSteps)
          : update;
      record({ sliceSteps: next }, "Edit slices", meta);
      return setSliceSteps(next);
    },
    [latestRef, record, setSliceSteps],
  );

  return {
    setSliceSteps: recordSliceSteps,
    setStepPattern: recordStepPattern,
    setTriggerConditions: recordTriggerConditions,
  };
}

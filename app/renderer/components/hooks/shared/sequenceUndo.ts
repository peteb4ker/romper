import type {
  AnyUndoAction,
  SequenceEditAction,
  SequenceSnapshot,
} from "@romper/shared/undoTypes";

import { createActionId } from "@romper/shared/undoTypes";

/** Consecutive edits with the same merge key this close together merge. */
export const SEQUENCE_MERGE_WINDOW_MS = 1000;

export function createSequenceEditAction(
  description: string,
  before: SequenceSnapshot,
  after: SequenceSnapshot,
  mergeKey?: string,
): SequenceEditAction {
  return {
    data: { after, before, mergeKey },
    description,
    id: createActionId(),
    timestamp: new Date(),
    type: "SEQUENCE_EDIT",
  };
}

/**
 * Fold `next` into `top` when both are sequencer edits with the same merge
 * key, made within the merge window: the merged action keeps `top`'s
 * before-state and takes `next`'s after-state. Returns null otherwise.
 */
export function mergeSequenceEdit(
  top: AnyUndoAction | undefined,
  next: AnyUndoAction,
): null | SequenceEditAction {
  if (
    top?.type !== "SEQUENCE_EDIT" ||
    next.type !== "SEQUENCE_EDIT" ||
    !next.data.mergeKey ||
    top.data.mergeKey !== next.data.mergeKey ||
    next.timestamp.getTime() - top.timestamp.getTime() >
      SEQUENCE_MERGE_WINDOW_MS
  ) {
    return null;
  }
  return {
    ...next,
    data: { ...next.data, before: top.data.before },
  };
}

/**
 * Save `target` as the kit's sequence. Only the parts that differ from
 * `other` (the state being replaced) are written.
 */
export async function writeSequenceSnapshot(
  kitName: string,
  target: SequenceSnapshot,
  other: SequenceSnapshot,
): Promise<{ error?: string; success: boolean }> {
  const api = globalThis.electronAPI;
  const writes: Promise<{ error?: string; success: boolean } | undefined>[] =
    [];
  if (!sameGrid(target.stepPattern, other.stepPattern)) {
    writes.push(api?.updateStepPattern?.(kitName, target.stepPattern));
  }
  if (!sameGrid(target.triggerConditions, other.triggerConditions)) {
    writes.push(
      api?.updateTriggerConditions?.(kitName, target.triggerConditions),
    );
  }
  if (!sameGrid(target.sliceSteps, other.sliceSteps)) {
    writes.push(api?.updateSliceSteps?.(kitName, target.sliceSteps));
  }
  const results = await Promise.all(writes);
  const failed = results.findIndex((r) => !r?.success);
  if (failed === -1) return { success: true };
  return {
    error: results[failed]?.error ?? "Could not save the sequence",
    success: false,
  };
}

function sameGrid(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

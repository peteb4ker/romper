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
 * `other` (the state being replaced) are written, in one call that saves
 * all of them or none, so a failed undo leaves the kit as it was (#570).
 */
export async function writeSequenceSnapshot(
  kitName: string,
  target: SequenceSnapshot,
  other: SequenceSnapshot,
): Promise<{ error?: string; success: boolean }> {
  const parts: Partial<SequenceSnapshot> = {};
  if (!sameGrid(target.stepPattern, other.stepPattern)) {
    parts.stepPattern = target.stepPattern;
  }
  if (!sameGrid(target.triggerConditions, other.triggerConditions)) {
    parts.triggerConditions = target.triggerConditions;
  }
  if (!sameGrid(target.sliceSteps, other.sliceSteps)) {
    parts.sliceSteps = target.sliceSteps;
  }
  if (Object.keys(parts).length === 0) return { success: true };
  const result = await globalThis.electronAPI?.restoreKitSequence?.(
    kitName,
    parts,
  );
  if (result?.success) return { success: true };
  return {
    error: result?.error ?? "Could not save the sequence",
    success: false,
  };
}

function sameGrid(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

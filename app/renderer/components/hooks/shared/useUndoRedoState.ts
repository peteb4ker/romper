import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { actionKit, carriesItsKit } from "@romper/shared/undoTypes";
import { useCallback, useState } from "react";

import { mergeSequenceEdit } from "./sequenceUndo";

/** The kit, in its store, that a history belongs to */
export interface UndoHistoryOwner {
  kitName: string;
  storePath?: null | string;
}

export interface UseUndoRedoStateOptions {
  kitName: string;
  /** The local store the kit is in; the stack belongs to one kit in one store */
  storePath?: null | string;
}

interface UndoRedoState {
  error: null | string;
  isRedoing: boolean;
  isUndoing: boolean;
  /** Whose history the stacks are; it changes, and they clear, with the kit */
  owner: UndoHistoryOwner;
  redoStack: AnyUndoAction[];
  undoStack: AnyUndoAction[];
}

/**
 * Hook for managing undo/redo state and stack operations
 * Extracted from useUndoRedo to reduce complexity
 */
export function useUndoRedoState({
  kitName,
  storePath,
}: UseUndoRedoStateOptions) {
  const [state, setState] = useState<UndoRedoState>({
    error: null,
    isRedoing: false,
    isUndoing: false,
    owner: { kitName, storePath },
    redoStack: [],
    undoStack: [],
  });

  // Add action to undo stack (called immediately after successful operations).
  // A sequencer edit that continues the previous one (same merge key) merges.
  // Each render hands out an `addAction` for its own kit and store; an edit
  // still running when you step to another kit calls the one it started
  // with, and its action is dropped (#887).
  const addAction = useCallback(
    (action: AnyUndoAction) => {
      setState((prev) => {
        if (!belongsTo(action, { kitName, storePath }, prev.owner)) {
          return prev;
        }
        const merged = mergeSequenceEdit(prev.undoStack[0], action);
        return {
          ...prev,
          error: null,
          redoStack: [], // Clear redo stack when new action is added
          undoStack: merged
            ? [merged, ...prev.undoStack.slice(1)]
            : [action, ...prev.undoStack],
        };
      });
    },
    [kitName, storePath],
  );

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Set loading states
  const setUndoing = useCallback((isUndoing: boolean) => {
    setState((prev) => ({ ...prev, isUndoing }));
  }, []);

  const setRedoing = useCallback((isRedoing: boolean) => {
    setState((prev) => ({ ...prev, isRedoing }));
  }, []);

  // Set error state
  const setError = useCallback((error: string) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  // Handle successful undo operation. `madeFor` is the history the undo
  // started on; when you've stepped to another kit since, the result
  // doesn't move the action onto the new kit's redo history (#887).
  const handleUndoSuccess = useCallback(
    (actionToUndo: AnyUndoAction, madeFor: UndoHistoryOwner) => {
      setState((prev) => {
        if (!belongsTo(actionToUndo, madeFor, prev.owner)) return prev;
        return {
          ...prev,
          error: null,
          redoStack: [actionToUndo, ...prev.redoStack],
          undoStack: prev.undoStack.slice(1),
        };
      });
    },
    [],
  );

  // Handle successful redo operation, as an undo's (#887)
  const handleRedoSuccess = useCallback(
    (actionToRedo: AnyUndoAction, madeFor: UndoHistoryOwner) => {
      setState((prev) => {
        if (!belongsTo(actionToRedo, madeFor, prev.owner)) return prev;
        return {
          ...prev,
          error: null,
          redoStack: prev.redoStack.slice(1),
          undoStack: [actionToRedo, ...prev.undoStack],
        };
      });
    },
    [],
  );

  // Reload the kit an undo or redo changed, whether or not it is still the
  // open one (#887)
  const emitRefreshEvent = useCallback((changedKit: string) => {
    document.dispatchEvent(
      new CustomEvent("romper:refresh-samples", {
        detail: { kitName: changedKit, refreshAll: true },
      }),
    );
  }, []);

  // Clear stacks when the kit or its store changes: another store's kit of
  // the same name is a different kit (#568)
  if (!sameOwner(state.owner, { kitName, storePath })) {
    setState((prev) => ({
      ...prev,
      error: null,
      owner: { kitName, storePath },
      redoStack: [],
      undoStack: [],
    }));
  }

  return {
    // Actions
    addAction,
    // Computed values
    canRedo: state.redoStack.length > 0 && !state.isRedoing,
    canUndo: state.undoStack.length > 0 && !state.isUndoing,
    clearError,
    emitRefreshEvent,

    // State
    error: state.error,
    handleRedoSuccess,
    handleUndoSuccess,
    isRedoing: state.isRedoing,
    isUndoing: state.isUndoing,
    redoCount: state.redoStack.length,
    redoStack: state.redoStack,
    setError,

    setRedoing,
    setUndoing,
    undoCount: state.undoStack.length,
    undoStack: state.undoStack,
  };
}

/**
 * Whether an action, or an undo or redo result, made for `madeFor` belongs
 * on the history `current` (#887). An edit or an undo can still be running
 * when you step to another kit, and its result must not land on the new
 * kit's history. An action that carries its kit ("Remove missing samples",
 * a found file put back) goes on whichever history is open, as it always
 * has: it can be undone with any kit open (D5, #822, #823).
 */
function belongsTo(
  action: AnyUndoAction,
  madeFor: UndoHistoryOwner,
  current: UndoHistoryOwner,
): boolean {
  if (carriesItsKit(action)) return true;
  return sameOwner(madeFor, current) && actionKit(action) === current.kitName;
}

function sameOwner(a: UndoHistoryOwner, b: UndoHistoryOwner): boolean {
  return a.kitName === b.kitName && a.storePath === b.storePath;
}

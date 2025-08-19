import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { useCallback, useEffect, useState } from "react";

export interface UseUndoRedoStateOptions {
  kitName: string;
}

interface UndoRedoState {
  error: null | string;
  isRedoing: boolean;
  isUndoing: boolean;
  redoStack: AnyUndoAction[];
  undoStack: AnyUndoAction[];
}

/**
 * Hook for managing undo/redo state and stack operations
 * Extracted from useUndoRedo to reduce complexity
 */
export function useUndoRedoState({ kitName }: UseUndoRedoStateOptions) {
  const [state, setState] = useState<UndoRedoState>({
    error: null,
    isRedoing: false,
    isUndoing: false,
    redoStack: [],
    undoStack: [],
  });

  // Add action to undo stack (called immediately after successful operations)
  const addAction = useCallback((action: AnyUndoAction) => {
    setState((prev) => ({
      ...prev,
      error: null,
      redoStack: [], // Clear redo stack when new action is added
      undoStack: [action, ...prev.undoStack],
    }));
  }, []);

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

  // Handle successful undo operation
  const handleUndoSuccess = useCallback((actionToUndo: AnyUndoAction) => {
    setState((prev) => ({
      ...prev,
      error: null,
      redoStack: [actionToUndo, ...prev.redoStack],
      undoStack: prev.undoStack.slice(1),
    }));
  }, []);

  // Handle successful redo operation
  const handleRedoSuccess = useCallback((actionToRedo: AnyUndoAction) => {
    setState((prev) => ({
      ...prev,
      error: null,
      redoStack: prev.redoStack.slice(1),
      undoStack: [actionToRedo, ...prev.undoStack],
    }));
  }, []);

  // Emit refresh event
  const emitRefreshEvent = useCallback(() => {
    document.dispatchEvent(
      new CustomEvent("romper:refresh-samples", {
        detail: { kitName },
      })
    );
  }, [kitName]);

  // Clear stacks when kit changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      redoStack: [],
      undoStack: [],
    }));
  }, [kitName]);

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

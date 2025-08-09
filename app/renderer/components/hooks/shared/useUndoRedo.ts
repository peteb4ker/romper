// Memory-only undo/redo hook for kit editing
// Maintains undo/redo stacks in React state for immediate UI updates

import { getActionDescription } from "@romper/shared/undoTypes";
import { useCallback } from "react";

import { useRedoActionHandlers } from "./useRedoActionHandlers";
import { useUndoActionHandlers } from "./useUndoActionHandlers";
import { useUndoRedoState } from "./useUndoRedoState";

export function useUndoRedo(kitName: string) {
  // State management hook
  const state = useUndoRedoState({ kitName });

  // Action handlers hooks
  const undoHandlers = useUndoActionHandlers({ kitName });
  const redoHandlers = useRedoActionHandlers({ kitName });

  // Handle undo result and state updates
  const handleUndoResult = (result: any, actionToUndo: any) => {
    console.log("[UNDO] Final result:", result);

    if (result?.success) {
      console.log("[UNDO] Undo operation successful, updating state");
      state.handleUndoSuccess(actionToUndo);
      console.log("[UNDO] Emitting refresh event");
      state.emitRefreshEvent();
    } else {
      console.log(
        "[UNDO] Undo operation failed:",
        result?.error || "No error message",
      );
      state.setError(result?.error || "Failed to undo action");
    }
  };

  // Handle redo result and state updates
  const handleRedoResult = (result: any, actionToRedo: any) => {
    if (result?.success) {
      state.handleRedoSuccess(actionToRedo);
      state.emitRefreshEvent();
    } else {
      state.setError(result?.error || "Failed to redo action");
    }
  };

  // Handle redo error
  const handleRedoError = (error: any) => {
    state.setError(
      `Failed to redo action: ${error instanceof Error ? error.message : String(error)}`,
    );
  };

  // Undo the most recent action
  const undo = useCallback(async () => {
    if (!kitName || state.undoStack.length === 0 || state.isUndoing) {
      return;
    }

    const actionToUndo = state.undoStack[0];
    state.setError("");
    state.setUndoing(true);

    try {
      console.log(
        "[UNDO] Starting undo execution for type:",
        actionToUndo.type,
      );
      console.log(
        "[UNDO] ElectronAPI available:",
        !!(window as any).electronAPI,
      );

      const result = await undoHandlers.executeUndoAction(actionToUndo);
      handleUndoResult(result, actionToUndo);
    } catch (error) {
      console.log("[UNDO] Exception during undo:", error);
      state.setError(
        `Failed to undo action: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      console.log(
        "[UNDO] Undo operation completed, setting isUndoing to false",
      );
      state.setUndoing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitName, state.undoStack, state.isUndoing]);

  // Redo the most recent undone action
  const redo = useCallback(async () => {
    if (!kitName || state.redoStack.length === 0 || state.isRedoing) {
      return;
    }

    const actionToRedo = state.redoStack[0];
    state.setError("");
    state.setRedoing(true);

    try {
      const result = await redoHandlers.executeRedoAction(actionToRedo);
      handleRedoResult(result, actionToRedo);
    } catch (error) {
      handleRedoError(error);
    } finally {
      state.setRedoing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitName, state.redoStack, state.isRedoing]);

  return {
    // Actions
    addAction: state.addAction, // New: add actions immediately to stack
    // State
    canRedo: state.canRedo,
    canUndo: state.canUndo,
    clearError: state.clearError,

    error: state.error,
    isRedoing: state.isRedoing,
    isUndoing: state.isUndoing,
    redo,
    // Counts
    redoCount: state.redoCount,

    // Descriptions
    redoDescription:
      state.redoStack.length > 0
        ? getActionDescription(state.redoStack[0])
        : null,
    undo,

    undoCount: state.undoCount,
    undoDescription:
      state.undoStack.length > 0
        ? getActionDescription(state.undoStack[0])
        : null,
  };
}

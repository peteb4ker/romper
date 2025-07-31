// Memory-only undo/redo hook for kit editing
// Maintains undo/redo stacks in React state for immediate UI updates

import { useCallback, useEffect, useState } from "react";

import type { AnyUndoAction } from "../../../../shared/undoTypes";
import { getActionDescription } from "../../../../shared/undoTypes";

interface UndoRedoState {
  undoStack: AnyUndoAction[];
  redoStack: AnyUndoAction[];
  isUndoing: boolean;
  isRedoing: boolean;
  error: string | null;
}

export function useUndoRedo(kitName: string) {
  const [state, setState] = useState<UndoRedoState>({
    undoStack: [],
    redoStack: [],
    isUndoing: false,
    isRedoing: false,
    error: null,
  });

  // Add action to undo stack (called immediately after successful operations)
  const addAction = useCallback((action: AnyUndoAction) => {
    setState((prev) => ({
      ...prev,
      undoStack: [action, ...prev.undoStack],
      redoStack: [], // Clear redo stack when new action is added
      error: null,
    }));
  }, []);

  // Undo the most recent action
  const undo = useCallback(async () => {
    // Check if we can undo
    if (!kitName || state.undoStack.length === 0 || state.isUndoing) {
      return;
    }

    const actionToUndo = state.undoStack[0];

    setState((prev) => ({ ...prev, isUndoing: true, error: null }));

    try {
      // Execute undo via IPC - reuse existing sample operations
      // Note: Components using sample operations should skip undo recording during undo/redo

      let result;
      try {
        switch (actionToUndo.type) {
          case "DELETE_SAMPLE":
            // Undo delete = add the sample back
            result = await (window as any).electronAPI?.addSampleToSlot?.(
              kitName,
              actionToUndo.data.voice,
              actionToUndo.data.slot,
              actionToUndo.data.deletedSample.source_path,
              { forceMono: !actionToUndo.data.deletedSample.is_stereo },
            );
            break;
          case "ADD_SAMPLE":
            // Undo add = delete the sample
            result = await (window as any).electronAPI?.deleteSampleFromSlot?.(
              kitName,
              actionToUndo.data.voice,
              actionToUndo.data.slot,
            );
            break;
          case "REPLACE_SAMPLE":
            // Undo replace = restore the old sample
            result = await (window as any).electronAPI?.replaceSampleInSlot?.(
              kitName,
              actionToUndo.data.voice,
              actionToUndo.data.slot,
              actionToUndo.data.oldSample.source_path,
              { forceMono: !actionToUndo.data.oldSample.is_stereo },
            );
            break;
          default:
            throw new Error(
              `Unknown action type: ${(actionToUndo as any).type}`,
            );
        }
      } catch (error) {
        throw error; // Re-throw to be caught by outer try-catch
      }

      if (result?.success) {
        // Move action from undo stack to redo stack
        setState((prev) => ({
          ...prev,
          undoStack: prev.undoStack.slice(1),
          redoStack: [actionToUndo, ...prev.redoStack],
          error: null,
        }));

        // Emit refresh event to update UI
        document.dispatchEvent(
          new CustomEvent("romper:refresh-samples", {
            detail: { kitName },
          }),
        );
      } else {
        setState((prev) => ({
          ...prev,
          error: result?.error || "Failed to undo action",
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Failed to undo action: ${error instanceof Error ? error.message : String(error)}`,
      }));
    } finally {
      setState((prev) => ({ ...prev, isUndoing: false }));
    }
  }, [kitName, state.undoStack, state.isUndoing]);

  // Redo the most recent undone action
  const redo = useCallback(async () => {
    // Check if we can redo
    if (!kitName || state.redoStack.length === 0 || state.isRedoing) {
      return;
    }

    const actionToRedo = state.redoStack[0];

    setState((prev) => ({ ...prev, isRedoing: true, error: null }));

    try {
      // Execute redo by reversing the undo operation
      let result;
      switch (actionToRedo.type) {
        case "DELETE_SAMPLE":
          // Redo delete = delete the sample again
          result = await (window as any).electronAPI?.deleteSampleFromSlot?.(
            kitName,
            actionToRedo.data.voice,
            actionToRedo.data.slot,
          );
          break;
        case "ADD_SAMPLE":
          // Redo add = add the sample again
          result = await (window as any).electronAPI?.addSampleToSlot?.(
            kitName,
            actionToRedo.data.voice,
            actionToRedo.data.slot,
            actionToRedo.data.addedSample.source_path,
            { forceMono: !actionToRedo.data.addedSample.is_stereo },
          );
          break;
        case "REPLACE_SAMPLE":
          // Redo replace = replace with the new sample again
          result = await (window as any).electronAPI?.replaceSampleInSlot?.(
            kitName,
            actionToRedo.data.voice,
            actionToRedo.data.slot,
            actionToRedo.data.newSample.source_path,
            { forceMono: !actionToRedo.data.newSample.is_stereo },
          );
          break;
        default:
          throw new Error(`Unknown action type: ${(actionToRedo as any).type}`);
      }

      if (result?.success) {
        // Move action from redo stack back to undo stack
        setState((prev) => ({
          ...prev,
          redoStack: prev.redoStack.slice(1),
          undoStack: [actionToRedo, ...prev.undoStack],
          error: null,
        }));

        // Emit refresh event to update UI
        document.dispatchEvent(
          new CustomEvent("romper:refresh-samples", {
            detail: { kitName },
          }),
        );
      } else {
        setState((prev) => ({
          ...prev,
          error: result?.error || "Failed to redo action",
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Failed to redo action: ${error instanceof Error ? error.message : String(error)}`,
      }));
    } finally {
      setState((prev) => ({ ...prev, isRedoing: false }));
    }
  }, [kitName, state.redoStack, state.isRedoing]);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Clear stacks when kit changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      undoStack: [],
      redoStack: [],
      error: null,
    }));
  }, [kitName]);

  return {
    // State
    canUndo: state.undoStack.length > 0 && !state.isUndoing,
    canRedo: state.redoStack.length > 0 && !state.isRedoing,
    isUndoing: state.isUndoing,
    isRedoing: state.isRedoing,
    error: state.error,
    undoCount: state.undoStack.length,
    redoCount: state.redoStack.length,

    // Actions
    undo,
    redo,
    addAction, // New: add actions immediately to stack
    clearError,

    // Descriptions
    undoDescription:
      state.undoStack.length > 0
        ? getActionDescription(state.undoStack[0])
        : null,
    redoDescription:
      state.redoStack.length > 0
        ? getActionDescription(state.redoStack[0])
        : null,
  };
}

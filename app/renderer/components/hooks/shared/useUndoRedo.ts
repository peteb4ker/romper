// Memory-only undo/redo hook for kit editing
// Maintains undo/redo stacks in React state for immediate UI updates

import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { getActionDescription } from "@romper/shared/undoTypes";
import { useCallback } from "react";

import type { OperationResult } from "../sample-management/types";

import { createLogger } from "../../../utils/logger";
import { useRedoActionHandlers } from "./useRedoActionHandlers";
import { useUndoActionHandlers } from "./useUndoActionHandlers";
import { useUndoRedoState } from "./useUndoRedoState";

const log = createLogger("UNDO");

type MessageFn = (text: string, type?: string, duration?: number) => void;

/**
 * What the user sees when an undo or redo fails (RE-40): the change, from
 * its description, and what to do. The reason stays in the log.
 */
export function undoFailureMessage(
  action: AnyUndoAction,
  direction: "redo" | "undo",
): string {
  const change = action.description
    .replace(/ \(with reindexing\)$/, "")
    .replace(/^./, (c) => c.toLowerCase());
  return `Couldn't ${direction}: ${change}. Check the kit, then try again.`;
}

/**
 * Undo and redo for the open kit in the local store at `storePath`.
 * `onMessage` tells the user when one fails; the hook's `error` keeps the
 * reason.
 */
export function useUndoRedo(
  kitName: string,
  onMessage?: MessageFn,
  storePath?: null | string,
) {
  // State management hook
  const state = useUndoRedoState({ kitName, storePath });

  // Action handlers hooks
  const undoHandlers = useUndoActionHandlers({ kitName });
  const redoHandlers = useRedoActionHandlers({ kitName });

  // Handle undo result and state updates
  const handleUndoResult = (
    result: OperationResult,
    actionToUndo: AnyUndoAction,
  ) => {
    log.debug("Final result:", result);

    if (result.success) {
      log.debug("Undo operation successful, updating state");
      state.handleUndoSuccess(actionToUndo);
      log.debug("Emitting refresh event");
      state.emitRefreshEvent();
    } else {
      log.warn("Undo operation failed:", result.error || "No error message");
      state.setError(result.error || "Failed to undo action");
      onMessage?.(undoFailureMessage(actionToUndo, "undo"), "error");
    }
  };

  // Handle redo result and state updates
  const handleRedoResult = (
    result: OperationResult,
    actionToRedo: AnyUndoAction,
  ) => {
    if (result.success) {
      state.handleRedoSuccess(actionToRedo);
      state.emitRefreshEvent();
    } else {
      log.warn("Redo operation failed:", result.error || "No error message");
      state.setError(result.error || "Failed to redo action");
      onMessage?.(undoFailureMessage(actionToRedo, "redo"), "error");
    }
  };

  // Handle redo error
  const handleRedoError = (error: unknown, actionToRedo: AnyUndoAction) => {
    log.warn("Exception during redo:", error);
    state.setError(
      `Failed to redo action: ${error instanceof Error ? error.message : String(error)}`,
    );
    onMessage?.(undoFailureMessage(actionToRedo, "redo"), "error");
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
      log.debug("Starting undo execution for type:", actionToUndo.type);

      const result = await undoHandlers.executeUndoAction(actionToUndo);
      const operationResult: OperationResult = result || {
        error: "No result returned",
        success: false,
      };
      handleUndoResult(operationResult, actionToUndo);
    } catch (error) {
      log.warn("Exception during undo:", error);
      state.setError(
        `Failed to undo action: ${error instanceof Error ? error.message : String(error)}`,
      );
      onMessage?.(undoFailureMessage(actionToUndo, "undo"), "error");
    } finally {
      log.debug("Undo operation completed");
      state.setUndoing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitName, onMessage, state.undoStack, state.isUndoing]);

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
      const operationResult: OperationResult = result || {
        error: "No result returned",
        success: false,
      };
      handleRedoResult(operationResult, actionToRedo);
    } catch (error) {
      handleRedoError(error, actionToRedo);
    } finally {
      state.setRedoing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitName, onMessage, state.redoStack, state.isRedoing]);

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
    // The actions undo and redo would apply next
    nextRedo: state.redoStack[0] ?? null,
    nextUndo: state.undoStack[0] ?? null,
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

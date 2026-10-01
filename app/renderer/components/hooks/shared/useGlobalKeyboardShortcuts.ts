// Global keyboard shortcuts hook
// Handles app-wide keyboard shortcuts like Cmd+Z (undo) and Cmd+Shift+Z (redo)

import { useCallback, useEffect } from "react";

import { useUndoRedo } from "./useUndoRedo";

interface UseGlobalKeyboardShortcutsProps {
  currentKitName?: string;
  isEditMode?: boolean;
  onBackNavigation?: () => void;
}

export function useGlobalKeyboardShortcuts({
  currentKitName,
  isEditMode,
  onBackNavigation,
}: UseGlobalKeyboardShortcutsProps) {
  const undoRedo = useUndoRedo(currentKitName || "");

  // Helper function to check if target is in input field or dialog
  const isTargetInInputOrDialog = useCallback(
    (target: HTMLElement): boolean => {
      const isInInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Safely check for dialog elements (handle test environments where closest may not exist)
      const isInDialog = Boolean(
        target.closest &&
        (target.closest('[role="dialog"]') || target.closest(".fixed")),
      );

      return isInInput || isInDialog;
    },
    [],
  );

  // Helper function to handle escape key navigation
  const handleEscapeKey = useCallback(
    (event: KeyboardEvent): boolean => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !onBackNavigation ||
        !currentKitName
      ) {
        return false;
      }

      const target = event.target as HTMLElement;
      if (!isTargetInInputOrDialog(target)) {
        event.preventDefault();
        event.stopPropagation();
        onBackNavigation();
        return true;
      }
      return false;
    },
    [onBackNavigation, currentKitName, isTargetInInputOrDialog],
  );

  // Helper function to handle undo operation
  const handleUndo = useCallback(
    (event: KeyboardEvent): boolean => {
      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();

        if (undoRedo.canUndo && !undoRedo.isUndoing) {
          void undoRedo.undo();
        }
        return true;
      }
      return false;
    },
    [undoRedo],
  );

  // Helper function to handle redo operation
  const handleRedo = useCallback(
    (event: KeyboardEvent): boolean => {
      if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        event.preventDefault();
        event.stopPropagation();

        if (undoRedo.canRedo && !undoRedo.isRedoing) {
          void undoRedo.redo();
        }
        return true;
      }
      return false;
    },
    [undoRedo],
  );

  // Return the addAction function so it can be passed to components that need it
  // This replaces the global function pattern with proper prop passing

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key for back navigation (global, not just in edit mode)
      if (handleEscapeKey(event)) {
        return;
      }

      // Check for Cmd/Ctrl key (Mac uses metaKey, Windows/Linux uses ctrlKey)
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || !currentKitName || event.defaultPrevented) {
        return;
      }
      // Text fields keep their own undo
      if (isTypingTarget(event.target)) {
        return;
      }

      // Sample edits undo only in edit mode; sequencer edits always do,
      // since the sequencer works on locked kits too
      const isRedoKey =
        (event.key === "z" && event.shiftKey) || event.key === "y";
      const next = isRedoKey ? undoRedo.nextRedo : undoRedo.nextUndo;
      if (!isEditMode && next?.type !== "SEQUENCE_EDIT") {
        return;
      }

      // Handle undo and redo operations
      handleUndo(event) || handleRedo(event);
    };

    // Bubble phase: components that own a key (the sequencer grid, popovers,
    // text fields) handle it first and stop it or mark it handled.
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    currentKitName,
    isEditMode,
    undoRedo,
    onBackNavigation,
    handleEscapeKey,
    handleUndo,
    handleRedo,
  ]);

  return {
    addUndoAction: undoRedo.addAction, // Expose this so it can be passed to components
    canRedo: undoRedo.canRedo,
    canUndo: undoRedo.canUndo,
    nextUndo: undoRedo.nextUndo,
    redoDescription: undoRedo.redoDescription,
    undo: undoRedo.undo,
    undoDescription: undoRedo.undoDescription,
  };
}

/** True for text-entry targets, which keep native undo. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return type !== "checkbox" && type !== "range" && type !== "radio";
  }
  return el.tagName === "TEXTAREA" || el.isContentEditable === true;
}

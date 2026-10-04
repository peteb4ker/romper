// Global keyboard shortcuts hook
// Handles app-wide keyboard shortcuts like Cmd+Z (undo) and Cmd+Shift+Z (redo)

import { useCallback, useEffect } from "react";

import { isModalDialogOpen } from "../../../utils/modalDialog";
import { useUndoRedo } from "./useUndoRedo";

interface UseGlobalKeyboardShortcutsProps {
  currentKitName?: string;
  isEditMode?: boolean;
  onBackNavigation?: () => void;
  /** Tells the user when an undo or redo fails (RE-40) */
  onMessage?: (text: string, type?: string, duration?: number) => void;
}

/** True for text-entry targets, which keep native undo. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return type !== "checkbox" && type !== "range" && type !== "radio";
  }
  return el.tagName === "TEXTAREA" || el.isContentEditable === true;
}

export function useGlobalKeyboardShortcuts({
  currentKitName,
  isEditMode,
  onBackNavigation,
  onMessage,
}: UseGlobalKeyboardShortcutsProps) {
  const undoRedo = useUndoRedo(currentKitName || "", onMessage);

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

  // Undoes or redoes the next action if the current kit allows it, for
  // the keyboard and the Edit menu alike. Sample edits undo only in edit
  // mode; sequencer edits always do, since the sequencer works on
  // read-only kits too (main refuses sample edits on them, #572). Returns false when there's no kit or the kit doesn't allow it.
  const applyUndoRedo = useCallback(
    (isRedo: boolean): boolean => {
      if (!currentKitName) return false;
      const next = isRedo ? undoRedo.nextRedo : undoRedo.nextUndo;
      if (!isEditMode && next?.type !== "SEQUENCE_EDIT") return false;

      if (isRedo) {
        if (undoRedo.canRedo && !undoRedo.isRedoing) void undoRedo.redo();
      } else if (undoRedo.canUndo && !undoRedo.isUndoing) {
        void undoRedo.undo();
      }
      return true;
    },
    [currentKitName, isEditMode, undoRedo],
  );

  // Return the addAction function so it can be passed to components that need it
  // This replaces the global function pattern with proper prop passing

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Keys pressed in a dialog are the dialog's: Escape closes it, not
      // the kit behind it, and Cmd+Z doesn't undo a kit edit (#500)
      if (isModalDialogOpen()) {
        return;
      }
      // Handle Escape key for back navigation (global, not just in edit mode)
      if (handleEscapeKey(event)) {
        return;
      }

      // Check for Cmd/Ctrl key (Mac uses metaKey, Windows/Linux uses ctrlKey)
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier || event.defaultPrevented) {
        return;
      }
      // Text fields keep their own undo
      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const isRedoKey = (key === "z" && event.shiftKey) || key === "y";
      const isUndoKey = key === "z" && !event.shiftKey;
      // Handled here, the key doesn't also reach the Edit menu's accelerator
      if ((isUndoKey || isRedoKey) && applyUndoRedo(isRedoKey)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Bubble phase: components that own a key (the sequencer grid, popovers,
    // text fields) handle it first and stop it or mark it handled.
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleEscapeKey, applyUndoRedo]);

  return {
    addUndoAction: undoRedo.addAction, // Expose this so it can be passed to components
    canRedo: undoRedo.canRedo,
    canUndo: undoRedo.canUndo,
    nextUndo: undoRedo.nextUndo,
    redoDescription: undoRedo.redoDescription,
    // Edit > Redo and Edit > Undo, under the same rules as the keys
    redoIfAllowed: () => applyUndoRedo(true),
    undo: undoRedo.undo,
    undoDescription: undoRedo.undoDescription,
    undoIfAllowed: () => applyUndoRedo(false),
  };
}

// Global keyboard shortcuts hook
// Handles app-wide keyboard shortcuts like Cmd+Z (undo) and Cmd+Shift+Z (redo)

import { useEffect } from "react";

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

  // Return the addAction function so it can be passed to components that need it
  // This replaces the global function pattern with proper prop passing

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key for back navigation (global, not just in edit mode)
      if (event.key === "Escape" && onBackNavigation && currentKitName) {
        // Don't handle Escape if we're in an input field or dialog
        const target = event.target as HTMLElement;
        const isInInput =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable;
        const isInDialog =
          target.closest('[role="dialog"]') || target.closest(".fixed");

        if (!isInInput && !isInDialog) {
          event.preventDefault();
          event.stopPropagation();
          onBackNavigation();
          return;
        }
      }

      // Only handle undo/redo shortcuts when in edit mode and we have a kit
      if (!isEditMode || !currentKitName) {
        return;
      }

      // Check for Cmd/Ctrl key (Mac uses metaKey, Windows/Linux uses ctrlKey)
      const isModifier = event.metaKey || event.ctrlKey;

      if (!isModifier) {
        return;
      }

      // Undo: Cmd+Z (but not Shift+Cmd+Z)
      if (event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();

        if (undoRedo.canUndo && !undoRedo.isUndoing) {
          undoRedo.undo();
        }
        return;
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        event.preventDefault();
        event.stopPropagation();

        if (undoRedo.canRedo && !undoRedo.isRedoing) {
          undoRedo.redo();
        }
      }
    };

    // Add event listener to document
    document.addEventListener("keydown", handleKeyDown, true);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [currentKitName, isEditMode, undoRedo, onBackNavigation]);

  return {
    addUndoAction: undoRedo.addAction, // Expose this so it can be passed to components
    canRedo: undoRedo.canRedo,
    canUndo: undoRedo.canUndo,
    redoDescription: undoRedo.redoDescription,
    undoDescription: undoRedo.undoDescription,
  };
}

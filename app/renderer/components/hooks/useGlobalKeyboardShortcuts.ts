// Global keyboard shortcuts hook
// Handles app-wide keyboard shortcuts like Cmd+Z (undo) and Cmd+Shift+Z (redo)

import React, { useEffect } from "react";

import { useUndoRedo } from "./useUndoRedo";

interface UseGlobalKeyboardShortcutsProps {
  currentKitName?: string;
  isEditMode?: boolean;
}

export function useGlobalKeyboardShortcuts({
  currentKitName,
  isEditMode,
}: UseGlobalKeyboardShortcutsProps) {
  const undoRedo = useUndoRedo(currentKitName || "");

  // Return the addAction function so it can be passed to components that need it
  // This replaces the global function pattern with proper prop passing

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when in edit mode and we have a kit
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
        console.log(
          "[KeyboardShortcuts] Undo triggered, canUndo:",
          undoRedo.canUndo,
          "isUndoing:",
          undoRedo.isUndoing,
        );
        event.preventDefault();
        event.stopPropagation();

        if (undoRedo.canUndo && !undoRedo.isUndoing) {
          console.log("[KeyboardShortcuts] Executing undo...");
          undoRedo.undo();
        } else {
          console.log(
            "[KeyboardShortcuts] Undo not available - canUndo:",
            undoRedo.canUndo,
            "isUndoing:",
            undoRedo.isUndoing,
          );
        }
        return;
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if ((event.key === "z" && event.shiftKey) || event.key === "y") {
        console.log(
          "[KeyboardShortcuts] Redo triggered, canRedo:",
          undoRedo.canRedo,
          "isRedoing:",
          undoRedo.isRedoing,
        );
        event.preventDefault();
        event.stopPropagation();

        if (undoRedo.canRedo && !undoRedo.isRedoing) {
          console.log("[KeyboardShortcuts] Executing redo...");
          undoRedo.redo();
        } else {
          console.log(
            "[KeyboardShortcuts] Redo not available - canRedo:",
            undoRedo.canRedo,
            "isRedoing:",
            undoRedo.isRedoing,
          );
        }
        return;
      }
    };

    // Add event listener to document
    document.addEventListener("keydown", handleKeyDown, true);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [currentKitName, isEditMode, undoRedo]);

  return {
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    undoDescription: undoRedo.undoDescription,
    redoDescription: undoRedo.redoDescription,
    addUndoAction: undoRedo.addAction, // Expose this so it can be passed to components
  };
}

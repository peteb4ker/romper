import React from "react";

import { isInternalSampleDrag } from "./dragUtils";

export interface DragAndDropHook {
  getSampleDragHandlers: (
    slotNumber: number,
    sampleName: string,
  ) => {
    onDragEnd?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
  };
  handleDragLeave: () => void;
  handleDragOver: (e: React.DragEvent, slotNumber: number) => void;
  handleDrop: (e: React.DragEvent, slotNumber: number) => void;
  handleInternalDragOver: (e: React.DragEvent, slotNumber: number) => void;
  handleInternalDrop: (e: React.DragEvent, slotNumber: number) => void;
}

export interface UseVoicePanelDragHandlersOptions {
  dragAndDropHook: DragAndDropHook;
  isEditable: boolean;
}

/**
 * Hook for managing combined drag and drop handlers for voice panel slots
 * Handles both internal sample drags and external file drags
 */
export function useVoicePanelDragHandlers({
  dragAndDropHook,
  isEditable,
}: UseVoicePanelDragHandlersOptions) {
  // Combined drag handler for both external and internal drags
  const handleCombinedDragOver = React.useCallback(
    (e: React.DragEvent, slotNumber: number) => {
      if (!isEditable) return;

      if (isInternalSampleDrag(e)) {
        // Internal drag: only call internal handler
        dragAndDropHook.handleInternalDragOver(e, slotNumber);
      } else {
        // External drag: only call external handler
        dragAndDropHook.handleDragOver(e, slotNumber);
      }
    },
    [isEditable, dragAndDropHook],
  );

  const handleCombinedDragLeave = React.useCallback(() => {
    if (!isEditable) return;

    // Handle both external and internal drag leave
    dragAndDropHook.handleDragLeave();
    // Internal drag leave is handled by the internal handler's own logic
  }, [isEditable, dragAndDropHook]);

  const handleCombinedDrop = React.useCallback(
    (e: React.DragEvent, slotNumber: number) => {
      if (!isEditable) return;

      if (isInternalSampleDrag(e)) {
        // Internal drag: only call internal handler
        dragAndDropHook.handleInternalDrop(e, slotNumber);
      } else {
        // External drag: only call external handler
        dragAndDropHook.handleDrop(e, slotNumber);
      }
    },
    [isEditable, dragAndDropHook],
  );

  return {
    handleCombinedDragLeave,
    handleCombinedDragOver,
    handleCombinedDrop,
  };
}

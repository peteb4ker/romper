import React from "react";

/**
 * Constants for drag and drop operations
 */
export const DRAG_TYPES = {
  ROMPER_SAMPLE: "application/x-romper-sample",
} as const;

/**
 * Creates combined drag handlers that handle both internal and external drags
 */
export function createCombinedDragHandlers(
  originalHandlers: {
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
  },
  externalHandlers: {
    onDragOver: (e: React.DragEvent, slotNumber: number) => void;
    onDrop: (e: React.DragEvent, slotNumber: number) => void;
  },
  slotNumber: number,
) {
  return {
    onDragOver: (e: React.DragEvent) => {
      if (isInternalSampleDrag(e)) {
        if (originalHandlers.onDragOver) {
          originalHandlers.onDragOver(e);
        }
      } else {
        externalHandlers.onDragOver(e, slotNumber);
      }
    },
    onDrop: (e: React.DragEvent) => {
      if (isInternalSampleDrag(e)) {
        if (originalHandlers.onDrop) {
          originalHandlers.onDrop(e);
        }
      } else {
        externalHandlers.onDrop(e, slotNumber);
      }
    },
  };
}

/**
 * Utility function to check if a drag event represents an internal sample drag
 */
export function isInternalSampleDrag(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(DRAG_TYPES.ROMPER_SAMPLE);
}

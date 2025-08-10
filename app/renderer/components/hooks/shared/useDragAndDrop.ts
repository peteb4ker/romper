import { useSampleProcessing } from "../sample-management/useSampleProcessing";
import { useExternalDragHandlers } from "./useExternalDragHandlers";
import { useFileValidation } from "./useFileValidation";
import { useInternalDragHandlers } from "./useInternalDragHandlers";

export interface UseDragAndDropOptions {
  isEditable: boolean;
  kitName: string;
  onSampleAdd?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => Promise<void>;
  onSampleReplace?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onStereoDragLeave?: () => void;
  onStereoDragOver?: (
    voice: number,
    slotIndex: number,
    isStereo: boolean,
  ) => void;
  samples: string[];
  voice: number;
}

/**
 * Hook for managing drag and drop functionality including file validation,
 * stereo handling, and sample assignment
 * Refactored to use extracted sub-hooks for better organization
 */
export function useDragAndDrop({
  isEditable,
  kitName,
  onSampleAdd,
  onSampleMove,
  onSampleReplace,
  onStereoDragLeave,
  onStereoDragOver,
  samples,
  voice,
}: UseDragAndDropOptions) {
  // File validation hook
  const fileValidation = useFileValidation();

  // Sample processing hook
  const sampleProcessing = useSampleProcessing({
    kitName,
    onSampleAdd,
    onSampleReplace,
    samples,
    voice,
  });

  // External drag handlers hook
  const externalDragHandlers = useExternalDragHandlers({
    fileValidation,
    isEditable,
    onStereoDragLeave,
    onStereoDragOver,
    sampleProcessing,
    samples,
    voice,
  });

  // Internal drag handlers hook
  const internalDragHandlers = useInternalDragHandlers({
    isEditable,
    onSampleMove,
    samples,
    voice,
  });

  // Combine visual states from both external and internal drags
  const combinedDragOverSlot =
    externalDragHandlers.dragOverSlot ??
    internalDragHandlers.internalDragOverSlot;
  const combinedDropZone =
    externalDragHandlers.dropZone ?? internalDragHandlers.internalDropZone;

  return {
    draggedSample: internalDragHandlers.draggedSample,
    dragOverSlot: combinedDragOverSlot,
    dropZone: combinedDropZone,
    getSampleDragHandlers: internalDragHandlers.getSampleDragHandlers,
    handleDragLeave: externalDragHandlers.handleDragLeave,
    handleDragOver: externalDragHandlers.handleDragOver,
    handleDrop: externalDragHandlers.handleDrop,
    // Expose internal handlers for drop targets
    handleInternalDragOver: internalDragHandlers.handleSampleDragOver,
    handleInternalDrop: internalDragHandlers.handleSampleDrop,
  };
}

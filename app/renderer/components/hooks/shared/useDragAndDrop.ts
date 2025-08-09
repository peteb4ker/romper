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
    mode: "insert" | "overwrite",
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
    voice,
  });

  // Internal drag handlers hook
  const internalDragHandlers = useInternalDragHandlers({
    isEditable,
    onSampleMove,
    samples,
    voice,
  });

  return {
    draggedSample: internalDragHandlers.draggedSample,
    dragOverSlot: externalDragHandlers.dragOverSlot,
    dropZone: externalDragHandlers.dropZone,
    getSampleDragHandlers: internalDragHandlers.getSampleDragHandlers,
    handleDragLeave: externalDragHandlers.handleDragLeave,
    handleDragOver: externalDragHandlers.handleDragOver,
    handleDrop: externalDragHandlers.handleDrop,
  };
}

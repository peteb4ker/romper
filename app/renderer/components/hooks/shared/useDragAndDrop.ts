import { useSampleProcessing } from "../sample-management/useSampleProcessing";
import {
  type StereoDropHandlers,
  useExternalDragHandlers,
} from "./useExternalDragHandlers";
import { useFileValidation } from "./useFileValidation";
import { useInternalDragHandlers } from "./useInternalDragHandlers";

export interface UseDragAndDropOptions {
  isDisabled?: boolean;
  isEditable: boolean;
  kitName: string;
  onBatchDropComplete?: () => void;
  /** Tells the user about files a drop didn't add */
  onMessage?: (text: string, type?: string, duration?: number) => void;
  /** Resolves true when the sample was added */
  onSampleAdd?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<boolean>;
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => Promise<void>;
  /** Resolves true when the sample was replaced */
  onSampleReplace?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<boolean>;
  samples: string[];
  setSharedDraggedSample?: (
    sample: {
      sampleName: string;
      slot: number;
      voice: number;
    } | null,
  ) => void;
  // Shared drag state for cross-voice operations
  sharedDraggedSample?: {
    sampleName: string;
    slot: number;
    voice: number;
  } | null;
  /** Stereo questions and messages for a drop (#537) */
  stereoDrop?: StereoDropHandlers;
  voice: number;
}

/**
 * Hook for managing drag and drop functionality including file validation
 * and sample assignment
 * Refactored to use extracted sub-hooks for better organization
 */
export function useDragAndDrop({
  isDisabled = false,
  isEditable,
  kitName,
  onBatchDropComplete,
  onMessage,
  onSampleAdd,
  onSampleMove,
  onSampleReplace,
  samples,
  setSharedDraggedSample,
  sharedDraggedSample,
  stereoDrop,
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

  // Effective editable: disabled panels cannot be interacted with
  const effectiveEditable = isEditable && !isDisabled;

  // External drag handlers hook
  const externalDragHandlers = useExternalDragHandlers({
    fileValidation,
    isEditable: effectiveEditable,
    onBatchDropComplete,
    onMessage,
    sampleProcessing,
    samples,
    stereoDrop,
    voice,
  });

  // Internal drag handlers hook
  const internalDragHandlers = useInternalDragHandlers({
    isEditable: effectiveEditable,
    onSampleMove,
    samples,
    setSharedDraggedSample,
    sharedDraggedSample,
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

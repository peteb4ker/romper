import { useCallback, useState } from "react";

import { ErrorPatterns } from "../../../utils/errorHandling";

export interface UseInternalDragHandlersOptions {
  isEditable: boolean;
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number
  ) => Promise<void>;
  samples: string[];
  setSharedDraggedSample?: (
    sample: {
      sampleName: string;
      slot: number;
      voice: number;
    } | null
  ) => void;
  // Shared drag state for cross-voice operations
  sharedDraggedSample?: {
    sampleName: string;
    slot: number;
    voice: number;
  } | null;
  voice: number;
}

/**
 * Hook for handling internal sample drag and drop operations
 * Extracted from useDragAndDrop to reduce complexity
 */
export function useInternalDragHandlers({
  isEditable,
  onSampleMove,
  samples,
  setSharedDraggedSample,
  sharedDraggedSample,
  voice,
}: UseInternalDragHandlersOptions) {
  const [localDraggedSample, setLocalDraggedSample] = useState<{
    sampleName: string;
    slot: number;
    voice: number;
  } | null>(null);

  // Use shared state if available, otherwise fall back to local state
  const draggedSample = sharedDraggedSample ?? localDraggedSample;
  const setDraggedSample = setSharedDraggedSample ?? setLocalDraggedSample;

  // State for visual feedback during internal drags
  const [internalDragOverSlot, setInternalDragOverSlot] = useState<
    null | number
  >(null);
  const [internalDropZone, setInternalDropZone] = useState<{
    mode: "append" | "insert";
    slot: number;
  } | null>(null);

  // Internal sample drag handlers
  const handleSampleDragStart = useCallback(
    (e: React.DragEvent, slotNumber: number, sampleName: string) => {
      if (!isEditable) return;

      setDraggedSample({
        sampleName,
        slot: slotNumber,
        voice,
      });

      // Set drag data for internal sample moves
      e.dataTransfer.setData("application/x-romper-sample", "true");
      e.dataTransfer.effectAllowed = "move";
    },
    [isEditable, voice, setDraggedSample]
  );

  const handleSampleDragEnd = useCallback(
    (_e: React.DragEvent) => {
      setDraggedSample(null);
      // Clear visual feedback state
      setInternalDragOverSlot(null);
      setInternalDropZone(null);
    },
    [setDraggedSample]
  );

  const handleSampleDragOver = useCallback(
    (e: React.DragEvent, slotNumber: number) => {
      if (!isEditable) return;
      if (!draggedSample) return;

      e.preventDefault();
      e.stopPropagation();

      // Check if this is an internal sample drag
      const isInternalDrag = e.dataTransfer.types.includes(
        "application/x-romper-sample"
      );
      if (!isInternalDrag) return;

      // Prevent dropping on same slot
      if (draggedSample.slot === slotNumber && draggedSample.voice === voice) {
        e.dataTransfer.dropEffect = "none";
        // Clear visual feedback for invalid drop
        setInternalDragOverSlot(null);
        setInternalDropZone(null);
        return;
      }

      e.dataTransfer.dropEffect = "move";

      // Set visual feedback state
      setInternalDragOverSlot(slotNumber);

      // Determine drop mode for visual feedback
      // All moves are insert-only, but we need to distinguish insert vs append
      const currentSampleCount = samples.filter((s) => s).length;
      const isAppend = slotNumber === currentSampleCount;
      const mode = isAppend ? "append" : "insert";

      setInternalDropZone({ mode, slot: slotNumber });
    },
    [isEditable, draggedSample, voice, samples]
  );

  const handleSampleDragLeave = useCallback(() => {
    // Clear visual feedback on drag leave
    setInternalDragOverSlot(null);
    setInternalDropZone(null);
  }, []);

  const handleSampleDrop = useCallback(
    async (e: React.DragEvent, slotNumber: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isEditable || !draggedSample || !onSampleMove) return;

      // Check if this is an internal sample drag
      const isInternalDrag = e.dataTransfer.types.includes(
        "application/x-romper-sample"
      );
      if (!isInternalDrag) return;

      // Prevent dropping on same slot
      if (draggedSample.slot === slotNumber && draggedSample.voice === voice) {
        return;
      }

      try {
        // All moves use insert-only behavior
        // The backend will handle the insertion logic properly
        await onSampleMove(
          draggedSample.voice,
          draggedSample.slot,
          voice,
          slotNumber
        );
      } catch (error) {
        ErrorPatterns.sampleOperation(error, "move sample");
      } finally {
        setDraggedSample(null);
        // Clear visual feedback state
        setInternalDragOverSlot(null);
        setInternalDropZone(null);
      }
    },
    [isEditable, draggedSample, voice, onSampleMove, setDraggedSample]
  );

  const getSampleDragHandlers = useCallback(
    (slotNumber: number, sampleName: string) => {
      if (!isEditable) {
        return {};
      }

      return {
        onDragEnd: handleSampleDragEnd,
        onDragLeave: handleSampleDragLeave,
        onDragOver: (e: React.DragEvent) => handleSampleDragOver(e, slotNumber),
        onDragStart: (e: React.DragEvent) =>
          handleSampleDragStart(e, slotNumber, sampleName),
        onDrop: (e: React.DragEvent) => handleSampleDrop(e, slotNumber),
      };
    },
    [
      isEditable,
      handleSampleDragEnd,
      handleSampleDragLeave,
      handleSampleDragOver,
      handleSampleDragStart,
      handleSampleDrop,
    ]
  );

  return {
    draggedSample,
    getSampleDragHandlers,
    handleSampleDragEnd,
    handleSampleDragLeave,
    handleSampleDragOver,
    handleSampleDragStart,
    handleSampleDrop,
    // Visual feedback state for internal drags
    internalDragOverSlot,
    internalDropZone,
  };
}

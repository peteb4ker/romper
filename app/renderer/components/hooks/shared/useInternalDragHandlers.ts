import { useCallback, useState } from "react";

export interface UseInternalDragHandlersOptions {
  isEditable: boolean;
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => Promise<void>;
  samples: string[];
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
  voice,
}: UseInternalDragHandlersOptions) {
  const [draggedSample, setDraggedSample] = useState<{
    sampleName: string;
    slot: number;
    voice: number;
  } | null>(null);

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
    (e: React.DragEvent, slotIndex: number, sampleName: string) => {
      if (!isEditable) return;

      console.log(`Dragging sample ${sampleName} from slot ${slotIndex}`);
      setDraggedSample({
        sampleName,
        slot: slotIndex,
        voice,
      });

      // Set drag data for internal sample moves
      e.dataTransfer.setData("application/x-romper-sample", "true");
      e.dataTransfer.effectAllowed = "move";
    },
    [isEditable, voice],
  );

  const handleSampleDragEnd = useCallback((_e: React.DragEvent) => {
    console.log("Sample drag ended");
    setDraggedSample(null);
    // Clear visual feedback state
    setInternalDragOverSlot(null);
    setInternalDropZone(null);
  }, []);

  const handleSampleDragOver = useCallback(
    (e: React.DragEvent, slotIndex: number) => {
      if (!isEditable) return;
      if (!draggedSample) return;

      e.preventDefault();
      e.stopPropagation();

      // Check if this is an internal sample drag
      const isInternalDrag = e.dataTransfer.types.includes(
        "application/x-romper-sample",
      );
      if (!isInternalDrag) return;

      // Prevent dropping on same slot
      if (draggedSample.slot === slotIndex && draggedSample.voice === voice) {
        e.dataTransfer.dropEffect = "none";
        // Clear visual feedback for invalid drop
        setInternalDragOverSlot(null);
        setInternalDropZone(null);
        return;
      }

      e.dataTransfer.dropEffect = "move";

      // Set visual feedback state
      setInternalDragOverSlot(slotIndex);

      // Determine drop mode for visual feedback
      // All moves are insert-only, but we need to distinguish insert vs append
      const currentSampleCount = samples.filter((s) => s).length;
      const isAppend = slotIndex === currentSampleCount;
      const mode = isAppend ? "append" : "insert";

      setInternalDropZone({ mode, slot: slotIndex });
    },
    [isEditable, draggedSample, voice, samples],
  );

  const handleSampleDragLeave = useCallback(() => {
    // Clear visual feedback on drag leave
    setInternalDragOverSlot(null);
    setInternalDropZone(null);
  }, []);

  const handleSampleDrop = useCallback(
    async (e: React.DragEvent, slotIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isEditable || !draggedSample || !onSampleMove) return;

      // Check if this is an internal sample drag
      const isInternalDrag = e.dataTransfer.types.includes(
        "application/x-romper-sample",
      );
      if (!isInternalDrag) return;

      // Prevent dropping on same slot
      if (draggedSample.slot === slotIndex && draggedSample.voice === voice) {
        return;
      }

      console.log(
        `Moving sample from voice ${draggedSample.voice} slot ${draggedSample.slot} to voice ${voice} slot ${slotIndex}`,
      );

      try {
        // All moves use insert-only behavior
        // The backend will handle the insertion logic properly
        await onSampleMove(
          draggedSample.voice,
          draggedSample.slot,
          voice,
          slotIndex,
        );
      } catch (error) {
        console.error("Failed to move sample:", error);
      } finally {
        setDraggedSample(null);
        // Clear visual feedback state
        setInternalDragOverSlot(null);
        setInternalDropZone(null);
      }
    },
    [isEditable, draggedSample, voice, onSampleMove],
  );

  const getSampleDragHandlers = useCallback(
    (slotIndex: number, sampleName: string) => {
      if (!isEditable) {
        return {};
      }

      return {
        onDragEnd: handleSampleDragEnd,
        onDragLeave: handleSampleDragLeave,
        onDragOver: (e: React.DragEvent) => handleSampleDragOver(e, slotIndex),
        onDragStart: (e: React.DragEvent) =>
          handleSampleDragStart(e, slotIndex, sampleName),
        onDrop: (e: React.DragEvent) => handleSampleDrop(e, slotIndex),
      };
    },
    [
      isEditable,
      handleSampleDragEnd,
      handleSampleDragLeave,
      handleSampleDragOver,
      handleSampleDragStart,
      handleSampleDrop,
    ],
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

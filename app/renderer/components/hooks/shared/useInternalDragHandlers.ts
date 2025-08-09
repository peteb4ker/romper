import { useCallback, useState } from "react";

export interface UseInternalDragHandlersOptions {
  isEditable: boolean;
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
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
        return;
      }

      e.dataTransfer.dropEffect = "move";
    },
    [isEditable, draggedSample, voice],
  );

  const handleSampleDragLeave = useCallback(() => {
    // Drag leave handler - no specific action needed for internal drags
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
        // Determine if we're inserting or overwriting
        const targetHasSample = Boolean(samples[slotIndex]);
        const mode = targetHasSample ? "overwrite" : "insert";

        await onSampleMove(
          draggedSample.voice,
          draggedSample.slot,
          voice,
          slotIndex,
          mode,
        );
      } catch (error) {
        console.error("Failed to move sample:", error);
      } finally {
        setDraggedSample(null);
      }
    },
    [isEditable, draggedSample, voice, samples, onSampleMove],
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
  };
}

import { useCallback, useState } from "react";

import { isVoiceAtSampleLimit } from "../../utils/kitOperations";

export interface UseExternalDragHandlersOptions {
  // Processing hooks
  fileValidation: {
    getFilePathFromDrop: (file: File) => Promise<string>;
    validateDroppedFile: (filePath: string) => Promise<unknown>;
  };
  isEditable: boolean;
  onStereoDragLeave?: () => void;
  onStereoDragOver?: (
    voice: number,
    slotNumber: number,
    isStereo: boolean,
  ) => void;
  sampleProcessing: {
    getCurrentKitSamples: () => Promise<null | unknown[]>;
    isDuplicateSample: (
      allSamples: unknown[],
      filePath: string,
    ) => Promise<boolean>;
    processAssignment: (
      filePath: string,
      formatValidation: unknown,
      allSamples: unknown[],
      modifierKeys: { forceMonoDrop: boolean; forceStereoDrop: boolean },
      droppedSlotNumber: number,
    ) => Promise<boolean>;
  };
  samples: string[];
  voice: number;
}

/**
 * Hook for handling external file drag and drop operations
 * Extracted from useDragAndDrop to reduce complexity
 */
export function useExternalDragHandlers({
  fileValidation,
  isEditable,
  onStereoDragLeave,
  onStereoDragOver,
  sampleProcessing,
  samples,
  voice,
}: UseExternalDragHandlersOptions) {
  const [dragOverSlot, setDragOverSlot] = useState<null | number>(null);
  const [dropZone, setDropZone] = useState<{
    mode: "append" | "blocked" | "insert";
    slot: number;
  } | null>(null);

  // External file drag handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent, slotNumber: number) => {
      if (!isEditable) return;

      const items = Array.from(e.dataTransfer.items);
      const fileItems = items.filter((item) => item.kind === "file");
      const hasFiles = fileItems.length > 0;

      if (hasFiles) {
        e.preventDefault();
        e.stopPropagation();

        // Check if target voice can accept external drops (12-sample limit)
        if (isVoiceAtSampleLimit(samples)) {
          // Show "voice full" feedback
          setDragOverSlot(slotNumber);
          setDropZone({ mode: "blocked", slot: slotNumber });
          return;
        }

        // Determine if this is insert-before or append
        const currentSampleCount = samples.filter((s) => s).length;
        const isAppend = slotNumber === currentSampleCount;
        const mode = isAppend ? "append" : "insert";

        const isStereo = fileItems.length === 2;
        setDragOverSlot(slotNumber);
        setDropZone({ mode, slot: slotNumber });

        if (onStereoDragOver) {
          onStereoDragOver(voice, slotNumber, isStereo);
        }
      }
    },
    [isEditable, voice, onStereoDragOver, samples],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null);
    setDropZone(null);

    if (onStereoDragLeave) {
      onStereoDragLeave();
    }
  }, [onStereoDragLeave]);

  const handleDrop = useCallback(
    async (e: React.DragEvent, slotNumber: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isEditable) return;

      // Check if drop is blocked due to 12-sample limit
      if (isVoiceAtSampleLimit(samples)) {
        console.log("Drop blocked: voice already has 12 samples");
        setDragOverSlot(null);
        setDropZone(null);
        if (onStereoDragLeave) {
          onStereoDragLeave();
        }
        return;
      }

      setDragOverSlot(null);
      setDropZone(null);

      if (onStereoDragLeave) {
        onStereoDragLeave();
      }

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const modifierKeys = {
        forceMonoDrop: e.altKey,
        forceStereoDrop: e.shiftKey,
      };

      try {
        const allSamples = await sampleProcessing.getCurrentKitSamples();
        if (!allSamples) return;

        for (const file of files) {
          const filePath = await fileValidation.getFilePathFromDrop(file);
          console.log("Processing dropped file:", filePath);

          const isDuplicate = await sampleProcessing.isDuplicateSample(
            allSamples,
            filePath,
          );
          if (isDuplicate) continue;

          const formatValidation =
            await fileValidation.validateDroppedFile(filePath);
          if (!formatValidation) continue;

          await sampleProcessing.processAssignment(
            filePath,
            formatValidation,
            allSamples,
            modifierKeys,
            slotNumber,
          );
        }
      } catch (error) {
        console.error("Error handling drop:", error);
      }
    },
    [isEditable, onStereoDragLeave, fileValidation, sampleProcessing, samples],
  );

  return {
    dragOverSlot,
    dropZone,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}

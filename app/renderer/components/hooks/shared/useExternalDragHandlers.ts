import { useCallback, useState } from "react";

export interface UseExternalDragHandlersOptions {
  // Processing hooks
  fileValidation: {
    getFilePathFromDrop: (file: File) => Promise<string>;
    validateDroppedFile: (filePath: string) => Promise<any>;
  };
  isEditable: boolean;
  onStereoDragLeave?: () => void;
  onStereoDragOver?: (
    voice: number,
    slotIndex: number,
    isStereo: boolean,
  ) => void;
  sampleProcessing: {
    getCurrentKitSamples: () => Promise<any[] | null>;
    isDuplicateSample: (
      allSamples: any[],
      filePath: string,
    ) => Promise<boolean>;
    processAssignment: (
      filePath: string,
      formatValidation: any,
      allSamples: any[],
      modifierKeys: { forceMonoDrop: boolean; forceStereoDrop: boolean },
      droppedSlotIndex: number,
    ) => Promise<boolean>;
  };
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
  voice,
}: UseExternalDragHandlersOptions) {
  const [dragOverSlot, setDragOverSlot] = useState<null | number>(null);
  const [dropZone, setDropZone] = useState<{
    mode: "insert" | "overwrite";
    slot: number;
  } | null>(null);

  // External file drag handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent, slotIndex: number) => {
      if (!isEditable) return;

      const items = Array.from(e.dataTransfer.items);
      const fileItems = items.filter((item) => item.kind === "file");
      const hasFiles = fileItems.length > 0;

      if (hasFiles) {
        e.preventDefault();
        e.stopPropagation();

        const isStereo = fileItems.length === 2;
        setDragOverSlot(slotIndex);
        setDropZone({ mode: "overwrite", slot: slotIndex });

        if (onStereoDragOver) {
          onStereoDragOver(voice, slotIndex, isStereo);
        }
      }
    },
    [isEditable, voice, onStereoDragOver],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null);
    setDropZone(null);

    if (onStereoDragLeave) {
      onStereoDragLeave();
    }
  }, [onStereoDragLeave]);

  const handleDrop = useCallback(
    async (e: React.DragEvent, slotIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isEditable) return;

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
            slotIndex,
          );
        }
      } catch (error) {
        console.error("Error handling drop:", error);
      }
    },
    [isEditable, onStereoDragLeave, fileValidation, sampleProcessing],
  );

  return {
    dragOverSlot,
    dropZone,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}

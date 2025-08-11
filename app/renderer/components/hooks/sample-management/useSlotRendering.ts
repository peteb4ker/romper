import type { SampleData } from "@romper/app/renderer/components/kitTypes";

import { useCallback } from "react";

export interface UseSlotRenderingOptions {
  defaultToMonoSamples: boolean;
  dragOverSlot: null | number;
  dropZone: { mode: "append" | "blocked" | "insert"; slot: number } | null;
  isActive: boolean;
  isStereoDragTarget: boolean;
  samples: string[];
  selectedIdx: number;
  stereoDragSlotNumber?: number;
  voice: number;
}

/**
 * Hook for managing slot rendering calculations and styling
 * Extracted from KitVoicePanel to reduce component complexity
 */
export function useSlotRendering({
  defaultToMonoSamples,
  dragOverSlot,
  dropZone,
  isActive,
  isStereoDragTarget,
  samples,
  selectedIdx,
  stereoDragSlotNumber,
  voice,
}: UseSlotRenderingOptions) {
  // Helper function to calculate render slots
  const calculateRenderSlots = useCallback(() => {
    const lastSampleIndex = samples
      .map((sample, index) => (sample !== "" ? index : -1))
      .reduce((max, current) => Math.max(max, current), -1);
    const nextAvailableSlot = lastSampleIndex + 1;

    // Always render all 12 slots for consistent UI layout (PRD requirement)
    // Voice panels should have fixed height with 1-12 slots numbered always
    const slotsToRender = 12; // Fixed 12 slots always, no exceptions

    return { nextAvailableSlot, slotsToRender };
  }, [samples]);

  const calculateDragStyling = useCallback(
    (params: {
      defaultToMonoSamples: boolean;
      dropMode?: string;
      isDragOver: boolean;
      isDropZone: boolean;
      isStereoHighlight: boolean;
      sample?: string;
      voice: number;
    }) => {
      let dragOverClass = "";
      let dropHintTitle = "Drop to assign sample";

      if (
        !params.isDragOver &&
        !params.isStereoHighlight &&
        !params.isDropZone
      ) {
        return { dragOverClass, dropHintTitle };
      }

      if (params.isDropZone) {
        if (params.dropMode === "insert") {
          dragOverClass =
            " bg-green-100 dark:bg-green-800 ring-2 ring-green-400 dark:ring-green-300 border-t-4 border-green-500";
          dropHintTitle = "Insert sample here (other samples will shift down)";
        } else if (params.dropMode === "append") {
          dragOverClass =
            " bg-blue-100 dark:bg-blue-800 ring-2 ring-blue-400 dark:ring-blue-300";
          dropHintTitle = "Add sample to end of voice";
        } else if (params.dropMode === "blocked") {
          dragOverClass =
            " bg-red-100 dark:bg-red-800 ring-2 ring-red-400 dark:ring-red-300";
          dropHintTitle = "Voice is full (12 samples maximum)";
        } else {
          // Fallback for unknown modes
          dragOverClass =
            " bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-400 dark:ring-gray-300";
          dropHintTitle = "Drop to assign sample";
        }
      } else if (params.isStereoHighlight) {
        dragOverClass =
          " bg-purple-100 dark:bg-purple-800 ring-2 ring-purple-400 dark:ring-purple-300";
        dropHintTitle =
          params.voice > 1
            ? "Right channel of stereo pair"
            : "Left channel of stereo pair";
      } else {
        dragOverClass =
          " bg-orange-100 dark:bg-orange-800 ring-2 ring-orange-400 dark:ring-orange-300";
        dropHintTitle = `Drop to assign sample (default: ${params.defaultToMonoSamples ? "mono" : "stereo"})`;
      }

      return { dragOverClass, dropHintTitle };
    },
    [],
  );

  // Helper function to calculate slot styling and drag feedback
  const getSlotStyling = useCallback(
    (slotNumber: number, sample: string | undefined) => {
      const slotBaseClass =
        "truncate flex items-center gap-2 mb-1 min-h-[28px]";
      const isDragOver = dragOverSlot === slotNumber;
      const isDropZone = dropZone?.slot === slotNumber;
      const isStereoHighlight =
        isStereoDragTarget && stereoDragSlotNumber === slotNumber;

      const dragStyling = calculateDragStyling({
        defaultToMonoSamples,
        dropMode: dropZone?.mode,
        isDragOver,
        isDropZone,
        isStereoHighlight,
        sample,
        voice,
      });

      return {
        dragOverClass: dragStyling.dragOverClass,
        dropHintTitle: dragStyling.dropHintTitle,
        isDragOver,
        isDropZone,
        isStereoHighlight,
        slotBaseClass,
      };
    },
    [
      dragOverSlot,
      dropZone,
      isStereoDragTarget,
      stereoDragSlotNumber,
      calculateDragStyling,
      defaultToMonoSamples,
      voice,
    ],
  );

  // Helper function to get sample slot CSS classes
  const getSampleSlotClassName = useCallback(
    (slotNumber: number, slotBaseClass: string, dragOverClass: string) => {
      const isSelected = selectedIdx === slotNumber && isActive;
      const selectedClass = isSelected
        ? " bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 font-bold ring-2 ring-blue-400 dark:ring-blue-300"
        : "";
      return `${slotBaseClass}${selectedClass}${dragOverClass}`;
    },
    [selectedIdx, isActive],
  );

  // Helper function to get sample slot title
  const getSampleSlotTitle = useCallback(
    (
      slotNumber: number,
      sampleData: SampleData | undefined,
      isDragOver: boolean,
      isStereoHighlight: boolean,
      isDropZone: boolean,
      dropHintTitle: string,
    ) => {
      if (isDragOver || isStereoHighlight || isDropZone) {
        return dropHintTitle;
      }

      const baseTitle = `Slot ${slotNumber}`;
      const sourceInfo = sampleData?.source_path
        ? `\nSource: ${sampleData.source_path}`
        : "";
      return baseTitle + sourceInfo;
    },
    [],
  );

  return {
    calculateRenderSlots,
    getSampleSlotClassName,
    getSampleSlotTitle,
    getSlotStyling,
  };
}

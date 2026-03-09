import type { Sample } from "@romper/shared/db/schema.js";

import { useCallback } from "react";

export interface UseSampleProcessingOptions {
  kitName: string;
  onSampleAdd?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<void>;
  onSampleReplace?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<void>;
  samples: string[];
  voice: number;
}

/**
 * Hook for processing sample assignments and replacements
 * Extracted from useDragAndDrop to reduce complexity
 */
export function useSampleProcessing({
  kitName,
  onSampleAdd,
  onSampleReplace,
  samples,
  voice,
}: UseSampleProcessingOptions) {
  const getCurrentKitSamples = useCallback(async () => {
    if (!window.electronAPI?.getAllSamplesForKit) {
      console.error("Sample management not available");
      return null;
    }

    const result = await window.electronAPI.getAllSamplesForKit(kitName);
    if (!result.success) {
      console.error(`Failed to get samples: ${result.error}`);
      return null;
    }

    return result.data || [];
  }, [kitName]);

  const isDuplicateSample = useCallback(
    async (allSamples: unknown[], filePath: string): Promise<boolean> => {
      const samples = allSamples as Sample[];
      const voiceSamples = samples.filter(
        (s: Sample) => s.voice_number === voice,
      );
      const isDuplicate = voiceSamples.some(
        (s: Sample) => s.source_path === filePath,
      );

      if (isDuplicate) {
        console.warn(
          `Duplicate sample: ${filePath} already exists in voice ${voice}`,
        );
      }

      return isDuplicate;
    },
    [voice],
  );

  const calculateTargetSlot = useCallback(
    (path: string, slotNumber: number, droppedSlotNumber: number): number => {
      const isFromLocalStore = path.includes(kitName);
      let targetSlot = slotNumber >= 0 ? slotNumber : droppedSlotNumber;

      if (!isFromLocalStore && slotNumber < 0) {
        for (let i = 0; i < 12; i++) {
          if (!samples[i]) {
            return i;
          }
        }
        return -1;
      }

      return targetSlot;
    },
    [kitName, samples],
  );

  const executeAssignment = useCallback(
    async (
      filePath: string,
      allSamples: unknown[],
      droppedSlotNumber: number,
      options: { replaceExisting: boolean },
    ) => {
      const existingSample = samples[droppedSlotNumber];
      const targetSlot = calculateTargetSlot(filePath, -1, droppedSlotNumber);

      if (targetSlot < 0) {
        console.warn("No available slots - all slots are filled");
        return;
      }

      try {
        if (existingSample && options.replaceExisting && onSampleReplace) {
          await onSampleReplace(voice, targetSlot, filePath);
        } else if (onSampleAdd) {
          await onSampleAdd(voice, targetSlot, filePath);
        }
      } catch (error) {
        console.error("Failed to assign sample:", error);
      }
    },
    [samples, calculateTargetSlot, voice, onSampleAdd, onSampleReplace],
  );

  const processAssignment = useCallback(
    async (
      filePath: string,
      formatValidation: unknown,
      allSamples: unknown[],
      droppedSlotNumber: number,
    ): Promise<boolean> => {
      const samples = allSamples as Sample[];

      await executeAssignment(filePath, samples, droppedSlotNumber, {
        replaceExisting: false,
      });

      return true;
    },
    [executeAssignment],
  );

  return {
    calculateTargetSlot,
    executeAssignment,
    getCurrentKitSamples,
    isDuplicateSample,
    processAssignment,
  };
}

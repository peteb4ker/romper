import type { Sample } from "@romper/shared/db/schema.js";

import { useCallback } from "react";
import { toast } from "sonner";

import { ErrorPatterns } from "../../../utils/errorHandling";

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
      ErrorPatterns.apiOperation(result.error, "get samples");
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
        toast.warning("Duplicate sample", {
          description: `Sample already exists in voice ${voice}`,
          duration: 5000,
        });
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
        toast.error("No available slots", {
          description: "Cannot add sample - all slots are filled",
          duration: 5000,
        });
        return;
      }

      try {
        if (existingSample && options.replaceExisting && onSampleReplace) {
          await onSampleReplace(voice, targetSlot, filePath);
        } else if (onSampleAdd) {
          await onSampleAdd(voice, targetSlot, filePath);
        }
      } catch (error) {
        ErrorPatterns.sampleOperation(error, "assign sample");
        toast.error("Failed to assign sample", {
          description: error instanceof Error ? error.message : String(error),
          duration: 5000,
        });
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

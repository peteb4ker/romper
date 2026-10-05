import type { Sample } from "@romper/shared/db/schema.js";

import { useCallback } from "react";

import { createLogger } from "../../../utils/logger";

const log = createLogger("SampleProcessing");

export interface UseSampleProcessingOptions {
  kitName: string;
  /** Adds a file to a slot; resolves true when the sample was added */
  onSampleAdd?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<boolean>;
  /** Replaces a slot's file; resolves true when it was replaced */
  onSampleReplace?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<boolean>;
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
  // Null when the kit's samples can't be read; the drop reports it (RE-40)
  const getCurrentKitSamples = useCallback(async () => {
    if (!globalThis.electronAPI?.getAllSamplesForKit) {
      return null;
    }

    const result = await globalThis.electronAPI.getAllSamplesForKit(kitName);
    if (!result.success) {
      log.warn("Couldn't read the kit's samples:", result.error);
      return null;
    }

    return result.data || [];
  }, [kitName]);

  const isDuplicateSample = useCallback(
    (allSamples: unknown[], filePath: string): Promise<boolean> => {
      const samples = allSamples as Sample[];
      return Promise.resolve(
        samples.some(
          (s: Sample) => s.voice_number === voice && s.source_path === filePath,
        ),
      );
    },
    [voice],
  );

  // Resolves true only when the sample was added or replaced (#542)
  const executeAssignment = useCallback(
    async (
      filePath: string,
      slotNumber: number,
      options: { replaceExisting: boolean },
    ): Promise<boolean> => {
      if (samples[slotNumber] && options.replaceExisting && onSampleReplace) {
        return onSampleReplace(voice, slotNumber, filePath);
      }
      return (await onSampleAdd?.(voice, slotNumber, filePath)) ?? false;
    },
    [samples, voice, onSampleAdd, onSampleReplace],
  );

  // Adds a dropped file to a slot; resolves true when it was added
  const processAssignment = useCallback(
    (filePath: string, slotNumber: number): Promise<boolean> =>
      executeAssignment(filePath, slotNumber, { replaceExisting: false }),
    [executeAssignment],
  );

  return {
    getCurrentKitSamples,
    isDuplicateSample,
    processAssignment,
  };
}

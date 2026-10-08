import type { Sample } from "@romper/shared/db/schema.js";

import { useCallback } from "react";

import { createLogger } from "../../../utils/logger";

const log = createLogger("SampleProcessing");

export interface UseSampleProcessingOptions {
  kitName: string;
  /**
   * The kit's sample rows as loaded. Each edit reloads them, so the
   * duplicate check reads them instead of asking main (#452).
   */
  kitSamples?: Sample[];
  /** Adds a file to a slot; resolves true when the sample was added */
  onSampleAdd?: (
    voice: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<boolean>;
  voice: number;
}

/**
 * Hook for processing sample assignments
 * Extracted from useDragAndDrop to reduce complexity
 */
export function useSampleProcessing({
  kitName,
  kitSamples,
  onSampleAdd,
  voice,
}: UseSampleProcessingOptions) {
  // The kit's rows as loaded; asks main only for a kit loaded without them.
  // Null when they can't be read; the drop reports it (RE-40).
  const getCurrentKitSamples = useCallback(async () => {
    if (kitSamples) return kitSamples;
    if (!globalThis.electronAPI?.getAllSamplesForKit) {
      return null;
    }

    const result = await globalThis.electronAPI.getAllSamplesForKit(kitName);
    if (!result.success) {
      log.warn("Couldn't read the kit's samples:", result.error);
      return null;
    }

    return result.data || [];
  }, [kitName, kitSamples]);

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

  // Adds a dropped file to a slot, even an occupied one (it inserts);
  // resolves true only when the sample was added (#542)
  const processAssignment = useCallback(
    async (filePath: string, slotNumber: number): Promise<boolean> =>
      (await onSampleAdd?.(voice, slotNumber, filePath)) ?? false,
    [voice, onSampleAdd],
  );

  return {
    getCurrentKitSamples,
    isDuplicateSample,
    processAssignment,
  };
}

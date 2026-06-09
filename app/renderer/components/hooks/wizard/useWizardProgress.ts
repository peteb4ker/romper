import { useCallback, useRef } from "react";

import type { ProgressEvent } from "./useLocalStoreWizardState";

export interface StepProgressParams {
  items: string[];
  onStep: (item: string, idx: number) => Promise<void>;
  phase: string;
}

/**
 * Progress reporting for the local store wizard: fans each progress event out
 * to the wizard's own state and the optional external onProgress callback,
 * and provides the sequential per-item step driver used by the file-ops and
 * scanning phases.
 */
export function useWizardProgress(
  setProgress: (p: null | ProgressEvent) => void,
  onProgress?: (p: ProgressEvent) => void,
) {
  const progressCb = useRef(onProgress);
  progressCb.current = onProgress;

  const reportProgress = useCallback(
    (p: ProgressEvent) => {
      setProgress(p);
      if (progressCb.current) progressCb.current(p);
    },
    [setProgress],
  );

  const reportStepProgress = useCallback(
    ({ items, onStep, phase }: StepProgressParams) => {
      // Sequentially process items for correct progress updates
      return (async () => {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          reportProgress({
            currentKit: idx + 1,
            file: item,
            kitName: item,
            percent: Math.round(((idx + 1) / items.length) * 100),
            phase,
            totalKits: items.length,
          });
          await onStep(item, idx);
        }
        if (items.length > 0) reportProgress({ percent: 100, phase });
      })();
    },
    [reportProgress],
  );

  return { reportProgress, reportStepProgress };
}

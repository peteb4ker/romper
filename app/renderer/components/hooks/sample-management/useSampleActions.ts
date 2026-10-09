import type { SampleData } from "@romper/app/renderer/components/kitTypes";

import { useCallback } from "react";

import { ErrorPatterns } from "../../../utils/errorHandling";

export interface UseSampleActionsOptions {
  isDisabled?: boolean;
  isEditable: boolean;
  onSampleDelete?: (voice: number, slotNumber: number) => Promise<void>;
  voice: number;
}

/**
 * Shows a sample's file in Finder or Explorer: what right-clicking a sample
 * row does, and Shift+F10 or the context-menu key on the selected sample
 * (UC-25, #522)
 */
export function showSampleFile(
  sample: Pick<SampleData, "source_path"> | undefined,
): void {
  if (sample?.source_path && globalThis.electronAPI?.showItemInFolder) {
    void globalThis.electronAPI.showItemInFolder(sample.source_path);
  }
}

/**
 * Hook for managing sample actions like deletion and context menu operations
 * Extracted from KitVoicePanel to reduce component complexity
 */
export function useSampleActions({
  isDisabled = false,
  isEditable,
  onSampleDelete,
  voice,
}: UseSampleActionsOptions) {
  const handleDeleteSample = useCallback(
    async (slotNumber: number) => {
      if (!isEditable || isDisabled || !onSampleDelete) return;

      try {
        await onSampleDelete(voice, slotNumber);
      } catch (error) {
        ErrorPatterns.sampleOperation(error, "delete sample");
      }
    },
    [isEditable, isDisabled, onSampleDelete, voice],
  );

  const handleSampleContextMenu = useCallback(
    (e: React.MouseEvent, sampleData: SampleData | undefined) => {
      e.preventDefault();
      showSampleFile(sampleData);
    },
    [],
  );

  return {
    handleDeleteSample,
    handleSampleContextMenu,
  };
}

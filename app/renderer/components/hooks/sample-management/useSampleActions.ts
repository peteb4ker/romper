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
      if (sampleData?.source_path && window.electronAPI?.showItemInFolder) {
        window.electronAPI.showItemInFolder(sampleData.source_path);
      }
    },
    [],
  );

  return {
    handleDeleteSample,
    handleSampleContextMenu,
  };
}

import { useCallback } from "react";

export interface UseSampleManagementParams {
  kitName: string;
  onSamplesChanged?: () => Promise<void>; // Callback to reload samples/kit data
  onMessage?: (msg: { type: string; text: string }) => void;
}

/**
 * Hook for managing sample add/replace/delete operations with source_path tracking
 * Implements Task 5.2.2 & 5.2.3: Drag-and-drop sample assignment and operations
 */
export function useSampleManagement({
  kitName,
  onSamplesChanged,
  onMessage,
}: UseSampleManagementParams) {
  const handleSampleAdd = useCallback(
    async (voice: number, slotIndex: number, filePath: string) => {
      if (!window.electronAPI?.addSampleToSlot) {
        onMessage?.({
          type: "error",
          text: "Sample management not available",
        });
        return;
      }

      try {
        const result = await window.electronAPI.addSampleToSlot(
          kitName,
          voice,
          slotIndex,
          filePath,
        );

        if (result.success) {
          onMessage?.({
            type: "success",
            text: `Sample added to voice ${voice}, slot ${slotIndex + 1}`,
          });
          // Reload samples to reflect changes
          if (onSamplesChanged) {
            await onSamplesChanged();
          }
        } else {
          onMessage?.({
            type: "error",
            text: result.error || "Failed to add sample",
          });
        }
      } catch (error) {
        onMessage?.({
          type: "error",
          text: `Failed to add sample: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
    [kitName, onSamplesChanged, onMessage],
  );

  const handleSampleReplace = useCallback(
    async (voice: number, slotIndex: number, filePath: string) => {
      if (!window.electronAPI?.replaceSampleInSlot) {
        onMessage?.({
          type: "error",
          text: "Sample management not available",
        });
        return;
      }

      try {
        const result = await window.electronAPI.replaceSampleInSlot(
          kitName,
          voice,
          slotIndex,
          filePath,
        );

        if (result.success) {
          onMessage?.({
            type: "success",
            text: `Sample replaced in voice ${voice}, slot ${slotIndex + 1}`,
          });
          // Reload samples to reflect changes
          if (onSamplesChanged) {
            await onSamplesChanged();
          }
        } else {
          onMessage?.({
            type: "error",
            text: result.error || "Failed to replace sample",
          });
        }
      } catch (error) {
        onMessage?.({
          type: "error",
          text: `Failed to replace sample: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
    [kitName, onSamplesChanged, onMessage],
  );

  const handleSampleDelete = useCallback(
    async (voice: number, slotIndex: number) => {
      if (!window.electronAPI?.deleteSampleFromSlot) {
        onMessage?.({
          type: "error",
          text: "Sample management not available",
        });
        return;
      }

      try {
        const result = await window.electronAPI.deleteSampleFromSlot(
          kitName,
          voice,
          slotIndex,
        );

        if (result.success) {
          onMessage?.({
            type: "success",
            text: `Sample deleted from voice ${voice}, slot ${slotIndex + 1}`,
          });
          // Reload samples to reflect changes
          if (onSamplesChanged) {
            await onSamplesChanged();
          }
        } else {
          onMessage?.({
            type: "error",
            text: result.error || "Failed to delete sample",
          });
        }
      } catch (error) {
        onMessage?.({
          type: "error",
          text: `Failed to delete sample: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
    [kitName, onSamplesChanged, onMessage],
  );

  return {
    handleSampleAdd,
    handleSampleReplace,
    handleSampleDelete,
  };
}

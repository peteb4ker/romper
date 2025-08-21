import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { getErrorMessage } from "@romper/shared/errorUtils";
import { useCallback } from "react";

import { useSampleManagementUndoActions } from "./useSampleManagementUndoActions";

export interface UseSampleManagementOperationsOptions {
  kitName: string;
  onAddUndoAction?: (action: AnyUndoAction) => void;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onSamplesChanged?: () => Promise<void>;
  skipUndoRecording: boolean;
}

/**
 * Hook for basic sample operations (add, replace, delete)
 * Extracted from useSampleManagement to reduce complexity
 */
export function useSampleManagementOperations({
  kitName,
  onAddUndoAction,
  onMessage,
  onSamplesChanged,
  skipUndoRecording,
}: UseSampleManagementOperationsOptions) {
  // Get undo action creators
  const undoActions = useSampleManagementUndoActions({
    kitName,
    skipUndoRecording,
  });

  const handleSampleAdd = useCallback(
    async (
      voice: number,
      slotNumber: number,
      filePath: string,
      options?: { forceMono?: boolean; forceStereo?: boolean },
    ) => {
      if (!window.electronAPI?.addSampleToSlot) {
        onMessage?.("Sample management not available", "error");
        return;
      }

      try {
        const result = await window.electronAPI.addSampleToSlot(
          kitName,
          voice,
          slotNumber,
          filePath,
          options,
        );

        if (result.success) {
          onMessage?.(
            `Sample added to voice ${voice}, slot ${slotNumber + 1}`,
            "success",
          );

          // Record undo action unless explicitly skipped
          if (!skipUndoRecording && onAddUndoAction && result.data) {
            console.log("[SAMPLE_MGT] Recording ADD_SAMPLE undo action");
            const addAction = undoActions.createAddSampleAction(
              voice,
              slotNumber,
              filePath,
              options,
            );
            onAddUndoAction(addAction);
          } else {
            console.log(
              "[SAMPLE_MGT] NOT recording ADD_SAMPLE undo action - skipUndoRecording:",
              skipUndoRecording,
              "onAddUndoAction:",
              !!onAddUndoAction,
              "result.data:",
              !!result.data,
            );
          }

          // Reload samples to reflect changes
          if (onSamplesChanged) {
            await onSamplesChanged();
          }
        } else {
          onMessage?.(result.error || "Failed to add sample", "error");
        }
      } catch (error) {
        onMessage?.(
          `Failed to add sample: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    },
    [
      kitName,
      onSamplesChanged,
      onMessage,
      skipUndoRecording,
      onAddUndoAction,
      undoActions,
    ],
  );

  const handleSampleReplace = useCallback(
    async (
      voice: number,
      slotNumber: number,
      filePath: string,
      options?: { forceMono?: boolean; forceStereo?: boolean },
    ) => {
      if (!window.electronAPI?.replaceSampleInSlot) {
        onMessage?.("Sample management not available", "error");
        return;
      }

      try {
        const oldSample = await undoActions.getOldSampleForUndo(
          voice,
          slotNumber,
        );

        const result = await window.electronAPI.replaceSampleInSlot(
          kitName,
          voice,
          slotNumber,
          filePath,
          options,
        );

        if (result.success) {
          onMessage?.(
            `Sample replaced in voice ${voice}, slot ${slotNumber + 1}`,
            "success",
          );

          // Record undo action unless explicitly skipped
          if (oldSample && result.data && onAddUndoAction) {
            console.log("[SAMPLE_MGT] Recording REPLACE_SAMPLE undo action");
            const replaceAction = undoActions.createReplaceSampleAction(
              voice,
              slotNumber,
              oldSample,
              filePath,
              options,
            );
            onAddUndoAction(replaceAction);
          }

          // Reload samples to reflect changes
          if (onSamplesChanged) {
            await onSamplesChanged();
          }
        } else {
          onMessage?.(result.error || "Failed to replace sample", "error");
        }
      } catch (error) {
        onMessage?.(
          `Failed to replace sample: ${getErrorMessage(error)}`,
          "error",
        );
      }
    },
    [kitName, onSamplesChanged, onMessage, undoActions, onAddUndoAction],
  );

  const handleSampleDelete = useCallback(
    async (voice: number, slotNumber: number) => {
      if (!window.electronAPI?.deleteSampleFromSlot) {
        onMessage?.("Sample management not available", "error");
        return;
      }

      try {
        const sampleToDelete = await undoActions.getSampleToDeleteForUndo(
          voice,
          slotNumber,
        );

        const result = await window.electronAPI.deleteSampleFromSlot(kitName, voice, slotNumber);

        if (result.success) {
          onMessage?.(
            `Sample deleted from voice ${voice}, slot ${slotNumber + 1}`,
            "success",
          );

          // Record REINDEX_SAMPLES action since deletion now triggers automatic reindexing
          if (sampleToDelete && onAddUndoAction && result.data) {
            const reindexAction = undoActions.createReindexSamplesAction(
              voice,
              slotNumber,
              sampleToDelete,
              result,
            );
            onAddUndoAction(reindexAction);
          }

          // Reload samples to reflect changes
          if (onSamplesChanged) {
            await onSamplesChanged();
          }
        } else {
          onMessage?.(result.error || "Failed to delete sample", "error");
        }
      } catch (error) {
        onMessage?.(
          `Failed to delete sample: ${getErrorMessage(error)}`,
          "error",
        );
      }
    },
    [kitName, onSamplesChanged, onMessage, undoActions, onAddUndoAction],
  );

  return {
    handleSampleAdd,
    handleSampleDelete,
    handleSampleReplace,
  };
}

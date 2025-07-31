import { useCallback } from "react";

import type {
  AddSampleAction,
  AnyUndoAction,
  DeleteSampleAction,
  ReplaceSampleAction,
} from "../../../../shared/undoTypes";
import { createActionId } from "../../../../shared/undoTypes";

export interface UseSampleManagementParams {
  kitName: string;
  onSamplesChanged?: () => Promise<void>; // Callback to reload samples/kit data
  onMessage?: (msg: { type: string; text: string }) => void;
  skipUndoRecording?: boolean; // Skip recording actions (used during undo operations)
  onAddUndoAction?: (action: AnyUndoAction) => void; // Callback to add undo actions
}

/**
 * Hook for managing sample add/replace/delete operations with source_path tracking
 * Implements Task 5.2.2 & 5.2.3: Drag-and-drop sample assignment and operations
 */
export function useSampleManagement({
  kitName,
  onSamplesChanged,
  onMessage,
  skipUndoRecording = false,
  onAddUndoAction,
}: UseSampleManagementParams) {
  const handleSampleAdd = useCallback(
    async (
      voice: number,
      slotIndex: number,
      filePath: string,
      options?: { forceMono?: boolean; forceStereo?: boolean },
    ) => {
      if (!(window as any).electronAPI?.addSampleToSlot) {
        onMessage?.({
          type: "error",
          text: "Sample management not available",
        });
        return;
      }

      try {
        const result = await (window as any).electronAPI.addSampleToSlot(
          kitName,
          voice,
          slotIndex,
          filePath,
          options,
        );

        if (result.success) {
          onMessage?.({
            type: "success",
            text: `Sample added to voice ${voice}, slot ${slotIndex + 1}`,
          });

          // Record undo action unless explicitly skipped
          if (!skipUndoRecording && onAddUndoAction && result.data) {
            const addAction: AddSampleAction = {
              type: "ADD_SAMPLE",
              id: createActionId(),
              timestamp: new Date(),
              description: `Add sample to voice ${voice}, slot ${slotIndex + 1}`,
              data: {
                voice,
                slot: slotIndex,
                addedSample: {
                  filename: filePath.split("/").pop() || "",
                  source_path: filePath,
                  is_stereo: options?.forceStereo || false,
                },
              },
            };
            onAddUndoAction(addAction);
          }

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
    [kitName, onSamplesChanged, onMessage, skipUndoRecording, onAddUndoAction],
  );

  const handleSampleReplace = useCallback(
    async (
      voice: number,
      slotIndex: number,
      filePath: string,
      options?: { forceMono?: boolean; forceStereo?: boolean },
    ) => {
      if (!(window as any).electronAPI?.replaceSampleInSlot) {
        onMessage?.({
          type: "error",
          text: "Sample management not available",
        });
        return;
      }

      try {
        // Get the old sample before replacing for undo recording
        let oldSample = null;
        if (!skipUndoRecording && onAddUndoAction) {
          const samplesResult =
            await (window as any).electronAPI?.getAllSamplesForKit?.(kitName);
          if (samplesResult?.success && samplesResult.data) {
            oldSample = samplesResult.data.find(
              (s: any) =>
                s.voice_number === voice && s.slot_number === slotIndex + 1,
            );
          }
        }

        const result = await (window as any).electronAPI.replaceSampleInSlot(
          kitName,
          voice,
          slotIndex,
          filePath,
          options,
        );

        if (result.success) {
          onMessage?.({
            type: "success",
            text: `Sample replaced in voice ${voice}, slot ${slotIndex + 1}`,
          });

          // Record undo action unless explicitly skipped
          if (
            !skipUndoRecording &&
            onAddUndoAction &&
            oldSample &&
            result.data
          ) {
            const replaceAction: ReplaceSampleAction = {
              type: "REPLACE_SAMPLE",
              id: createActionId(),
              timestamp: new Date(),
              description: `Replace sample in voice ${voice}, slot ${slotIndex + 1}`,
              data: {
                voice,
                slot: slotIndex,
                oldSample: {
                  filename: oldSample.filename,
                  source_path: oldSample.source_path,
                  is_stereo: oldSample.is_stereo,
                },
                newSample: {
                  filename: filePath.split("/").pop() || "",
                  source_path: filePath,
                  is_stereo: options?.forceStereo || false,
                },
              },
            };
            onAddUndoAction(replaceAction);
          }

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
    [kitName, onSamplesChanged, onMessage, skipUndoRecording, onAddUndoAction],
  );

  const handleSampleDelete = useCallback(
    async (voice: number, slotIndex: number) => {
      if (!(window as any).electronAPI?.deleteSampleFromSlot) {
        onMessage?.({
          type: "error",
          text: "Sample management not available",
        });
        return;
      }

      try {
        // Get the sample data BEFORE deleting it (for undo recording)
        let sampleToDelete = null;
        if (!skipUndoRecording) {
          try {
            const samplesResult =
              await (window as any).electronAPI?.getAllSamplesForKit?.(kitName);
            if (samplesResult?.success && samplesResult.data) {
              sampleToDelete = samplesResult.data.find(
                (sample: any) =>
                  sample.voice_number === voice &&
                  sample.slot_number === slotIndex + 1,
              );
            }
          } catch (error) {
            console.error(
              "[SampleManagement] Failed to get sample data for undo recording:",
              error,
            );
          }
        }

        const result = await (window as any).electronAPI.deleteSampleFromSlot(
          kitName,
          voice,
          slotIndex,
        );

        if (result.success) {
          onMessage?.({
            type: "success",
            text: `Sample deleted from voice ${voice}, slot ${slotIndex + 1}`,
          });

          // Record undo action (unless we're in an undo operation)
          if (!skipUndoRecording && sampleToDelete && onAddUndoAction) {
            const deleteAction: DeleteSampleAction = {
              id: createActionId(),
              type: "DELETE_SAMPLE",
              timestamp: new Date(),
              description: `Delete sample from voice ${voice}, slot ${slotIndex + 1}`,
              data: {
                voice,
                slot: slotIndex,
                deletedSample: {
                  filename: sampleToDelete.filename,
                  source_path: sampleToDelete.source_path,
                  is_stereo: sampleToDelete.is_stereo,
                },
              },
            };
            onAddUndoAction(deleteAction);
          }

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
    [kitName, onSamplesChanged, onMessage, skipUndoRecording, onAddUndoAction],
  );

  return {
    handleSampleAdd,
    handleSampleReplace,
    handleSampleDelete,
  };
}

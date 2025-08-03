import { useCallback } from "react";

import type {
  AddSampleAction,
  AnyUndoAction,
  CompactSlotsAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
  ReplaceSampleAction,
} from "../../../../shared/undoTypes";

import { getErrorMessage } from "../../../../shared/errorUtils";
import { createActionId } from "../../../../shared/undoTypes";

export interface UseSampleManagementParams {
  kitName: string;
  onAddUndoAction?: (action: AnyUndoAction) => void; // Callback to add undo actions
  onMessage?: (msg: { text: string; type: string }) => void;
  onSamplesChanged?: () => Promise<void>; // Callback to reload samples/kit data
  skipUndoRecording?: boolean; // Skip recording actions (used during undo operations)
}

/**
 * Hook for managing sample add/replace/delete operations with source_path tracking
 * Implements Task 5.2.2 & 5.2.3: Drag-and-drop sample assignment and operations
 */
export function useSampleManagement({
  kitName,
  onAddUndoAction,
  onMessage,
  onSamplesChanged,
  skipUndoRecording = false,
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
          text: "Sample management not available",
          type: "error",
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
            text: `Sample added to voice ${voice}, slot ${slotIndex + 1}`,
            type: "success",
          });

          // Record undo action unless explicitly skipped
          if (!skipUndoRecording && onAddUndoAction && result.data) {
            console.log("[SAMPLE_MGT] Recording ADD_SAMPLE undo action");
            const addAction: AddSampleAction = {
              data: {
                addedSample: {
                  filename: filePath.split("/").pop() || "",
                  is_stereo: options?.forceStereo || false,
                  source_path: filePath,
                },
                slot: slotIndex,
                voice,
              },
              description: `Add sample to voice ${voice}, slot ${slotIndex + 1}`,
              id: createActionId(),
              timestamp: new Date(),
              type: "ADD_SAMPLE",
            };
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
          onMessage?.({
            text: result.error || "Failed to add sample",
            type: "error",
          });
        }
      } catch (error) {
        onMessage?.({
          text: `Failed to add sample: ${error instanceof Error ? error.message : String(error)}`,
          type: "error",
        });
      }
    },
    [kitName, onSamplesChanged, onMessage, skipUndoRecording, onAddUndoAction],
  );

  // Helper function to get old sample for undo recording
  const getOldSampleForUndo = useCallback(
    async (voice: number, slotIndex: number) => {
      if (!onAddUndoAction || skipUndoRecording) return null;

      const samplesResult = await (
        window as any
      ).electronAPI?.getAllSamplesForKit?.(kitName);
      if (samplesResult?.success && samplesResult.data) {
        return samplesResult.data.find(
          (s: any) =>
            s.voice_number === voice && s.slot_number === slotIndex + 1,
        );
      }
      return null;
    },
    [kitName, onAddUndoAction, skipUndoRecording],
  );

  // Helper function to create replace sample undo action
  const createReplaceUndoAction = useCallback(
    (
      voice: number,
      slotIndex: number,
      oldSample: any,
      filePath: string,
      options?: { forceMono?: boolean; forceStereo?: boolean },
    ) => {
      const replaceAction: ReplaceSampleAction = {
        data: {
          newSample: {
            filename: filePath.split("/").pop() || "",
            is_stereo: options?.forceStereo || false,
            source_path: filePath,
          },
          oldSample: {
            filename: oldSample.filename,
            is_stereo: oldSample.is_stereo,
            source_path: oldSample.source_path,
          },
          slot: slotIndex,
          voice,
        },
        description: `Replace sample in voice ${voice}, slot ${slotIndex + 1}`,
        id: createActionId(),
        timestamp: new Date(),
        type: "REPLACE_SAMPLE",
      };
      return replaceAction;
    },
    [],
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
          text: "Sample management not available",
          type: "error",
        });
        return;
      }

      try {
        const oldSample = await getOldSampleForUndo(voice, slotIndex);

        const result = await (window as any).electronAPI.replaceSampleInSlot(
          kitName,
          voice,
          slotIndex,
          filePath,
          options,
        );

        if (result.success) {
          onMessage?.({
            text: `Sample replaced in voice ${voice}, slot ${slotIndex + 1}`,
            type: "success",
          });

          // Record undo action unless explicitly skipped
          if (oldSample && result.data && onAddUndoAction) {
            console.log("[SAMPLE_MGT] Recording REPLACE_SAMPLE undo action");
            const replaceAction = createReplaceUndoAction(
              voice,
              slotIndex,
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
          onMessage?.({
            text: result.error || "Failed to replace sample",
            type: "error",
          });
        }
      } catch (error) {
        onMessage?.({
          text: `Failed to replace sample: ${getErrorMessage(error)}`,
          type: "error",
        });
      }
    },
    [
      kitName,
      onSamplesChanged,
      onMessage,
      getOldSampleForUndo,
      createReplaceUndoAction,
      onAddUndoAction,
    ],
  );

  // Helper function to get sample to delete for undo recording
  const getSampleToDeleteForUndo = useCallback(
    async (voice: number, slotIndex: number) => {
      if (skipUndoRecording) return null;

      try {
        const samplesResult = await (
          window as any
        ).electronAPI?.getAllSamplesForKit?.(kitName);
        if (samplesResult?.success && samplesResult.data) {
          return samplesResult.data.find(
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
      return null;
    },
    [kitName, skipUndoRecording],
  );

  // Helper function to create compact slots undo action
  const createCompactSlotsUndoAction = useCallback(
    (voice: number, slotIndex: number, sampleToDelete: any, result: any) => {
      const compactAction: CompactSlotsAction = {
        data: {
          affectedSamples: result.data.affectedSamples.map((sample: any) => ({
            newSlot: sample.slot_number - 1, // Original position before compaction
            oldSlot: sample.slot_number, // New position after compaction
            sample: {
              filename: sample.filename,
              is_stereo: sample.is_stereo,
              source_path: sample.source_path,
            },
            voice: sample.voice_number,
          })),
          deletedSample: {
            filename: sampleToDelete.filename,
            is_stereo: sampleToDelete.is_stereo,
            source_path: sampleToDelete.source_path,
          },
          deletedSlot: slotIndex,
          voice,
        },
        description: `Delete sample from voice ${voice}, slot ${slotIndex + 1} (with compaction)`,
        id: createActionId(),
        timestamp: new Date(),
        type: "COMPACT_SLOTS",
      };
      return compactAction;
    },
    [],
  );

  const handleSampleDelete = useCallback(
    async (voice: number, slotIndex: number) => {
      if (!(window as any).electronAPI?.deleteSampleFromSlot) {
        onMessage?.({
          text: "Sample management not available",
          type: "error",
        });
        return;
      }

      try {
        const sampleToDelete = await getSampleToDeleteForUndo(voice, slotIndex);

        const result = await (window as any).electronAPI.deleteSampleFromSlot(
          kitName,
          voice,
          slotIndex,
        );

        if (result.success) {
          onMessage?.({
            text: `Sample deleted from voice ${voice}, slot ${slotIndex + 1}`,
            type: "success",
          });

          // Record COMPACT_SLOTS action since deletion now triggers automatic compaction
          if (sampleToDelete && onAddUndoAction && result.data) {
            const compactAction = createCompactSlotsUndoAction(
              voice,
              slotIndex,
              sampleToDelete,
              result,
            );
            onAddUndoAction(compactAction);
          }

          // Reload samples to reflect changes
          if (onSamplesChanged) {
            await onSamplesChanged();
          }
        } else {
          onMessage?.({
            text: result.error || "Failed to delete sample",
            type: "error",
          });
        }
      } catch (error) {
        onMessage?.({
          text: `Failed to delete sample: ${getErrorMessage(error)}`,
          type: "error",
        });
      }
    },
    [
      kitName,
      onSamplesChanged,
      onMessage,
      getSampleToDeleteForUndo,
      createCompactSlotsUndoAction,
      onAddUndoAction,
    ],
  );

  // Helper functions to reduce cognitive complexity in handleSampleMove
  const validateMoveAPI = (isCrossKit: boolean) => {
    if (isCrossKit) {
      if (!(window as any).electronAPI?.moveSampleBetweenKits) {
        onMessage?.({
          text: "Cross-kit sample move not available",
          type: "error",
        });
        return false;
      }
    } else if (!(window as any).electronAPI?.moveSampleInKit) {
      onMessage?.({
        text: "Sample move not available",
        type: "error",
      });
      return false;
    }
    return true;
  };

  const captureStateSnapshot = async (fromVoice: number, toVoice: number) => {
    if (skipUndoRecording || !onAddUndoAction) return [];

    const samplesResult = await (
      window as any
    ).electronAPI?.getAllSamplesForKit?.(kitName);
    if (!samplesResult?.success || !samplesResult.data) return [];

    const affectedVoices = new Set([fromVoice, toVoice]);
    return samplesResult.data
      .filter((s: any) => affectedVoices.has(s.voice_number))
      .map((s: any) => ({
        sample: {
          filename: s.filename,
          is_stereo: s.is_stereo,
          source_path: s.source_path,
        },
        slot: s.slot_number,
        voice: s.voice_number,
      }));
  };

  const createSameKitMoveAction = (params: {
    fromSlot: number;
    fromVoice: number;
    mode: "insert" | "overwrite";
    result: any;
    stateSnapshot: any[];
    toSlot: number;
    toVoice: number;
  }): MoveSampleAction => ({
    data: {
      affectedSamples: params.result.data.affectedSamples.map(
        (sample: any) => ({
          newSlot: sample.slot_number,
          oldSlot: sample.original_slot_number,
          sample: {
            filename: sample.filename,
            is_stereo: sample.is_stereo,
            source_path: sample.source_path,
          },
          voice: sample.voice_number,
        }),
      ),
      fromSlot: params.fromSlot,
      fromVoice: params.fromVoice,
      mode: params.mode,
      movedSample: {
        filename: params.result.data.movedSample.filename,
        is_stereo: params.result.data.movedSample.is_stereo,
        source_path: params.result.data.movedSample.source_path,
      },
      replacedSample: params.result.data.replacedSample
        ? {
            filename: params.result.data.replacedSample.filename,
            is_stereo: params.result.data.replacedSample.is_stereo,
            source_path: params.result.data.replacedSample.source_path,
          }
        : undefined,
      stateSnapshot: params.stateSnapshot,
      toSlot: params.toSlot,
      toVoice: params.toVoice,
    },
    description: `Move sample from voice ${params.fromVoice}, slot ${params.fromSlot + 1} to voice ${params.toVoice}, slot ${params.toSlot + 1}`,
    id: createActionId(),
    timestamp: new Date(),
    type: "MOVE_SAMPLE",
  });

  const createCrossKitMoveAction = (params: {
    fromSlot: number;
    fromVoice: number;
    mode: "insert" | "overwrite";
    result: any;
    targetKit: string;
    toSlot: number;
    toVoice: number;
  }): MoveSampleBetweenKitsAction => ({
    data: {
      affectedSamples: params.result.data.affectedSamples.map(
        (sample: any) => ({
          newSlot: sample.slot_number,
          oldSlot: sample.original_slot_number,
          sample: {
            filename: sample.filename,
            is_stereo: sample.is_stereo,
            source_path: sample.source_path,
          },
          voice: sample.voice_number,
        }),
      ),
      fromKit: kitName,
      fromSlot: params.fromSlot,
      fromVoice: params.fromVoice,
      mode: params.mode,
      movedSample: {
        filename: params.result.data.movedSample.filename,
        is_stereo: params.result.data.movedSample.is_stereo,
        source_path: params.result.data.movedSample.source_path,
      },
      replacedSample: params.result.data.replacedSample
        ? {
            filename: params.result.data.replacedSample.filename,
            is_stereo: params.result.data.replacedSample.is_stereo,
            source_path: params.result.data.replacedSample.source_path,
          }
        : undefined,
      toKit: params.targetKit,
      toSlot: params.toSlot,
      toVoice: params.toVoice,
    },
    description: `Move sample from ${kitName} voice ${params.fromVoice}, slot ${params.fromSlot + 1} to ${params.targetKit} voice ${params.toVoice}, slot ${params.toSlot + 1}`,
    id: createActionId(),
    timestamp: new Date(),
    type: "MOVE_SAMPLE_BETWEEN_KITS",
  });

  const handleMoveSuccess = async (
    result: any,
    isCrossKit: boolean,
    targetKit: string,
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => {
    const moveDescription = isCrossKit
      ? `Sample moved from ${kitName} voice ${fromVoice}, slot ${fromSlot + 1} to ${targetKit} voice ${toVoice}, slot ${toSlot + 1}`
      : `Sample moved from voice ${fromVoice}, slot ${fromSlot + 1} to voice ${toVoice}, slot ${toSlot + 1}`;

    onMessage?.({
      text: moveDescription,
      type: "success",
    });

    if (onSamplesChanged) {
      await onSamplesChanged();
    }
  };

  const handleSampleMove = useCallback(
    async (
      fromVoice: number,
      fromSlot: number,
      toVoice: number,
      toSlot: number,
      mode: "insert" | "overwrite",
      toKit?: string,
    ) => {
      const targetKit = toKit || kitName;
      const isCrossKit = targetKit !== kitName;

      if (!validateMoveAPI(isCrossKit)) return;

      try {
        let result;

        if (isCrossKit) {
          result = await (window as any).electronAPI.moveSampleBetweenKits(
            kitName,
            fromVoice,
            fromSlot,
            targetKit,
            toVoice,
            toSlot,
            mode,
          );
        } else {
          const stateSnapshot = await captureStateSnapshot(fromVoice, toVoice);
          result = await (window as any).electronAPI.moveSampleInKit(
            kitName,
            fromVoice,
            fromSlot,
            toVoice,
            toSlot,
            mode,
          );

          if (
            result.success &&
            !skipUndoRecording &&
            onAddUndoAction &&
            result.data
          ) {
            const moveAction = createSameKitMoveAction({
              fromSlot,
              fromVoice,
              mode,
              result,
              stateSnapshot,
              toSlot,
              toVoice,
            });
            onAddUndoAction(moveAction);
          }
        }

        if (
          isCrossKit &&
          result.success &&
          !skipUndoRecording &&
          onAddUndoAction &&
          result.data
        ) {
          const crossKitMoveAction = createCrossKitMoveAction({
            fromSlot,
            fromVoice,
            mode,
            result,
            targetKit,
            toSlot,
            toVoice,
          });
          onAddUndoAction(crossKitMoveAction);
        }

        if (result.success) {
          await handleMoveSuccess(
            result,
            isCrossKit,
            targetKit,
            fromVoice,
            fromSlot,
            toVoice,
            toSlot,
          );
        } else {
          onMessage?.({
            text: result.error || "Failed to move sample",
            type: "error",
          });
        }
      } catch (error) {
        onMessage?.({
          text: `Failed to move sample: ${error instanceof Error ? error.message : String(error)}`,
          type: "error",
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kitName, onSamplesChanged, onMessage, skipUndoRecording, onAddUndoAction],
  );

  return {
    handleSampleAdd,
    handleSampleDelete,
    handleSampleMove,
    handleSampleReplace,
  };
}

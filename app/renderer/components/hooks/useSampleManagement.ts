import { useCallback } from "react";

import type {
  AddSampleAction,
  AnyUndoAction,
  CompactSlotsAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
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
            console.log("[SAMPLE_MGT] Recording ADD_SAMPLE undo action");
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
          const samplesResult = await (
            window as any
          ).electronAPI?.getAllSamplesForKit?.(kitName);
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
            console.log("[SAMPLE_MGT] Recording REPLACE_SAMPLE undo action");
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
          } else {
            console.log(
              "[SAMPLE_MGT] NOT recording REPLACE_SAMPLE undo action - skipUndoRecording:",
              skipUndoRecording,
              "onAddUndoAction:",
              !!onAddUndoAction,
              "oldSample:",
              !!oldSample,
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
            const samplesResult = await (
              window as any
            ).electronAPI?.getAllSamplesForKit?.(kitName);
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

          // Record COMPACT_SLOTS action since deletion now triggers automatic compaction
          if (
            !skipUndoRecording &&
            sampleToDelete &&
            onAddUndoAction &&
            result.data
          ) {
            const compactAction: CompactSlotsAction = {
              id: createActionId(),
              type: "COMPACT_SLOTS",
              timestamp: new Date(),
              description: `Delete sample from voice ${voice}, slot ${slotIndex + 1} (with compaction)`,
              data: {
                voice,
                deletedSlot: slotIndex,
                deletedSample: {
                  filename: sampleToDelete.filename,
                  source_path: sampleToDelete.source_path,
                  is_stereo: sampleToDelete.is_stereo,
                },
                affectedSamples: result.data.affectedSamples.map(
                  (sample: any) => ({
                    voice: sample.voice_number,
                    oldSlot: sample.slot_number, // New position after compaction
                    newSlot: sample.slot_number - 1, // Original position before compaction
                    sample: {
                      filename: sample.filename,
                      source_path: sample.source_path,
                      is_stereo: sample.is_stereo,
                    },
                  }),
                ),
              },
            };
            onAddUndoAction(compactAction);
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

  const handleSampleMove = useCallback(
    async (
      fromVoice: number,
      fromSlot: number,
      toVoice: number,
      toSlot: number,
      mode: "insert" | "overwrite",
      toKit?: string, // Optional target kit for cross-kit moves
    ) => {
      const targetKit = toKit || kitName;
      const isCrossKit = targetKit !== kitName;

      // Check if the appropriate API is available
      if (isCrossKit) {
        if (!(window as any).electronAPI?.moveSampleBetweenKits) {
          onMessage?.({
            type: "error",
            text: "Cross-kit sample move not available",
          });
          return;
        }
      } else {
        if (!(window as any).electronAPI?.moveSampleInKit) {
          onMessage?.({
            type: "error",
            text: "Sample move not available",
          });
          return;
        }
      }

      try {
        let result;

        if (isCrossKit) {
          // Cross-kit move
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
          // Same-kit move - capture state snapshot first for reliable undo
          let stateSnapshot: any[] = [];
          if (!skipUndoRecording && onAddUndoAction) {
            const samplesResult = await (
              window as any
            ).electronAPI?.getAllSamplesForKit?.(kitName);
            if (samplesResult?.success && samplesResult.data) {
              // Get all samples in affected voices
              const affectedVoices = new Set([fromVoice, toVoice]);
              stateSnapshot = samplesResult.data
                .filter((s: any) => affectedVoices.has(s.voice_number))
                .map((s: any) => ({
                  voice: s.voice_number,
                  slot: s.slot_number, // Keep 1-based for API compatibility
                  sample: {
                    filename: s.filename,
                    source_path: s.source_path,
                    is_stereo: s.is_stereo,
                  },
                }));
            }
          }

          result = await (window as any).electronAPI.moveSampleInKit(
            kitName,
            fromVoice,
            fromSlot,
            toVoice,
            toSlot,
            mode,
          );

          // Record undo action for same-kit move
          if (
            result.success &&
            !skipUndoRecording &&
            onAddUndoAction &&
            result.data
          ) {
            const moveAction: MoveSampleAction = {
              type: "MOVE_SAMPLE",
              id: createActionId(),
              timestamp: new Date(),
              description: `Move sample from voice ${fromVoice}, slot ${fromSlot + 1} to voice ${toVoice}, slot ${toSlot + 1}`,
              data: {
                fromVoice,
                fromSlot,
                toVoice,
                toSlot,
                mode,
                movedSample: {
                  filename: result.data.movedSample.filename,
                  source_path: result.data.movedSample.source_path,
                  is_stereo: result.data.movedSample.is_stereo,
                },
                affectedSamples: result.data.affectedSamples.map(
                  (sample: any) => ({
                    voice: sample.voice_number,
                    oldSlot: sample.original_slot_number, // Use the original slot from backend
                    newSlot: sample.slot_number, // New position after move
                    sample: {
                      filename: sample.filename,
                      source_path: sample.source_path,
                      is_stereo: sample.is_stereo,
                    },
                  }),
                ),
                replacedSample: result.data.replacedSample
                  ? {
                      filename: result.data.replacedSample.filename,
                      source_path: result.data.replacedSample.source_path,
                      is_stereo: result.data.replacedSample.is_stereo,
                    }
                  : undefined,
                stateSnapshot, // Include the state snapshot for reliable undo
              },
            };
            onAddUndoAction(moveAction);
          }
        }

        // Record undo action for cross-kit move
        if (
          isCrossKit &&
          result.success &&
          !skipUndoRecording &&
          onAddUndoAction &&
          result.data
        ) {
          const crossKitMoveAction: MoveSampleBetweenKitsAction = {
            type: "MOVE_SAMPLE_BETWEEN_KITS",
            id: createActionId(),
            timestamp: new Date(),
            description: `Move sample from ${kitName} voice ${fromVoice}, slot ${fromSlot + 1} to ${targetKit} voice ${toVoice}, slot ${toSlot + 1}`,
            data: {
              fromKit: kitName,
              fromVoice,
              fromSlot,
              toKit: targetKit,
              toVoice,
              toSlot,
              mode,
              movedSample: {
                filename: result.data.movedSample.filename,
                source_path: result.data.movedSample.source_path,
                is_stereo: result.data.movedSample.is_stereo,
              },
              affectedSamples: result.data.affectedSamples.map(
                (sample: any) => ({
                  voice: sample.voice_number,
                  oldSlot: sample.original_slot_number,
                  newSlot: sample.slot_number,
                  sample: {
                    filename: sample.filename,
                    source_path: sample.source_path,
                    is_stereo: sample.is_stereo,
                  },
                }),
              ),
              replacedSample: result.data.replacedSample
                ? {
                    filename: result.data.replacedSample.filename,
                    source_path: result.data.replacedSample.source_path,
                    is_stereo: result.data.replacedSample.is_stereo,
                  }
                : undefined,
            },
          };
          onAddUndoAction(crossKitMoveAction);
        }

        if (result.success) {
          const moveDescription = isCrossKit
            ? `Sample moved from ${kitName} voice ${fromVoice}, slot ${fromSlot + 1} to ${targetKit} voice ${toVoice}, slot ${toSlot + 1}`
            : `Sample moved from voice ${fromVoice}, slot ${fromSlot + 1} to voice ${toVoice}, slot ${toSlot + 1}`;

          onMessage?.({
            type: "success",
            text: moveDescription,
          });

          // Reload samples to reflect changes
          if (onSamplesChanged) {
            await onSamplesChanged();
          }
        } else {
          onMessage?.({
            type: "error",
            text: result.error || "Failed to move sample",
          });
        }
      } catch (error) {
        onMessage?.({
          type: "error",
          text: `Failed to move sample: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
    [kitName, onSamplesChanged, onMessage, skipUndoRecording, onAddUndoAction],
  );

  return {
    handleSampleAdd,
    handleSampleReplace,
    handleSampleDelete,
    handleSampleMove,
  };
}

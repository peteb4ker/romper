// Memory-only undo/redo hook for kit editing
// Maintains undo/redo stacks in React state for immediate UI updates

import { useCallback, useEffect, useState } from "react";

import type { AnyUndoAction } from "../../../../shared/undoTypes";
import { getActionDescription } from "../../../../shared/undoTypes";

interface UndoRedoState {
  undoStack: AnyUndoAction[];
  redoStack: AnyUndoAction[];
  isUndoing: boolean;
  isRedoing: boolean;
  error: string | null;
}

export function useUndoRedo(kitName: string) {
  const [state, setState] = useState<UndoRedoState>({
    undoStack: [],
    redoStack: [],
    isUndoing: false,
    isRedoing: false,
    error: null,
  });

  // Add action to undo stack (called immediately after successful operations)
  const addAction = useCallback((action: AnyUndoAction) => {
    setState((prev) => ({
      ...prev,
      undoStack: [action, ...prev.undoStack],
      redoStack: [], // Clear redo stack when new action is added
      error: null,
    }));
  }, []);

  // Undo the most recent action
  const undo = useCallback(async () => {
    // Check if we can undo
    if (!kitName || state.undoStack.length === 0 || state.isUndoing) {
      return;
    }

    const actionToUndo = state.undoStack[0];

    setState((prev) => ({ ...prev, isUndoing: true, error: null }));

    try {
      // Execute undo via IPC - reuse existing sample operations
      // Note: Components using sample operations should skip undo recording during undo/redo
      console.log(
        "[UNDO] Starting undo execution for type:",
        actionToUndo.type,
      );
      console.log(
        "[UNDO] ElectronAPI available:",
        !!(window as any).electronAPI,
      );

      let result;
      try {
        switch (actionToUndo.type) {
          case "DELETE_SAMPLE":
            // Undo delete = add the sample back
            console.log("[UNDO] Undoing DELETE_SAMPLE - adding sample back");
            result = await (window as any).electronAPI?.addSampleToSlot?.(
              kitName,
              actionToUndo.data.voice,
              actionToUndo.data.slot,
              actionToUndo.data.deletedSample.source_path,
              { forceMono: !actionToUndo.data.deletedSample.is_stereo },
            );
            console.log("[UNDO] DELETE_SAMPLE undo result:", result);
            break;
          case "ADD_SAMPLE":
            // Undo add = delete the sample
            console.log("[UNDO] Undoing ADD_SAMPLE - deleting sample");
            result = await (window as any).electronAPI?.deleteSampleFromSlot?.(
              kitName,
              actionToUndo.data.voice,
              actionToUndo.data.slot,
            );
            console.log("[UNDO] ADD_SAMPLE undo result:", result);
            break;
          case "REPLACE_SAMPLE":
            // Undo replace = restore the old sample
            console.log("[UNDO] Undoing REPLACE_SAMPLE - restoring old sample");
            result = await (window as any).electronAPI?.replaceSampleInSlot?.(
              kitName,
              actionToUndo.data.voice,
              actionToUndo.data.slot,
              actionToUndo.data.oldSample.source_path,
              { forceMono: !actionToUndo.data.oldSample.is_stereo },
            );
            console.log("[UNDO] REPLACE_SAMPLE undo result:", result);
            break;
          case "MOVE_SAMPLE":
            // Undo move by restoring samples to their positions before this move
            // If we have a state snapshot, use it for perfect restoration
            // Otherwise, fall back to the calculated positions
            console.log("[UNDO] Undoing MOVE_SAMPLE");

            try {
              // Check if we have a state snapshot (more reliable)
              if (
                actionToUndo.data.stateSnapshot &&
                actionToUndo.data.stateSnapshot.length > 0
              ) {
                // Use snapshot-based restoration
                console.log(
                  "[UNDO] Using snapshot-based restoration, snapshot length:",
                  actionToUndo.data.stateSnapshot.length,
                );
                const affectedVoices = new Set([
                  actionToUndo.data.fromVoice,
                  actionToUndo.data.toVoice,
                ]);

                // First, we need to clear ALL samples from affected voices
                // because after the move, samples may be in different positions
                // than they were in the original snapshot

                // Get current samples in affected voices to know what to delete
                const currentSamplesResult = await (
                  window as any
                ).electronAPI?.getAllSamplesForKit?.(kitName);
                if (
                  currentSamplesResult?.success &&
                  currentSamplesResult.data
                ) {
                  const currentSamples = currentSamplesResult.data.filter(
                    (s: any) => affectedVoices.has(s.voice_number),
                  );

                  // Delete all current samples from affected voices (non-compacting)
                  for (const sample of currentSamples) {
                    await (
                      window as any
                    ).electronAPI?.deleteSampleFromSlotWithoutCompaction?.(
                      kitName,
                      sample.voice_number,
                      sample.slot_number - 1, // Convert to 0-based
                    );
                  }
                }

                // Now restore from snapshot
                for (const { voice, slot, sample } of actionToUndo.data
                  .stateSnapshot) {
                  await (window as any).electronAPI?.addSampleToSlot?.(
                    kitName,
                    voice,
                    slot - 1, // Convert from 1-based (snapshot) to 0-based (API)
                    sample.source_path,
                    { forceMono: !sample.is_stereo },
                  );
                }

                result = { success: true };
              } else {
                // Fall back to calculated restoration (legacy behavior)
                const samplesToRestore = [];

                // 1. The moved sample goes back to where it came from
                samplesToRestore.push({
                  voice: actionToUndo.data.fromVoice,
                  slot: actionToUndo.data.fromSlot,
                  sample: actionToUndo.data.movedSample,
                });

                // 2. All affected samples go back to their positions before this move
                for (const affected of actionToUndo.data.affectedSamples) {
                  samplesToRestore.push({
                    voice: affected.voice,
                    slot: affected.oldSlot,
                    sample: affected.sample,
                  });
                }

                // 3. If there was a replaced sample (overwrite mode), restore it
                if (actionToUndo.data.replacedSample) {
                  samplesToRestore.push({
                    voice: actionToUndo.data.toVoice,
                    slot: actionToUndo.data.toSlot,
                    sample: actionToUndo.data.replacedSample,
                  });
                }

                // Clear all slots that currently have samples we need to move
                const slotsToClean = new Set<string>();
                slotsToClean.add(
                  `${actionToUndo.data.toVoice}-${actionToUndo.data.toSlot}`,
                );
                for (const affected of actionToUndo.data.affectedSamples) {
                  slotsToClean.add(`${affected.voice}-${affected.newSlot}`);
                }

                // Delete all samples from slots we need to clean
                // Use non-compacting delete to avoid interfering with restoration
                for (const slotKey of slotsToClean) {
                  const [voice, slot] = slotKey.split("-").map(Number);
                  await (
                    window as any
                  ).electronAPI?.deleteSampleFromSlotWithoutCompaction?.(
                    kitName,
                    voice,
                    slot,
                  );
                }

                // Now restore all samples to their correct positions
                samplesToRestore.sort((a, b) => a.slot - b.slot);

                for (const { voice, slot, sample } of samplesToRestore) {
                  await (window as any).electronAPI?.addSampleToSlot?.(
                    kitName,
                    voice,
                    slot,
                    sample.source_path,
                    { forceMono: !sample.is_stereo },
                  );
                }

                result = { success: true };
              }
            } catch (error) {
              result = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
            break;
          case "MOVE_SAMPLE_BETWEEN_KITS":
            // Undo cross-kit move = move sample back to original kit
            try {
              result = await (
                window as any
              ).electronAPI?.moveSampleBetweenKits?.(
                actionToUndo.data.toKit, // Move from destination kit
                actionToUndo.data.toVoice, // From destination voice/slot
                actionToUndo.data.toSlot,
                actionToUndo.data.fromKit, // Back to source kit
                actionToUndo.data.fromVoice, // Back to source voice/slot
                actionToUndo.data.fromSlot,
                actionToUndo.data.mode,
              );

              // If there was a replaced sample in the original destination, restore it
              if (actionToUndo.data.replacedSample && result?.success) {
                await (window as any).electronAPI?.addSampleToSlot?.(
                  actionToUndo.data.toKit,
                  actionToUndo.data.toVoice,
                  actionToUndo.data.toSlot,
                  actionToUndo.data.replacedSample.source_path,
                  { forceMono: !actionToUndo.data.replacedSample.is_stereo },
                );
              }
            } catch (error) {
              result = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
            break;
          case "COMPACT_SLOTS":
            // Undo compaction = restore all samples to their original positions
            console.log(
              "[UNDO] Undoing COMPACT_SLOTS - restoring pre-compaction state",
            );

            try {
              // Get current samples in the affected voice to clear them first
              const currentSamplesResult = await (
                window as any
              ).electronAPI?.getAllSamplesForKit?.(kitName);
              if (currentSamplesResult?.success && currentSamplesResult.data) {
                const currentSamples = currentSamplesResult.data.filter(
                  (s: any) => s.voice_number === actionToUndo.data.voice,
                );

                // Delete all current samples from the voice (non-compacting)
                for (const sample of currentSamples) {
                  await (
                    window as any
                  ).electronAPI?.deleteSampleFromSlotWithoutCompaction?.(
                    kitName,
                    sample.voice_number,
                    sample.slot_number - 1, // Convert to 0-based
                  );
                }
              }

              // Restore the deleted sample to its original position
              await (window as any).electronAPI?.addSampleToSlot?.(
                kitName,
                actionToUndo.data.voice,
                actionToUndo.data.deletedSlot,
                actionToUndo.data.deletedSample.source_path,
                { forceMono: !actionToUndo.data.deletedSample.is_stereo },
              );

              // Restore all affected samples to their original positions (before compaction)
              for (const affectedSample of actionToUndo.data.affectedSamples) {
                await (window as any).electronAPI?.addSampleToSlot?.(
                  kitName,
                  affectedSample.voice,
                  affectedSample.newSlot, // Use newSlot (original position before compaction)
                  affectedSample.sample.source_path,
                  { forceMono: !affectedSample.sample.is_stereo },
                );
              }

              result = { success: true };
            } catch (error) {
              result = {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              };
            }
            break;
          default:
            throw new Error(
              `Unknown action type: ${(actionToUndo as any).type}`,
            );
        }
      } catch (error) {
        throw error; // Re-throw to be caught by outer try-catch
      }

      console.log("[UNDO] Final result:", result);

      if (result?.success) {
        console.log("[UNDO] Undo operation successful, updating state");
        // Move action from undo stack to redo stack
        setState((prev) => ({
          ...prev,
          undoStack: prev.undoStack.slice(1),
          redoStack: [actionToUndo, ...prev.redoStack],
          error: null,
        }));

        // Emit refresh event to update UI
        console.log("[UNDO] Emitting refresh event");
        document.dispatchEvent(
          new CustomEvent("romper:refresh-samples", {
            detail: { kitName },
          }),
        );
      } else {
        console.log(
          "[UNDO] Undo operation failed:",
          result?.error || "No error message",
        );
        setState((prev) => ({
          ...prev,
          error: result?.error || "Failed to undo action",
        }));
      }
    } catch (error) {
      console.log("[UNDO] Exception during undo:", error);
      setState((prev) => ({
        ...prev,
        error: `Failed to undo action: ${error instanceof Error ? error.message : String(error)}`,
      }));
    } finally {
      console.log(
        "[UNDO] Undo operation completed, setting isUndoing to false",
      );
      setState((prev) => ({ ...prev, isUndoing: false }));
    }
  }, [kitName, state.undoStack, state.isUndoing]);

  // Redo the most recent undone action
  const redo = useCallback(async () => {
    // Check if we can redo
    if (!kitName || state.redoStack.length === 0 || state.isRedoing) {
      return;
    }

    const actionToRedo = state.redoStack[0];

    setState((prev) => ({ ...prev, isRedoing: true, error: null }));

    try {
      // Execute redo by reversing the undo operation
      let result;
      switch (actionToRedo.type) {
        case "DELETE_SAMPLE":
          // Redo delete = delete the sample again
          result = await (window as any).electronAPI?.deleteSampleFromSlot?.(
            kitName,
            actionToRedo.data.voice,
            actionToRedo.data.slot,
          );
          break;
        case "ADD_SAMPLE":
          // Redo add = add the sample again
          result = await (window as any).electronAPI?.addSampleToSlot?.(
            kitName,
            actionToRedo.data.voice,
            actionToRedo.data.slot,
            actionToRedo.data.addedSample.source_path,
            { forceMono: !actionToRedo.data.addedSample.is_stereo },
          );
          break;
        case "REPLACE_SAMPLE":
          // Redo replace = replace with the new sample again
          result = await (window as any).electronAPI?.replaceSampleInSlot?.(
            kitName,
            actionToRedo.data.voice,
            actionToRedo.data.slot,
            actionToRedo.data.newSample.source_path,
            { forceMono: !actionToRedo.data.newSample.is_stereo },
          );
          break;
        case "MOVE_SAMPLE":
          // Redo move = move sample to the target position again
          result = await (window as any).electronAPI?.moveSampleInKit?.(
            kitName,
            actionToRedo.data.fromVoice,
            actionToRedo.data.fromSlot,
            actionToRedo.data.toVoice,
            actionToRedo.data.toSlot,
            actionToRedo.data.mode,
          );
          break;
        case "MOVE_SAMPLE_BETWEEN_KITS":
          // Redo cross-kit move = move sample to target kit again
          result = await (window as any).electronAPI?.moveSampleBetweenKits?.(
            actionToRedo.data.fromKit,
            actionToRedo.data.fromVoice,
            actionToRedo.data.fromSlot,
            actionToRedo.data.toKit,
            actionToRedo.data.toVoice,
            actionToRedo.data.toSlot,
            actionToRedo.data.mode,
          );
          break;
        case "COMPACT_SLOTS":
          // Redo compaction = delete the sample again (will trigger automatic compaction)
          result = await (window as any).electronAPI?.deleteSampleFromSlot?.(
            kitName,
            actionToRedo.data.voice,
            actionToRedo.data.deletedSlot,
          );
          break;
        default:
          throw new Error(`Unknown action type: ${(actionToRedo as any).type}`);
      }

      if (result?.success) {
        // Move action from redo stack back to undo stack
        setState((prev) => ({
          ...prev,
          redoStack: prev.redoStack.slice(1),
          undoStack: [actionToRedo, ...prev.undoStack],
          error: null,
        }));

        // Emit refresh event to update UI
        document.dispatchEvent(
          new CustomEvent("romper:refresh-samples", {
            detail: { kitName },
          }),
        );
      } else {
        setState((prev) => ({
          ...prev,
          error: result?.error || "Failed to redo action",
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Failed to redo action: ${error instanceof Error ? error.message : String(error)}`,
      }));
    } finally {
      setState((prev) => ({ ...prev, isRedoing: false }));
    }
  }, [kitName, state.redoStack, state.isRedoing]);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Clear stacks when kit changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      undoStack: [],
      redoStack: [],
      error: null,
    }));
  }, [kitName]);

  return {
    // State
    canUndo: state.undoStack.length > 0 && !state.isUndoing,
    canRedo: state.redoStack.length > 0 && !state.isRedoing,
    isUndoing: state.isUndoing,
    isRedoing: state.isRedoing,
    error: state.error,
    undoCount: state.undoStack.length,
    redoCount: state.redoStack.length,

    // Actions
    undo,
    redo,
    addAction, // New: add actions immediately to stack
    clearError,

    // Descriptions
    undoDescription:
      state.undoStack.length > 0
        ? getActionDescription(state.undoStack[0])
        : null,
    redoDescription:
      state.redoStack.length > 0
        ? getActionDescription(state.redoStack[0])
        : null,
  };
}

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

  // Helper functions for undo operations
  const undoDeleteSample = async (action: any) => {
    console.log("[UNDO] Undoing DELETE_SAMPLE - adding sample back");
    const result = await (window as any).electronAPI?.addSampleToSlot?.(
      kitName,
      action.data.voice,
      action.data.slot,
      action.data.deletedSample.source_path,
      { forceMono: !action.data.deletedSample.is_stereo },
    );
    console.log("[UNDO] DELETE_SAMPLE undo result:", result);
    return result;
  };

  const undoAddSample = async (action: any) => {
    console.log("[UNDO] Undoing ADD_SAMPLE - deleting sample");
    const result = await (window as any).electronAPI?.deleteSampleFromSlot?.(
      kitName,
      action.data.voice,
      action.data.slot,
    );
    console.log("[UNDO] ADD_SAMPLE undo result:", result);
    return result;
  };

  const undoReplaceSample = async (action: any) => {
    console.log("[UNDO] Undoing REPLACE_SAMPLE - restoring old sample");
    const result = await (window as any).electronAPI?.replaceSampleInSlot?.(
      kitName,
      action.data.voice,
      action.data.slot,
      action.data.oldSample.source_path,
      { forceMono: !action.data.oldSample.is_stereo },
    );
    console.log("[UNDO] REPLACE_SAMPLE undo result:", result);
    return result;
  };

  const undoMoveSampleWithSnapshot = async (action: any) => {
    console.log(
      "[UNDO] Using snapshot-based restoration, snapshot length:",
      action.data.stateSnapshot.length,
    );
    const affectedVoices = new Set([
      action.data.fromVoice,
      action.data.toVoice,
    ]);

    // Clear affected voices first
    const currentSamplesResult = await (
      window as any
    ).electronAPI?.getAllSamplesForKit?.(kitName);
    if (currentSamplesResult?.success && currentSamplesResult.data) {
      const currentSamples = currentSamplesResult.data.filter((s: any) =>
        affectedVoices.has(s.voice_number),
      );

      for (const sample of currentSamples) {
        await (
          window as any
        ).electronAPI?.deleteSampleFromSlotWithoutCompaction?.(
          kitName,
          sample.voice_number,
          sample.slot_number - 1,
        );
      }
    }

    // Restore from snapshot
    for (const { voice, slot, sample } of action.data.stateSnapshot) {
      await (window as any).electronAPI?.addSampleToSlot?.(
        kitName,
        voice,
        slot - 1,
        sample.source_path,
        { forceMono: !sample.is_stereo },
      );
    }

    return { success: true };
  };

  const undoMoveSampleLegacy = async (action: any) => {
    const samplesToRestore = [];

    // Restore moved sample to original position
    samplesToRestore.push({
      voice: action.data.fromVoice,
      slot: action.data.fromSlot,
      sample: action.data.movedSample,
    });

    // Restore affected samples
    for (const affected of action.data.affectedSamples) {
      samplesToRestore.push({
        voice: affected.voice,
        slot: affected.oldSlot,
        sample: affected.sample,
      });
    }

    // Restore replaced sample if any
    if (action.data.replacedSample) {
      samplesToRestore.push({
        voice: action.data.toVoice,
        slot: action.data.toSlot,
        sample: action.data.replacedSample,
      });
    }

    // Clean slots that need to be cleared
    const slotsToClean = new Set<string>();
    slotsToClean.add(`${action.data.toVoice}-${action.data.toSlot}`);
    for (const affected of action.data.affectedSamples) {
      slotsToClean.add(`${affected.voice}-${affected.newSlot}`);
    }

    // Delete samples from slots to be cleaned
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

    // Restore samples in correct order
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

    return { success: true };
  };

  const undoMoveSample = async (action: any) => {
    console.log("[UNDO] Undoing MOVE_SAMPLE");
    try {
      if (action.data.stateSnapshot && action.data.stateSnapshot.length > 0) {
        return await undoMoveSampleWithSnapshot(action);
      } else {
        return await undoMoveSampleLegacy(action);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const undoMoveSampleBetweenKits = async (action: any) => {
    try {
      const result = await (window as any).electronAPI?.moveSampleBetweenKits?.(
        action.data.toKit,
        action.data.toVoice,
        action.data.toSlot,
        action.data.fromKit,
        action.data.fromVoice,
        action.data.fromSlot,
        action.data.mode,
      );

      // Restore replaced sample if any
      if (action.data.replacedSample && result?.success) {
        await (window as any).electronAPI?.addSampleToSlot?.(
          action.data.toKit,
          action.data.toVoice,
          action.data.toSlot,
          action.data.replacedSample.source_path,
          { forceMono: !action.data.replacedSample.is_stereo },
        );
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const undoCompactSlots = async (action: any) => {
    console.log(
      "[UNDO] Undoing COMPACT_SLOTS - restoring pre-compaction state",
    );
    try {
      // Clear current samples in the voice
      const currentSamplesResult = await (
        window as any
      ).electronAPI?.getAllSamplesForKit?.(kitName);
      if (currentSamplesResult?.success && currentSamplesResult.data) {
        const currentSamples = currentSamplesResult.data.filter(
          (s: any) => s.voice_number === action.data.voice,
        );

        for (const sample of currentSamples) {
          await (
            window as any
          ).electronAPI?.deleteSampleFromSlotWithoutCompaction?.(
            kitName,
            sample.voice_number,
            sample.slot_number - 1,
          );
        }
      }

      // Restore deleted sample
      await (window as any).electronAPI?.addSampleToSlot?.(
        kitName,
        action.data.voice,
        action.data.deletedSlot,
        action.data.deletedSample.source_path,
        { forceMono: !action.data.deletedSample.is_stereo },
      );

      // Restore affected samples to original positions
      for (const affectedSample of action.data.affectedSamples) {
        await (window as any).electronAPI?.addSampleToSlot?.(
          kitName,
          affectedSample.voice,
          affectedSample.newSlot,
          affectedSample.sample.source_path,
          { forceMono: !affectedSample.sample.is_stereo },
        );
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const executeUndoAction = async (action: any) => {
    switch (action.type) {
      case "DELETE_SAMPLE":
        return await undoDeleteSample(action);
      case "ADD_SAMPLE":
        return await undoAddSample(action);
      case "REPLACE_SAMPLE":
        return await undoReplaceSample(action);
      case "MOVE_SAMPLE":
        return await undoMoveSample(action);
      case "MOVE_SAMPLE_BETWEEN_KITS":
        return await undoMoveSampleBetweenKits(action);
      case "COMPACT_SLOTS":
        return await undoCompactSlots(action);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  };

  const handleUndoResult = (result: any, actionToUndo: any) => {
    console.log("[UNDO] Final result:", result);

    if (result?.success) {
      console.log("[UNDO] Undo operation successful, updating state");
      setState((prev) => ({
        ...prev,
        undoStack: prev.undoStack.slice(1),
        redoStack: [actionToUndo, ...prev.redoStack],
        error: null,
      }));

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
  };

  // Undo the most recent action
  const undo = useCallback(async () => {
    if (!kitName || state.undoStack.length === 0 || state.isUndoing) {
      return;
    }

    const actionToUndo = state.undoStack[0];
    setState((prev) => ({ ...prev, isUndoing: true, error: null }));

    try {
      console.log(
        "[UNDO] Starting undo execution for type:",
        actionToUndo.type,
      );
      console.log(
        "[UNDO] ElectronAPI available:",
        !!(window as any).electronAPI,
      );

      const result = await executeUndoAction(actionToUndo);
      handleUndoResult(result, actionToUndo);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

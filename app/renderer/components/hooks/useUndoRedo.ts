// Memory-only undo/redo hook for kit editing
// Maintains undo/redo stacks in React state for immediate UI updates

import { useCallback, useEffect, useState } from "react";

import type { AnyUndoAction } from "../../../../shared/undoTypes";

import { getActionDescription } from "../../../../shared/undoTypes";

interface UndoRedoState {
  error: null | string;
  isRedoing: boolean;
  isUndoing: boolean;
  redoStack: AnyUndoAction[];
  undoStack: AnyUndoAction[];
}

export function useUndoRedo(kitName: string) {
  const [state, setState] = useState<UndoRedoState>({
    error: null,
    isRedoing: false,
    isUndoing: false,
    redoStack: [],
    undoStack: [],
  });

  // Add action to undo stack (called immediately after successful operations)
  const addAction = useCallback((action: AnyUndoAction) => {
    setState((prev) => ({
      ...prev,
      error: null,
      redoStack: [], // Clear redo stack when new action is added
      undoStack: [action, ...prev.undoStack],
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

    await clearAffectedVoices(action.data.fromVoice, action.data.toVoice);
    await restoreFromSnapshot(action.data.stateSnapshot);

    return { success: true };
  };

  const clearAffectedVoices = async (fromVoice: number, toVoice: number) => {
    const affectedVoices = new Set([fromVoice, toVoice]);
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
  };

  const restoreFromSnapshot = async (stateSnapshot: any[]) => {
    for (const { sample, slot, voice } of stateSnapshot) {
      await (window as any).electronAPI?.addSampleToSlot?.(
        kitName,
        voice,
        slot - 1,
        sample.source_path,
        { forceMono: !sample.is_stereo },
      );
    }
  };

  const undoMoveSampleLegacy = async (action: any) => {
    const samplesToRestore = buildSamplesToRestore(action);
    const slotsToClean = buildSlotsToClean(action);

    await cleanSlots(slotsToClean);
    await restoreSamples(samplesToRestore);

    return { success: true };
  };

  const buildSamplesToRestore = (action: any) => {
    const samples = [];

    // Restore moved sample to original position
    samples.push({
      sample: action.data.movedSample,
      slot: action.data.fromSlot,
      voice: action.data.fromVoice,
    });

    // Restore affected samples
    for (const affected of action.data.affectedSamples) {
      samples.push({
        sample: affected.sample,
        slot: affected.oldSlot,
        voice: affected.voice,
      });
    }

    // Restore replaced sample if any
    if (action.data.replacedSample) {
      samples.push({
        sample: action.data.replacedSample,
        slot: action.data.toSlot,
        voice: action.data.toVoice,
      });
    }

    return samples;
  };

  const buildSlotsToClean = (action: any) => {
    const slotsToClean = new Set<string>();
    slotsToClean.add(`${action.data.toVoice}-${action.data.toSlot}`);

    for (const affected of action.data.affectedSamples) {
      slotsToClean.add(`${affected.voice}-${affected.newSlot}`);
    }

    return slotsToClean;
  };

  const cleanSlots = async (slotsToClean: Set<string>) => {
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
  };

  const restoreSamples = async (samplesToRestore: any[]) => {
    const sortedSamples = [...samplesToRestore].sort((a, b) => a.slot - b.slot);

    for (const { sample, slot, voice } of sortedSamples) {
      await (window as any).electronAPI?.addSampleToSlot?.(
        kitName,
        voice,
        slot,
        sample.source_path,
        { forceMono: !sample.is_stereo },
      );
    }
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
        error: error instanceof Error ? error.message : String(error),
        success: false,
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
        error: error instanceof Error ? error.message : String(error),
        success: false,
      };
    }
  };

  const undoCompactSlots = async (action: any) => {
    console.log(
      "[UNDO] Undoing COMPACT_SLOTS - restoring pre-compaction state",
    );

    try {
      await clearCurrentVoiceSamples(action.data.voice);
      await restoreDeletedSample(action.data);
      await restoreAffectedSamples(action.data.affectedSamples);

      return { success: true };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        success: false,
      };
    }
  };

  const clearCurrentVoiceSamples = async (voice: number) => {
    const currentSamplesResult = await (
      window as any
    ).electronAPI?.getAllSamplesForKit?.(kitName);

    if (currentSamplesResult?.success && currentSamplesResult.data) {
      const currentSamples = currentSamplesResult.data.filter(
        (s: any) => s.voice_number === voice,
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
  };

  const restoreDeletedSample = async (actionData: any) => {
    await (window as any).electronAPI?.addSampleToSlot?.(
      kitName,
      actionData.voice,
      actionData.deletedSlot,
      actionData.deletedSample.source_path,
      { forceMono: !actionData.deletedSample.is_stereo },
    );
  };

  const restoreAffectedSamples = async (affectedSamples: any[]) => {
    for (const affectedSample of affectedSamples) {
      await (window as any).electronAPI?.addSampleToSlot?.(
        kitName,
        affectedSample.voice,
        affectedSample.newSlot,
        affectedSample.sample.source_path,
        { forceMono: !affectedSample.sample.is_stereo },
      );
    }
  };

  const executeUndoAction = async (action: any) => {
    switch (action.type) {
      case "ADD_SAMPLE":
        return await undoAddSample(action);
      case "COMPACT_SLOTS":
        return await undoCompactSlots(action);
      case "DELETE_SAMPLE":
        return await undoDeleteSample(action);
      case "MOVE_SAMPLE":
        return await undoMoveSample(action);
      case "MOVE_SAMPLE_BETWEEN_KITS":
        return await undoMoveSampleBetweenKits(action);
      case "REPLACE_SAMPLE":
        return await undoReplaceSample(action);
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
        error: null,
        redoStack: [actionToUndo, ...prev.redoStack],
        undoStack: prev.undoStack.slice(1),
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
    setState((prev) => ({ ...prev, error: null, isUndoing: true }));

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

  // Helper functions to reduce cognitive complexity in redo
  const executeRedoAction = async (action: any) => {
    const redoOperations = {
      ADD_SAMPLE: () =>
        (window as any).electronAPI?.addSampleToSlot?.(
          kitName,
          action.data.voice,
          action.data.slot,
          action.data.addedSample.source_path,
          { forceMono: !action.data.addedSample.is_stereo },
        ),
      COMPACT_SLOTS: () =>
        (window as any).electronAPI?.deleteSampleFromSlot?.(
          kitName,
          action.data.voice,
          action.data.deletedSlot,
        ),
      DELETE_SAMPLE: () =>
        (window as any).electronAPI?.deleteSampleFromSlot?.(
          kitName,
          action.data.voice,
          action.data.slot,
        ),
      MOVE_SAMPLE: () =>
        (window as any).electronAPI?.moveSampleInKit?.(
          kitName,
          action.data.fromVoice,
          action.data.fromSlot,
          action.data.toVoice,
          action.data.toSlot,
          action.data.mode,
        ),
      MOVE_SAMPLE_BETWEEN_KITS: () =>
        (window as any).electronAPI?.moveSampleBetweenKits?.(
          action.data.fromKit,
          action.data.fromVoice,
          action.data.fromSlot,
          action.data.toKit,
          action.data.toVoice,
          action.data.toSlot,
          action.data.mode,
        ),
      REPLACE_SAMPLE: () =>
        (window as any).electronAPI?.replaceSampleInSlot?.(
          kitName,
          action.data.voice,
          action.data.slot,
          action.data.newSample.source_path,
          { forceMono: !action.data.newSample.is_stereo },
        ),
    };

    const operation =
      redoOperations[action.type as keyof typeof redoOperations];
    if (!operation) {
      throw new Error(`Unknown action type: ${action.type}`);
    }

    return await operation();
  };

  const handleRedoSuccess = (actionToRedo: any) => {
    setState((prev) => ({
      ...prev,
      error: null,
      redoStack: prev.redoStack.slice(1),
      undoStack: [actionToRedo, ...prev.undoStack],
    }));

    document.dispatchEvent(
      new CustomEvent("romper:refresh-samples", {
        detail: { kitName },
      }),
    );
  };

  const handleRedoError = (error: any) => {
    setState((prev) => ({
      ...prev,
      error: `Failed to redo action: ${error instanceof Error ? error.message : String(error)}`,
    }));
  };

  // Redo the most recent undone action
  const redo = useCallback(async () => {
    if (!kitName || state.redoStack.length === 0 || state.isRedoing) {
      return;
    }

    const actionToRedo = state.redoStack[0];
    setState((prev) => ({ ...prev, error: null, isRedoing: true }));

    try {
      const result = await executeRedoAction(actionToRedo);

      if (result?.success) {
        handleRedoSuccess(actionToRedo);
      } else {
        setState((prev) => ({
          ...prev,
          error: result?.error || "Failed to redo action",
        }));
      }
    } catch (error) {
      handleRedoError(error);
    } finally {
      setState((prev) => ({ ...prev, isRedoing: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kitName, state.redoStack, state.isRedoing]);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Clear stacks when kit changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      error: null,
      redoStack: [],
      undoStack: [],
    }));
  }, [kitName]);

  return {
    addAction, // New: add actions immediately to stack
    canRedo: state.redoStack.length > 0 && !state.isRedoing,
    // State
    canUndo: state.undoStack.length > 0 && !state.isUndoing,
    clearError,
    error: state.error,
    isRedoing: state.isRedoing,
    isUndoing: state.isUndoing,

    redo,
    redoCount: state.redoStack.length,
    redoDescription:
      state.redoStack.length > 0
        ? getActionDescription(state.redoStack[0])
        : null,
    // Actions
    undo,

    undoCount: state.undoStack.length,
    // Descriptions
    undoDescription:
      state.undoStack.length > 0
        ? getActionDescription(state.undoStack[0])
        : null,
  };
}

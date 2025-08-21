import type { Sample } from "@romper/shared/db/schema.js";
import type {
  AddSampleAction,
  AnyUndoAction,
  DeleteSampleAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
  ReindexSamplesAction,
  ReplaceSampleAction,
} from "@romper/shared/undoTypes";

import { dbSlotToUiSlot } from "@romper/shared/slotUtils";

export interface UseUndoActionHandlersOptions {
  kitName: string;
}

interface SampleToRestore {
  sample: {
    filename: string;
    is_stereo: boolean;
    source_path: string;
  };
  slot: number;
  voice: number;
}

// Type interfaces for undo action data structures
interface StateSnapshotItem {
  sample: {
    filename: string;
    is_stereo: boolean;
    source_path: string;
  };
  slot: number;
  voice: number;
}

/**
 * Hook for handling undo operations for different action types
 * Extracted from useUndoRedo to reduce complexity
 */
export function useUndoActionHandlers({
  kitName,
}: UseUndoActionHandlersOptions) {
  // Helper functions for clearing and restoring samples
  const clearAffectedVoices = async (fromVoice: number, toVoice: number) => {
    const affectedVoices = new Set([fromVoice, toVoice]);
    const currentSamplesResult =
      await window.electronAPI?.getAllSamplesForKit?.(kitName);

    if (currentSamplesResult?.success && currentSamplesResult.data) {
      const currentSamples = (currentSamplesResult.data as Sample[]).filter(
        (s) => affectedVoices.has(s.voice_number),
      );

      for (const sample of currentSamples) {
        await window.electronAPI?.deleteSampleFromSlotWithoutReindexing?.(
          kitName,
          sample.voice_number,
          dbSlotToUiSlot(sample.slot_number) - 1,
        );
      }
    }
  };

  const restoreFromSnapshot = async (stateSnapshot: StateSnapshotItem[]) => {
    for (const { sample, slot, voice } of stateSnapshot) {
      // Convert database slot to 0-based slot number for API call
      const apiSlotNumber = dbSlotToUiSlot(slot) - 1;
      await window.electronAPI?.addSampleToSlot?.(
        kitName,
        voice,
        apiSlotNumber,
        sample.source_path,
        { forceMono: !sample.is_stereo },
      );
    }
  };

  const clearCurrentVoiceSamples = async (voice: number) => {
    const currentSamplesResult =
      await window.electronAPI?.getAllSamplesForKit?.(kitName);

    if (currentSamplesResult?.success && currentSamplesResult.data) {
      const currentSamples = (currentSamplesResult.data as Sample[]).filter(
        (s) => s.voice_number === voice,
      );

      for (const sample of currentSamples) {
        await window.electronAPI?.deleteSampleFromSlotWithoutReindexing?.(
          kitName,
          sample.voice_number,
          dbSlotToUiSlot(sample.slot_number) - 1,
        );
      }
    }
  };

  const cleanSlots = async (slotsToClean: Set<string>) => {
    for (const slotKey of slotsToClean) {
      const [voice, slot] = slotKey.split("-").map(Number);
      await window.electronAPI?.deleteSampleFromSlotWithoutReindexing?.(
        kitName,
        voice,
        slot,
      );
    }
  };

  const restoreSamples = async (samplesToRestore: SampleToRestore[]) => {
    const sortedSamples = [...samplesToRestore].sort((a, b) => a.slot - b.slot);

    for (const { sample, slot, voice } of sortedSamples) {
      await window.electronAPI?.addSampleToSlot?.(
        kitName,
        voice,
        slot,
        sample.source_path,
        { forceMono: !sample.is_stereo },
      );
    }
  };

  // Individual undo action handlers
  const undoDeleteSample = async (action: DeleteSampleAction) => {
    console.log("[UNDO] Undoing DELETE_SAMPLE - adding sample back");
    const result = await window.electronAPI?.addSampleToSlot?.(
      kitName,
      action.data.voice,
      action.data.slot,
      action.data.deletedSample.source_path,
      { forceMono: !action.data.deletedSample.is_stereo },
    );
    console.log("[UNDO] DELETE_SAMPLE undo result:", result);
    return result;
  };

  const undoAddSample = async (action: AddSampleAction) => {
    console.log("[UNDO] Undoing ADD_SAMPLE - deleting sample");
    const result = await window.electronAPI?.deleteSampleFromSlot?.(
      kitName,
      action.data.voice,
      action.data.slot,
    );
    console.log("[UNDO] ADD_SAMPLE undo result:", result);
    return result;
  };

  const undoReplaceSample = async (action: ReplaceSampleAction) => {
    console.log("[UNDO] Undoing REPLACE_SAMPLE - restoring old sample");
    const result = await window.electronAPI?.replaceSampleInSlot?.(
      kitName,
      action.data.voice,
      action.data.slot,
      action.data.oldSample.source_path,
      { forceMono: !action.data.oldSample.is_stereo },
    );
    console.log("[UNDO] REPLACE_SAMPLE undo result:", result);
    return result;
  };

  const undoMoveSampleWithSnapshot = async (action: MoveSampleAction) => {
    console.log(
      "[UNDO] Using snapshot-based restoration, snapshot length:",
      action.data.stateSnapshot?.length || 0,
    );

    await clearAffectedVoices(action.data.fromVoice, action.data.toVoice);
    if (action.data.stateSnapshot) {
      await restoreFromSnapshot(action.data.stateSnapshot);
    }

    return { success: true };
  };

  const buildSamplesToRestore = (action: MoveSampleAction) => {
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

  const buildSlotsToClean = (action: MoveSampleAction) => {
    const slotsToClean = new Set<string>();
    slotsToClean.add(`${action.data.toVoice}-${action.data.toSlot}`);

    for (const affected of action.data.affectedSamples) {
      slotsToClean.add(`${affected.voice}-${affected.newSlot}`);
    }

    return slotsToClean;
  };

  const undoMoveSampleLegacy = async (action: MoveSampleAction) => {
    const samplesToRestore = buildSamplesToRestore(action);
    const slotsToClean = buildSlotsToClean(action);

    await cleanSlots(slotsToClean);
    await restoreSamples(samplesToRestore);

    return { success: true };
  };

  const undoMoveSample = async (action: MoveSampleAction) => {
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

  const undoMoveSampleBetweenKits = async (
    action: MoveSampleBetweenKitsAction,
  ) => {
    try {
      const result = await window.electronAPI?.moveSampleBetweenKits?.(
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
        await window.electronAPI?.addSampleToSlot?.(
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

  const restoreDeletedSample = async (
    actionData: ReindexSamplesAction["data"],
  ) => {
    await window.electronAPI?.addSampleToSlot?.(
      kitName,
      actionData.voice,
      actionData.deletedSlot,
      actionData.deletedSample.source_path,
      { forceMono: !actionData.deletedSample.is_stereo },
    );
  };

  const restoreAffectedSamples = async (
    affectedSamples: ReindexSamplesAction["data"]["affectedSamples"],
  ) => {
    for (const affectedSample of affectedSamples) {
      await window.electronAPI?.addSampleToSlot?.(
        kitName,
        affectedSample.voice,
        affectedSample.newSlot,
        affectedSample.sample.source_path,
        { forceMono: !affectedSample.sample.is_stereo },
      );
    }
  };

  const undoReindexSamples = async (action: ReindexSamplesAction) => {
    console.log(
      "[UNDO] Undoing REINDEX_SAMPLES - restoring pre-reindexing state",
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

  // Main undo action executor
  const executeUndoAction = async (action: AnyUndoAction) => {
    switch (action.type) {
      case "ADD_SAMPLE":
        return await undoAddSample(action);
      case "DELETE_SAMPLE":
        return await undoDeleteSample(action);
      case "MOVE_SAMPLE":
        return await undoMoveSample(action);
      case "MOVE_SAMPLE_BETWEEN_KITS":
        return await undoMoveSampleBetweenKits(action);
      case "REINDEX_SAMPLES":
        return await undoReindexSamples(action);
      case "REPLACE_SAMPLE":
        return await undoReplaceSample(action);
      default: {
        const _exhaustiveCheck: never = action;
        throw new Error(
          `Unknown action type: ${(_exhaustiveCheck as any).type}`,
        );
      }
    }
  };

  return {
    executeUndoAction,
  };
}

import type { AnyUndoAction } from "@romper/shared/undoTypes";

export interface UseUndoActionHandlersOptions {
  kitName: string;
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

  // Individual undo action handlers
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

  const undoMoveSampleLegacy = async (action: any) => {
    const samplesToRestore = buildSamplesToRestore(action);
    const slotsToClean = buildSlotsToClean(action);

    await cleanSlots(slotsToClean);
    await restoreSamples(samplesToRestore);

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

  // Main undo action executor
  const executeUndoAction = async (action: AnyUndoAction) => {
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

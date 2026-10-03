import type {
  AddSampleAction,
  AnyUndoAction,
  DeleteSampleAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
  ReindexSamplesAction,
  ReplaceSampleAction,
  VoiceSnapshot,
} from "@romper/shared/undoTypes";

import { createLogger } from "../../../utils/logger";
import { writeSequenceSnapshot } from "./sequenceUndo";

const log = createLogger("UNDO");

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
  /**
   * Put the voices an edit touched back as they were before it: one
   * transactional call that restores full rows, gain included (RE-86)
   */
  const restoreVoices = async (voicesBefore: VoiceSnapshot[]) => {
    const restore = globalThis.electronAPI?.restoreKitVoices;
    if (!restore) {
      return { error: "Undo isn't available", success: false };
    }
    return restore(kitName, voicesBefore);
  };

  // Individual undo action handlers
  const undoDeleteSample = async (action: DeleteSampleAction) => {
    log.debug(" Undoing DELETE_SAMPLE - adding sample back");
    const result = await globalThis.electronAPI?.addSampleToSlot?.(
      kitName,
      action.data.voice,
      action.data.slot,
      action.data.deletedSample.source_path,
    );
    log.debug(" DELETE_SAMPLE undo result:", result);
    return result;
  };

  const undoAddSample = async (action: AddSampleAction) => {
    log.debug(" Undoing ADD_SAMPLE - deleting sample");
    const result = await globalThis.electronAPI?.deleteSampleFromSlot?.(
      kitName,
      action.data.voice,
      action.data.slot,
    );
    log.debug(" ADD_SAMPLE undo result:", result);
    return result;
  };

  const undoReplaceSample = async (action: ReplaceSampleAction) => {
    log.debug(" Undoing REPLACE_SAMPLE - restoring the voice");
    return restoreVoices(action.data.voicesBefore);
  };

  const undoMoveSample = async (action: MoveSampleAction) => {
    log.debug(" Undoing MOVE_SAMPLE - restoring both voices");
    return restoreVoices(action.data.voicesBefore);
  };

  const undoMoveSampleBetweenKits = async (
    action: MoveSampleBetweenKitsAction,
  ) => {
    try {
      const result = await globalThis.electronAPI?.moveSampleBetweenKits?.(
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
        await globalThis.electronAPI?.addSampleToSlot?.(
          action.data.toKit,
          action.data.toVoice,
          action.data.toSlot,
          action.data.replacedSample.source_path,
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

  const undoReindexSamples = async (action: ReindexSamplesAction) => {
    log.debug("Undoing REINDEX_SAMPLES - restoring the voice");
    return restoreVoices(action.data.voicesBefore);
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
      case "SEQUENCE_EDIT":
        return await writeSequenceSnapshot(
          kitName,
          action.data.before,
          action.data.after,
        );
      default:
        throw new Error(
          `Unknown action type: ${(action as AnyUndoAction).type}`,
        );
    }
  };

  return {
    executeUndoAction,
  };
}

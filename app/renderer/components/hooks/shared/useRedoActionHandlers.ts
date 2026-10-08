import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { writeSequenceSnapshot } from "./sequenceUndo";

export interface UseRedoActionHandlersOptions {
  kitName: string;
}

/**
 * Hook for handling redo operations for different action types
 * Extracted from useUndoRedo to reduce complexity
 */
export function useRedoActionHandlers({
  kitName,
}: UseRedoActionHandlersOptions) {
  // Main redo action executor
  const executeRedoAction = async (action: AnyUndoAction) => {
    switch (action.type) {
      case "ADD_SAMPLE":
        return globalThis.electronAPI?.addSampleToSlot?.(
          kitName,
          action.data.voice,
          action.data.slot,
          action.data.addedSample.source_path,
        );
      case "DELETE_SAMPLE":
        return globalThis.electronAPI?.deleteSampleFromSlot?.(
          kitName,
          action.data.voice,
          action.data.slot,
        );
      case "MOVE_SAMPLE":
        return globalThis.electronAPI?.moveSampleInKit?.(
          kitName,
          action.data.fromVoice,
          action.data.fromSlot,
          action.data.toVoice,
          action.data.toSlot,
        );
      case "MOVE_SAMPLE_BETWEEN_KITS":
        return globalThis.electronAPI?.moveSampleBetweenKits?.(
          action.data.fromKit,
          action.data.fromVoice,
          action.data.fromSlot,
          action.data.toKit,
          action.data.toVoice,
          action.data.toSlot,
          action.data.mode,
        );
      case "REINDEX_SAMPLES":
        return globalThis.electronAPI?.deleteSampleFromSlot?.(
          kitName,
          action.data.voice,
          action.data.deletedSlot,
        );
      case "SEQUENCE_EDIT":
        return writeSequenceSnapshot(
          kitName,
          action.data.after,
          action.data.before,
        );
      default:
        throw new Error(
          `Unknown action type: ${(action as AnyUndoAction).type}`,
        );
    }
  };

  return {
    executeRedoAction,
  };
}

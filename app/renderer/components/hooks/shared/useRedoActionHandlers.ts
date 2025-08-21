import type { AnyUndoAction } from "@romper/shared/undoTypes";

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
        return window.electronAPI?.addSampleToSlot?.(
          kitName,
          action.data.voice,
          action.data.slot,
          action.data.addedSample.source_path,
          { forceMono: !action.data.addedSample.is_stereo },
        );
      case "DELETE_SAMPLE":
        return window.electronAPI?.deleteSampleFromSlot?.(
          kitName,
          action.data.voice,
          action.data.slot,
        );
      case "MOVE_SAMPLE":
        return window.electronAPI?.moveSampleInKit?.(
          kitName,
          action.data.fromVoice,
          action.data.fromSlot,
          action.data.toVoice,
          action.data.toSlot,
        );
      case "MOVE_SAMPLE_BETWEEN_KITS":
        return window.electronAPI?.moveSampleBetweenKits?.(
          action.data.fromKit,
          action.data.fromVoice,
          action.data.fromSlot,
          action.data.toKit,
          action.data.toVoice,
          action.data.toSlot,
          action.data.mode,
        );
      case "REINDEX_SAMPLES":
        return window.electronAPI?.deleteSampleFromSlot?.(
          kitName,
          action.data.voice,
          action.data.deletedSlot,
        );
      case "REPLACE_SAMPLE":
        return window.electronAPI?.replaceSampleInSlot?.(
          kitName,
          action.data.voice,
          action.data.slot,
          action.data.newSample.source_path,
          { forceMono: !action.data.newSample.is_stereo },
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

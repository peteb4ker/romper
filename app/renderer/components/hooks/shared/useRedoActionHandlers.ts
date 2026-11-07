import type {
  AnyUndoAction,
  RemoveMissingSamplesAction,
  RestoreMissingFileAction,
} from "@romper/shared/undoTypes";

import { restoredFoundPath } from "../kit-management/findMissingFiles";
import { requestKitRefresh } from "../kit-management/removeMissingSamples";
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
      case "REMOVE_MISSING_SAMPLES":
        return redoRemoveMissingSamples(action);
      case "RESTORE_MISSING_FILE":
        return redoRestoreMissingFile(action);
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

/**
 * Remove the kit's missing samples again (#822). Main checks the files
 * again, so what goes may differ from the first time: the entry keeps what
 * this removal returned, which is what the next undo puts back.
 */
async function redoRemoveMissingSamples(action: RemoveMissingSamplesAction) {
  const { kitName } = action.data;
  const result = await globalThis.electronAPI?.removeMissingSamples?.(kitName);
  if (result?.success && result.data) {
    action.data.samples = result.data.samples;
    action.data.voicesBefore = result.data.voicesBefore;
    requestKitRefresh(kitName);
  }
  return result;
}

/**
 * Put the found file back again (#823). Main checks everything again; the
 * entry keeps what this restore did, which is what the next undo reverses.
 */
async function redoRestoreMissingFile(action: RestoreMissingFileAction) {
  const { kitName, restored } = action.data;
  const result = await globalThis.electronAPI?.restoreMissingFile?.(kitName, {
    foundPath: restoredFoundPath(restored),
    kind: "restore",
    sampleId: restored.sampleId,
  });
  if (result?.success && result.data?.restored) {
    action.data.restored = result.data.restored;
    requestKitRefresh(kitName);
  }
  return result;
}

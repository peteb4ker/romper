import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { snapshotVoices } from "@romper/shared/undoTypes";
import { useCallback } from "react";

import type { MoveOperationResult } from "./types";

import { useSampleManagementUndoActions } from "./useSampleManagementUndoActions";

export interface UseSampleManagementMoveOpsOptions {
  kitName: string;
  onAddUndoAction?: (action: AnyUndoAction) => void;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onSamplesChanged?: () => Promise<void>;
  skipUndoRecording: boolean;
}

/**
 * Hook for sample move operations (within kit and cross-kit)
 * Extracted from useSampleManagement to reduce complexity
 */
export function useSampleManagementMoveOps({
  kitName,
  onAddUndoAction,
  onMessage,
  onSamplesChanged,
  skipUndoRecording,
}: UseSampleManagementMoveOpsOptions) {
  // Get undo action creators
  const undoActions = useSampleManagementUndoActions({
    kitName,
    skipUndoRecording,
  });

  // Helper functions to reduce cognitive complexity in handleSampleMove
  const validateMoveAPI = useCallback(
    (isCrossKit: boolean) => {
      if (isCrossKit) {
        if (!globalThis.electronAPI?.moveSampleBetweenKits) {
          onMessage?.("Cross-kit sample move not available", "error");
          return false;
        }
      } else if (!globalThis.electronAPI?.moveSampleInKit) {
        onMessage?.("Sample move not available", "error");
        return false;
      }
      return true;
    },
    [onMessage],
  );

  const captureStateSnapshot = useCallback(
    async (fromVoice: number, toVoice: number) => {
      // Null, not an empty list: restoring "no samples" would empty the
      // voices, so a move whose voices couldn't be read records no undo
      if (skipUndoRecording || !onAddUndoAction) return null;

      const samplesResult =
        await globalThis.electronAPI?.getAllSamplesForKit?.(kitName);
      if (!samplesResult?.success || !samplesResult.data) return null;

      // Full rows, so undo brings back gain and WAV details too (RE-86)
      return snapshotVoices(samplesResult.data, [fromVoice, toVoice]);
    },
    [kitName, skipUndoRecording, onAddUndoAction],
  );

  const handleMoveSuccess = useCallback(
    async (
      _result: unknown,
      _isCrossKit: boolean,
      _targetKit: string,
      _fromVoice: number,
      _fromSlot: number,
      _toVoice: number,
      _toSlot: number,
    ) => {
      // Toast notifications removed per user request

      if (onSamplesChanged) {
        await onSamplesChanged();
      }
    },
    [onSamplesChanged],
  );

  const handleSampleMove = useCallback(
    async (
      fromVoice: number,
      fromSlot: number,
      toVoice: number,
      toSlot: number,
      toKit?: string,
    ) => {
      const targetKit = toKit || kitName;
      const isCrossKit = targetKit !== kitName;

      if (!validateMoveAPI(isCrossKit)) return;

      try {
        let result;

        if (isCrossKit) {
          result = await globalThis.electronAPI.moveSampleBetweenKits?.(
            kitName,
            fromVoice,
            fromSlot,
            targetKit,
            toVoice,
            toSlot,
            "insert",
          );
        } else {
          const voicesBefore = await captureStateSnapshot(fromVoice, toVoice);
          result = await globalThis.electronAPI.moveSampleInKit?.(
            kitName,
            fromVoice,
            fromSlot,
            toVoice,
            toSlot,
          );

          if (
            result?.success &&
            !skipUndoRecording &&
            onAddUndoAction &&
            result?.data &&
            voicesBefore
          ) {
            const moveAction = undoActions.createSameKitMoveAction({
              fromSlot,
              fromVoice,
              result,
              toSlot,
              toVoice,
              voicesBefore,
            });
            onAddUndoAction(moveAction);
          }
        }

        if (
          isCrossKit &&
          result?.success &&
          !skipUndoRecording &&
          onAddUndoAction &&
          result?.data
        ) {
          const crossKitMoveAction = undoActions.createCrossKitMoveAction({
            fromSlot,
            fromVoice,
            result: result as MoveOperationResult,
            targetKit,
            toSlot,
            toVoice,
          });
          onAddUndoAction(crossKitMoveAction);
        }

        if (result?.success) {
          await handleMoveSuccess(
            result,
            isCrossKit,
            targetKit,
            fromVoice,
            fromSlot,
            toVoice,
            toSlot,
          );
        } else {
          onMessage?.(result?.error || "Failed to move sample", "error");
        }
      } catch (error) {
        onMessage?.(
          `Failed to move sample: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    },
    [
      kitName,
      validateMoveAPI,
      captureStateSnapshot,
      undoActions,
      skipUndoRecording,
      onAddUndoAction,
      handleMoveSuccess,
      onMessage,
    ],
  );

  return {
    handleSampleMove,
  };
}

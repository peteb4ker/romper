import type { AnyUndoAction } from "@romper/shared/undoTypes";
import type { Sample, DbResult } from "@romper/shared/db/schema";

import { useCallback } from "react";

// Define move result types for better type safety
type MoveResult = DbResult<{
  affectedSamples: (Sample & { original_slot_number: number })[];
  movedSample: Sample;
  replacedSample?: Sample;
}>;

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
        if (!window.electronAPI?.moveSampleBetweenKits) {
          onMessage?.("Cross-kit sample move not available", "error");
          return false;
        }
      } else if (!window.electronAPI?.moveSampleInKit) {
        onMessage?.("Sample move not available", "error");
        return false;
      }
      return true;
    },
    [onMessage],
  );

  const captureStateSnapshot = useCallback(
    async (fromVoice: number, toVoice: number) => {
      if (skipUndoRecording || !onAddUndoAction) return [];

      const samplesResult = await window.electronAPI?.getAllSamplesForKit?.(kitName);
      if (!samplesResult?.success || !samplesResult.data) return [];

      const affectedVoices = new Set([fromVoice, toVoice]);
      return samplesResult.data
        .filter((s: Sample) => affectedVoices.has(s.voice_number))
        .map((s: Sample) => ({
          sample: {
            filename: s.filename,
            is_stereo: s.is_stereo,
            source_path: s.source_path,
          },
          slot: s.slot_number,
          voice: s.voice_number,
        }));
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
          result = await window.electronAPI.moveSampleBetweenKits?.(kitName, fromVoice, fromSlot, targetKit, toVoice, toSlot, "insert");
        } else {
          const stateSnapshot = await captureStateSnapshot(fromVoice, toVoice);
          result = await window.electronAPI.moveSampleInKit?.(
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
            result.data
          ) {
            const moveAction = undoActions.createSameKitMoveAction({
              fromSlot,
              fromVoice,
              result: result as MoveResult,
              stateSnapshot,
              toSlot,
              toVoice,
            });
            onAddUndoAction(moveAction);
          }
        }

        if (
          isCrossKit &&
          result?.success &&
          !skipUndoRecording &&
          onAddUndoAction &&
          result.data
        ) {
          const crossKitMoveAction = undoActions.createCrossKitMoveAction({
            fromSlot,
            fromVoice,
            result: result as MoveResult,
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

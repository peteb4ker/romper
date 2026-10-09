import type { KitWithRelations } from "@romper/shared/db/schema";
import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { useCallback } from "react";

import type { MoveOperationResult } from "./types";

import { useSampleManagementUndoActions } from "./useSampleManagementUndoActions";

export interface UseSampleManagementMoveOpsOptions {
  kitName: string;
  onAddUndoAction?: (action: AnyUndoAction) => void;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  /** Shows the kit after a sample edit: as the edit returned it, or read again (#452) */
  onSamplesChanged?: (edited?: KitWithRelations) => Promise<void>;
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
  const undoActions = useSampleManagementUndoActions({ kitName });

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

  const handleMoveSuccess = useCallback(
    async (
      result: { data?: object },
      _isCrossKit: boolean,
      _targetKit: string,
      _fromVoice: number,
      _fromSlot: number,
      _toVoice: number,
      _toSlot: number,
    ) => {
      // Toast notifications removed per user request

      // Show the kit as the move left it (#452)
      if (onSamplesChanged) {
        const edited =
          result.data && "kit" in result.data
            ? (result.data.kit as KitWithRelations | undefined)
            : undefined;
        await onSamplesChanged(edited);
      }
    },
    [onSamplesChanged],
  );

  // Resolves true once the sample has moved, false when it didn't (and a
  // message says why), so the move keys know where the sample is (#522)
  const handleSampleMove = useCallback(
    async (
      fromVoice: number,
      fromSlot: number,
      toVoice: number,
      toSlot: number,
      toKit?: string,
    ): Promise<boolean> => {
      const targetKit = toKit || kitName;
      const isCrossKit = targetKit !== kitName;

      if (!validateMoveAPI(isCrossKit)) return false;

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
          result = await globalThis.electronAPI.moveSampleInKit?.(
            kitName,
            fromVoice,
            fromSlot,
            toVoice,
            toSlot,
          );

          // Main returns the voices as they were, read right before the
          // move: full rows, so undo brings back gain and WAV details too
          // (RE-86, #452)
          const voicesBefore = result?.data?.voicesBefore;
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
          return true;
        }
        onMessage?.(result?.error || "Failed to move sample", "error");
        return false;
      } catch (error) {
        onMessage?.(
          `Failed to move sample: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
        return false;
      }
    },
    [
      kitName,
      validateMoveAPI,
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

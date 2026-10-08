import type { KitWithRelations } from "@romper/shared/db/schema";
import type { AnyUndoAction } from "@romper/shared/undoTypes";

import { getErrorMessage } from "@romper/shared/errorUtils";
import { useCallback } from "react";

import { createLogger } from "../../../utils/logger";
import { useSampleManagementUndoActions } from "./useSampleManagementUndoActions";

const log = createLogger("SampleMgmt");

export interface UseSampleManagementOperationsOptions {
  kitName: string;
  onAddUndoAction?: (action: AnyUndoAction) => void;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  /** Shows the kit after a sample edit: as the edit returned it, or read again (#452) */
  onSamplesChanged?: (edited?: KitWithRelations) => Promise<void>;
  skipUndoRecording: boolean;
}

/**
 * Hook for basic sample operations (add, delete)
 * Extracted from useSampleManagement to reduce complexity
 */
export function useSampleManagementOperations({
  kitName,
  onAddUndoAction,
  onMessage,
  onSamplesChanged,
  skipUndoRecording,
}: UseSampleManagementOperationsOptions) {
  // Get undo action creators
  const undoActions = useSampleManagementUndoActions({ kitName });

  // Resolves true when the sample was added. A refused or failed add
  // tells the user why and resolves false, so a drop doesn't count it (#542).
  const handleSampleAdd = useCallback(
    async (
      voice: number,
      slotNumber: number,
      filePath: string,
    ): Promise<boolean> => {
      if (!globalThis.electronAPI?.addSampleToSlot) {
        onMessage?.("Sample management not available", "error");
        return false;
      }

      let added = false;
      try {
        const result = await globalThis.electronAPI.addSampleToSlot(
          kitName,
          voice,
          slotNumber,
          filePath,
        );

        if (result.success) {
          added = true;
          onMessage?.(
            `Sample added to voice ${voice}, slot ${slotNumber + 1}`,
            "success",
          );

          // Record undo action unless explicitly skipped
          if (!skipUndoRecording && onAddUndoAction && result.data) {
            log.debug("Recording ADD_SAMPLE undo action");
            const addAction = undoActions.createAddSampleAction(
              voice,
              slotNumber,
              filePath,
            );
            onAddUndoAction(addAction);
          } else {
            log.debug(
              "NOT recording ADD_SAMPLE undo action - skipUndoRecording:",
              skipUndoRecording,
              "onAddUndoAction:",
              !!onAddUndoAction,
              "result.data:",
              !!result.data,
            );
          }

          // Show the kit as the add left it (#452)
          if (onSamplesChanged) {
            await onSamplesChanged(result.data?.kit);
          }
        } else {
          onMessage?.(result.error || "Failed to add sample", "error");
        }
      } catch (error) {
        onMessage?.(
          `Failed to add sample: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
      return added;
    },
    [
      kitName,
      onSamplesChanged,
      onMessage,
      skipUndoRecording,
      onAddUndoAction,
      undoActions,
    ],
  );

  const handleSampleDelete = useCallback(
    async (voice: number, slotNumber: number) => {
      if (!globalThis.electronAPI?.deleteSampleFromSlot) {
        onMessage?.("Sample management not available", "error");
        return;
      }

      try {
        const result = await globalThis.electronAPI.deleteSampleFromSlot(
          kitName,
          voice,
          slotNumber,
        );

        if (result.success) {
          onMessage?.(
            `Sample deleted from voice ${voice}, slot ${slotNumber + 1}`,
            "success",
          );

          // Record REINDEX_SAMPLES action since deletion now triggers
          // automatic reindexing. Main returns the deleted row and the
          // voice as it was, read right before the delete (#452).
          const deleted = result.data?.deletedSamples?.[0];
          const voicesBefore = result.data?.voicesBefore;
          if (
            !skipUndoRecording &&
            onAddUndoAction &&
            deleted &&
            voicesBefore
          ) {
            const reindexAction = undoActions.createReindexSamplesAction(
              voice,
              slotNumber,
              deleted,
              result,
              voicesBefore,
            );
            onAddUndoAction(reindexAction);
          }

          // Show the kit as the delete left it (#452)
          if (onSamplesChanged) {
            await onSamplesChanged(result.data?.kit);
          }
        } else {
          onMessage?.(result.error || "Failed to delete sample", "error");
        }
      } catch (error) {
        onMessage?.(
          `Failed to delete sample: ${getErrorMessage(error)}`,
          "error",
        );
      }
    },
    [
      kitName,
      onSamplesChanged,
      onMessage,
      undoActions,
      onAddUndoAction,
      skipUndoRecording,
    ],
  );

  return {
    handleSampleAdd,
    handleSampleDelete,
  };
}

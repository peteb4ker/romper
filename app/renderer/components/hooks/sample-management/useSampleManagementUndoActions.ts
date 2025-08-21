import type { Sample } from "@romper/shared/db/schema.js";
import type {
  AddSampleAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
  ReindexSamplesAction,
  ReplaceSampleAction,
} from "@romper/shared/undoTypes";

import { createActionId } from "@romper/shared/undoTypes";
import { useCallback } from "react";

import type { MoveOperationResult } from "./types.js";

export interface UseSampleManagementUndoActionsOptions {
  kitName: string;
  skipUndoRecording: boolean;
}

// Type interfaces for operation results
interface ReindexOperationResult {
  data?: {
    affectedSamples: Sample[];
  };
  success: boolean;
}

interface SampleOperationResult {
  data?: {
    affectedSamples: Sample[];
    movedSample: Sample;
    replacedSample?: Sample;
  };
  success: boolean;
}

/**
 * Hook for creating undo actions for sample management operations
 * Extracted from useSampleManagement to reduce complexity
 */
export function useSampleManagementUndoActions({
  kitName,
  skipUndoRecording,
}: UseSampleManagementUndoActionsOptions) {
  // Helper function to get old sample for undo recording
  const getOldSampleForUndo = useCallback(
    async (voice: number, slotNumber: number) => {
      if (skipUndoRecording) return null;

      const samplesResult =
        await window.electronAPI?.getAllSamplesForKit?.(kitName);
      if (samplesResult?.success && samplesResult.data) {
        return (
          (samplesResult.data as Sample[]).find(
            (s) => s.voice_number === voice && s.slot_number === slotNumber,
          ) || null
        );
      }
      return null;
    },
    [kitName, skipUndoRecording],
  );

  // Helper function to get sample to delete for undo recording
  const getSampleToDeleteForUndo = useCallback(
    async (voice: number, slotNumber: number) => {
      if (skipUndoRecording) return null;

      try {
        const samplesResult =
          await window.electronAPI?.getAllSamplesForKit?.(kitName);
        if (samplesResult?.success && samplesResult.data) {
          return (
            (samplesResult.data as Sample[]).find(
              (sample) =>
                sample.voice_number === voice &&
                sample.slot_number === slotNumber,
            ) || null
          );
        }
      } catch (error) {
        console.error(
          "[SampleManagement] Failed to get sample data for undo recording:",
          error,
        );
      }
      return null;
    },
    [kitName, skipUndoRecording],
  );

  // Helper function to create add sample undo action
  const createAddSampleAction = useCallback(
    (
      voice: number,
      slotNumber: number,
      filePath: string,
      options?: { forceMono?: boolean; forceStereo?: boolean },
    ): AddSampleAction => ({
      data: {
        addedSample: {
          filename: filePath.split("/").pop() || "",
          is_stereo: options?.forceStereo || false,
          source_path: filePath,
        },
        slot: slotNumber,
        voice,
      },
      description: `Add sample to voice ${voice}, slot ${slotNumber + 1}`,
      id: createActionId(),
      timestamp: new Date(),
      type: "ADD_SAMPLE",
    }),
    [],
  );

  // Helper function to create replace sample undo action
  const createReplaceSampleAction = useCallback(
    (
      voice: number,
      slotNumber: number,
      oldSample: Sample,
      filePath: string,
      options?: { forceMono?: boolean; forceStereo?: boolean },
    ): ReplaceSampleAction => ({
      data: {
        newSample: {
          filename: filePath.split("/").pop() || "",
          is_stereo: options?.forceStereo || false,
          source_path: filePath,
        },
        oldSample: {
          filename: oldSample.filename,
          is_stereo: oldSample.is_stereo,
          source_path: oldSample.source_path,
        },
        slot: slotNumber,
        voice,
      },
      description: `Replace sample in voice ${voice}, slot ${slotNumber + 1}`,
      id: createActionId(),
      timestamp: new Date(),
      type: "REPLACE_SAMPLE",
    }),
    [],
  );

  // Helper function to create reindex samples undo action
  const createReindexSamplesAction = useCallback(
    (
      voice: number,
      slotNumber: number,
      sampleToDelete: Sample,
      result: ReindexOperationResult,
    ): ReindexSamplesAction => ({
      data: {
        affectedSamples:
          result.data?.affectedSamples?.map((sample) => ({
            newSlot: sample.slot_number - 1, // Original position before reindexing
            oldSlot: sample.slot_number, // New position after reindexing
            sample: {
              filename: sample.filename,
              is_stereo: sample.is_stereo,
              source_path: sample.source_path,
            },
            voice: sample.voice_number,
          })) || [],
        deletedSample: {
          filename: sampleToDelete.filename,
          is_stereo: sampleToDelete.is_stereo,
          source_path: sampleToDelete.source_path,
        },
        deletedSlot: slotNumber,
        voice,
      },
      description: `Delete sample from voice ${voice}, slot ${slotNumber + 1} (with reindexing)`,
      id: createActionId(),
      timestamp: new Date(),
      type: "REINDEX_SAMPLES",
    }),
    [],
  );

  const createSameKitMoveAction = useCallback(
    (params: {
      fromSlot: number;
      fromVoice: number;
      result: SampleOperationResult;
      stateSnapshot: {
        sample: { filename: string; is_stereo: boolean; source_path: string };
        slot: number;
        voice: number;
      }[];
      toSlot: number;
      toVoice: number;
    }): MoveSampleAction => ({
      data: {
        affectedSamples:
          params.result.data?.affectedSamples?.map((sample) => ({
            newSlot: sample.slot_number,
            oldSlot: sample.slot_number, // Using slot_number for both since original_slot_number doesn't exist in Sample
            sample: {
              filename: sample.filename,
              is_stereo: sample.is_stereo,
              source_path: sample.source_path,
            },
            voice: sample.voice_number,
          })) || [],
        fromSlot: params.fromSlot,
        fromVoice: params.fromVoice,
        movedSample: {
          filename: params.result.data?.movedSample?.filename || "",
          is_stereo: params.result.data?.movedSample?.is_stereo || false,
          source_path: params.result.data?.movedSample?.source_path || "",
        },
        replacedSample: params.result.data?.replacedSample
          ? {
              filename: params.result.data.replacedSample.filename,
              is_stereo: params.result.data.replacedSample.is_stereo,
              source_path: params.result.data.replacedSample.source_path,
            }
          : undefined,
        stateSnapshot: params.stateSnapshot,
        toSlot: params.toSlot,
        toVoice: params.toVoice,
      },
      description: `Move sample from voice ${params.fromVoice}, slot ${params.fromSlot + 1} to voice ${params.toVoice}, slot ${params.toSlot + 1}`,
      id: createActionId(),
      timestamp: new Date(),
      type: "MOVE_SAMPLE",
    }),
    [],
  );

  const createCrossKitMoveAction = useCallback(
    (params: {
      fromSlot: number;
      fromVoice: number;
      result: MoveOperationResult;
      targetKit: string;
      toSlot: number;
      toVoice: number;
    }): MoveSampleBetweenKitsAction => ({
      data: {
        affectedSamples:
          params.result.data?.affectedSamples?.map((sample) => ({
            newSlot: sample.slot_number,
            oldSlot: sample.original_slot_number,
            sample: {
              filename: sample.filename,
              is_stereo: sample.is_stereo,
              source_path: sample.source_path,
            },
            voice: sample.voice_number,
          })) || [],
        fromKit: kitName,
        fromSlot: params.fromSlot,
        fromVoice: params.fromVoice,
        mode: "insert",
        movedSample: {
          filename: params.result.data?.movedSample?.filename || "",
          is_stereo: params.result.data?.movedSample?.is_stereo || false,
          source_path: params.result.data?.movedSample?.source_path || "",
        },
        replacedSample: params.result.data?.replacedSample
          ? {
              filename: params.result.data?.replacedSample?.filename || "",
              is_stereo: params.result.data?.replacedSample?.is_stereo || false,
              source_path:
                params.result.data?.replacedSample?.source_path || "",
            }
          : undefined,
        toKit: params.targetKit,
        toSlot: params.toSlot,
        toVoice: params.toVoice,
      },
      description: `Move sample from ${kitName} voice ${params.fromVoice}, slot ${params.fromSlot + 1} to ${params.targetKit} voice ${params.toVoice}, slot ${params.toSlot + 1}`,
      id: createActionId(),
      timestamp: new Date(),
      type: "MOVE_SAMPLE_BETWEEN_KITS",
    }),
    [kitName],
  );

  return {
    createAddSampleAction,
    createCrossKitMoveAction,
    createReindexSamplesAction,
    createReplaceSampleAction,
    createSameKitMoveAction,
    getOldSampleForUndo,
    getSampleToDeleteForUndo,
  };
}

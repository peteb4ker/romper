import type { Sample } from "@romper/shared/db/schema.js";
import type {
  AddSampleAction,
  MoveSampleAction,
  MoveSampleBetweenKitsAction,
  ReindexSamplesAction,
  VoiceSnapshot,
} from "@romper/shared/undoTypes";

import { createActionId, snapshotVoices } from "@romper/shared/undoTypes";
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
  /**
   * Before an edit: the slot's row and the voices' full rows, so undo can
   * put them back exactly, gain and all (RE-86). Null when undo isn't
   * being recorded or the kit can't be read.
   */
  const snapshotForUndo = useCallback(
    async (voice: number, slotNumber: number, voices: number[] = [voice]) => {
      if (skipUndoRecording) return null;

      try {
        const samplesResult =
          await globalThis.electronAPI?.getAllSamplesForKit?.(kitName);
        if (!samplesResult?.success || !samplesResult.data) return null;
        return {
          sample:
            samplesResult.data.find(
              (s) => s.voice_number === voice && s.slot_number === slotNumber,
            ) ?? null,
          voicesBefore: snapshotVoices(samplesResult.data, voices),
        };
      } catch (error) {
        console.error(
          "[SampleManagement] Failed to get sample data for undo recording:",
          error,
        );
        return null;
      }
    },
    [kitName, skipUndoRecording],
  );

  // Helper function to create add sample undo action
  const createAddSampleAction = useCallback(
    (voice: number, slotNumber: number, filePath: string): AddSampleAction => ({
      data: {
        addedSample: {
          filename: filePath.split("/").pop() || "",
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

  // Helper function to create reindex samples undo action
  const createReindexSamplesAction = useCallback(
    (
      voice: number,
      slotNumber: number,
      sampleToDelete: Sample,
      result: ReindexOperationResult,
      voicesBefore: VoiceSnapshot[],
    ): ReindexSamplesAction => ({
      data: {
        affectedSamples:
          result.data?.affectedSamples?.map((sample) => ({
            newSlot: sample.slot_number - 1, // Original position before reindexing
            oldSlot: sample.slot_number, // New position after reindexing
            sample: {
              filename: sample.filename,
              source_path: sample.source_path,
            },
            voice: sample.voice_number,
          })) || [],
        deletedSample: {
          filename: sampleToDelete.filename,
          source_path: sampleToDelete.source_path,
        },
        deletedSlot: slotNumber,
        voice,
        voicesBefore,
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
      toSlot: number;
      toVoice: number;
      voicesBefore: VoiceSnapshot[];
    }): MoveSampleAction => ({
      data: {
        affectedSamples:
          params.result.data?.affectedSamples?.map((sample) => ({
            newSlot: sample.slot_number,
            oldSlot: sample.slot_number, // Using slot_number for both since original_slot_number doesn't exist in Sample
            sample: {
              filename: sample.filename,
              source_path: sample.source_path,
            },
            voice: sample.voice_number,
          })) || [],
        fromSlot: params.fromSlot,
        fromVoice: params.fromVoice,
        movedSample: {
          filename: params.result.data?.movedSample?.filename || "",
          source_path: params.result.data?.movedSample?.source_path || "",
        },
        replacedSample: params.result.data?.replacedSample
          ? {
              filename: params.result.data.replacedSample.filename,
              source_path: params.result.data.replacedSample.source_path,
            }
          : undefined,
        toSlot: params.toSlot,
        toVoice: params.toVoice,
        voicesBefore: params.voicesBefore,
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
          source_path: params.result.data?.movedSample?.source_path || "",
        },
        replacedSample: params.result.data?.replacedSample
          ? {
              filename: params.result.data?.replacedSample?.filename || "",
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
    createSameKitMoveAction,
    snapshotForUndo,
  };
}

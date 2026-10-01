// Memory-only undo/redo action types
// Simplified for immediate renderer state management

import type { SliceStep } from "./sliceTypes";

export interface AddSampleAction extends UndoAction {
  data: {
    addedSample: {
      filename: string;
      source_path: string;
    };
    slot: number;
    voice: number;
    // Store enough data to reverse the operation (delete the added sample)
  };
  type: "ADD_SAMPLE";
}

export type AnyUndoAction =
  | AddSampleAction
  | DeleteSampleAction
  | MoveSampleAction
  | MoveSampleBetweenKitsAction
  | ReindexSamplesAction
  | ReplaceSampleAction
  | SequenceEditAction;

export interface DeleteSampleAction extends UndoAction {
  data: {
    deletedSample: {
      filename: string;
      source_path: string;
    };
    slot: number;
    voice: number;
    // Store deleted sample data to restore it
  };
  type: "DELETE_SAMPLE";
}

// MOVE_SAMPLE action data - for drag-and-drop moves
export interface MoveSampleAction extends UndoAction {
  data: {
    affectedSamples: Array<{
      newSlot: number;
      oldSlot: number;
      sample: {
        filename: string;
        source_path: string;
      };
      voice: number;
    }>;
    fromSlot: number;
    fromVoice: number;
    mode?: "insert" | "overwrite";
    movedSample: {
      filename: string;
      source_path: string;
    };
    replacedSample?: {
      filename: string;
      source_path: string;
    };
    // NEW: Complete snapshot of affected voices before the move
    stateSnapshot?: Array<{
      sample: {
        filename: string;
        source_path: string;
      };
      slot: number;
      voice: number;
    }>;
    toSlot: number;
    toVoice: number;
  };
  type: "MOVE_SAMPLE";
}

// MOVE_SAMPLE_BETWEEN_KITS action data - for cross-kit moves
export interface MoveSampleBetweenKitsAction extends UndoAction {
  data: {
    affectedSamples: Array<{
      newSlot: number;
      oldSlot: number;
      sample: {
        filename: string;
        source_path: string;
      };
      voice: number;
    }>;
    fromKit: string;
    fromSlot: number;
    fromVoice: number;
    mode: "insert" | "overwrite";
    movedSample: {
      filename: string;
      source_path: string;
    };
    replacedSample?: {
      filename: string;
      source_path: string;
    };
    toKit: string;
    toSlot: number;
    toVoice: number;
  };
  type: "MOVE_SAMPLE_BETWEEN_KITS";
}

// REINDEX_SAMPLES action data - for automatic reindexing after deletion
export interface ReindexSamplesAction extends UndoAction {
  data: {
    affectedSamples: Array<{
      newSlot: number;
      oldSlot: number;
      sample: {
        filename: string;
        source_path: string;
      };
      voice: number;
    }>;
    deletedSample: {
      filename: string;
      source_path: string;
    };
    deletedSlot: number;
    voice: number;
  };
  type: "REINDEX_SAMPLES";
}

export interface ReplaceSampleAction extends UndoAction {
  data: {
    newSample: {
      filename: string;
      source_path: string;
    };
    oldSample: {
      filename: string;
      source_path: string;
    };
    slot: number;
    voice: number;
    // Store old sample data to restore it
  };
  type: "REPLACE_SAMPLE";
}

/**
 * A sequencer edit: steps, trigger conditions and slices, before and after.
 * Undo writes `before` back; redo writes `after`.
 */
export interface SequenceEditAction extends UndoAction {
  data: {
    after: SequenceSnapshot;
    before: SequenceSnapshot;
    /** Consecutive edits with the same key (e.g. scroll-wheel nudges of
     * one step) merge into one undo step. */
    mergeKey?: string;
  };
  type: "SEQUENCE_EDIT";
}

/** Everything a sequencer edit can change. */
export interface SequenceSnapshot {
  sliceSteps: (null | SliceStep)[][];
  stepPattern: number[][];
  triggerConditions: (null | string)[][];
}

export interface UndoAction {
  description: string; // Human-readable description for UI
  id: string; // Unique ID for the action
  timestamp: Date;
  type:
    | "ADD_SAMPLE"
    | "DELETE_SAMPLE"
    | "MOVE_SAMPLE_BETWEEN_KITS"
    | "MOVE_SAMPLE"
    | "REINDEX_SAMPLES"
    | "REPLACE_SAMPLE"
    | "SEQUENCE_EDIT";
}

// Helper to create action IDs
export function createActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Helper to create action descriptions
export function getActionDescription(action: AnyUndoAction): string {
  switch (action.type) {
    case "ADD_SAMPLE":
      return `Undo add sample to voice ${action.data.voice}, slot ${action.data.slot + 1}`;
    case "DELETE_SAMPLE":
      return `Undo delete sample from voice ${action.data.voice}, slot ${action.data.slot + 1}`;
    case "MOVE_SAMPLE":
      return `Undo move sample from voice ${action.data.fromVoice}, slot ${action.data.fromSlot + 1} to voice ${action.data.toVoice}, slot ${action.data.toSlot + 1}`;
    case "MOVE_SAMPLE_BETWEEN_KITS":
      return `Undo move sample from ${action.data.fromKit} voice ${action.data.fromVoice}, slot ${action.data.fromSlot + 1} to ${action.data.toKit} voice ${action.data.toVoice}, slot ${action.data.toSlot + 1}`;
    case "REINDEX_SAMPLES":
      return `Undo reindex samples in voice ${action.data.voice} after deleting slot ${action.data.deletedSlot + 1}`;
    case "REPLACE_SAMPLE":
      return `Undo replace sample in voice ${action.data.voice}, slot ${action.data.slot + 1}`;
    case "SEQUENCE_EDIT":
      return `Undo ${action.description.charAt(0).toLowerCase()}${action.description.slice(1)}`;
    default:
      return "Undo last action";
  }
}

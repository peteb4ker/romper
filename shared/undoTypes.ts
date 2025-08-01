// Memory-only undo/redo action types
// Simplified for immediate renderer state management

export interface UndoAction {
  id: string; // Unique ID for the action
  type:
    | "ADD_SAMPLE"
    | "REPLACE_SAMPLE"
    | "DELETE_SAMPLE"
    | "MOVE_SAMPLE"
    | "MOVE_SAMPLE_BETWEEN_KITS"
    | "COMPACT_SLOTS";
  timestamp: Date;
  description: string; // Human-readable description for UI
}

export interface AddSampleAction extends UndoAction {
  type: "ADD_SAMPLE";
  data: {
    voice: number;
    slot: number;
    addedSample: {
      filename: string;
      source_path: string;
      is_stereo: boolean;
    };
    // Store enough data to reverse the operation (delete the added sample)
  };
}

export interface ReplaceSampleAction extends UndoAction {
  type: "REPLACE_SAMPLE";
  data: {
    voice: number;
    slot: number;
    oldSample: {
      filename: string;
      source_path: string;
      is_stereo: boolean;
    };
    newSample: {
      filename: string;
      source_path: string;
      is_stereo: boolean;
    };
    // Store old sample data to restore it
  };
}

export interface DeleteSampleAction extends UndoAction {
  type: "DELETE_SAMPLE";
  data: {
    voice: number;
    slot: number;
    deletedSample: {
      filename: string;
      source_path: string;
      is_stereo: boolean;
    };
    // Store deleted sample data to restore it
  };
}

// MOVE_SAMPLE action data - for drag-and-drop moves
export interface MoveSampleAction extends UndoAction {
  type: "MOVE_SAMPLE";
  data: {
    fromVoice: number;
    fromSlot: number;
    toVoice: number;
    toSlot: number;
    mode: "insert" | "overwrite";
    movedSample: {
      filename: string;
      source_path: string;
      is_stereo: boolean;
    };
    affectedSamples: Array<{
      voice: number;
      oldSlot: number;
      newSlot: number;
      sample: {
        filename: string;
        source_path: string;
        is_stereo: boolean;
      };
    }>;
    replacedSample?: {
      filename: string;
      source_path: string;
      is_stereo: boolean;
    };
    // NEW: Complete snapshot of affected voices before the move
    stateSnapshot?: Array<{
      voice: number;
      slot: number;
      sample: {
        filename: string;
        source_path: string;
        is_stereo: boolean;
      };
    }>;
  };
}

// COMPACT_SLOTS action data - for automatic compaction after deletion
export interface CompactSlotsAction extends UndoAction {
  type: "COMPACT_SLOTS";
  data: {
    voice: number;
    deletedSlot: number;
    deletedSample: {
      filename: string;
      source_path: string;
      is_stereo: boolean;
    };
    affectedSamples: Array<{
      voice: number;
      oldSlot: number;
      newSlot: number;
      sample: {
        filename: string;
        source_path: string;
        is_stereo: boolean;
      };
    }>;
  };
}

// MOVE_SAMPLE_BETWEEN_KITS action data - for cross-kit moves
export interface MoveSampleBetweenKitsAction extends UndoAction {
  type: "MOVE_SAMPLE_BETWEEN_KITS";
  data: {
    fromKit: string;
    fromVoice: number;
    fromSlot: number;
    toKit: string;
    toVoice: number;
    toSlot: number;
    mode: "insert" | "overwrite";
    movedSample: {
      filename: string;
      source_path: string;
      is_stereo: boolean;
    };
    affectedSamples: Array<{
      voice: number;
      oldSlot: number;
      newSlot: number;
      sample: {
        filename: string;
        source_path: string;
        is_stereo: boolean;
      };
    }>;
    replacedSample?: {
      filename: string;
      source_path: string;
      is_stereo: boolean;
    };
  };
}

export type AnyUndoAction =
  | AddSampleAction
  | ReplaceSampleAction
  | DeleteSampleAction
  | MoveSampleAction
  | MoveSampleBetweenKitsAction
  | CompactSlotsAction;

// Helper to create action IDs
export function createActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Helper to create action descriptions
export function getActionDescription(action: AnyUndoAction): string {
  switch (action.type) {
    case "ADD_SAMPLE":
      return `Undo add sample to voice ${action.data.voice}, slot ${action.data.slot + 1}`;
    case "REPLACE_SAMPLE":
      return `Undo replace sample in voice ${action.data.voice}, slot ${action.data.slot + 1}`;
    case "DELETE_SAMPLE":
      return `Undo delete sample from voice ${action.data.voice}, slot ${action.data.slot + 1}`;
    case "MOVE_SAMPLE":
      return `Undo move sample from voice ${action.data.fromVoice}, slot ${action.data.fromSlot + 1} to voice ${action.data.toVoice}, slot ${action.data.toSlot + 1}`;
    case "MOVE_SAMPLE_BETWEEN_KITS":
      return `Undo move sample from ${action.data.fromKit} voice ${action.data.fromVoice}, slot ${action.data.fromSlot + 1} to ${action.data.toKit} voice ${action.data.toVoice}, slot ${action.data.toSlot + 1}`;
    case "COMPACT_SLOTS":
      return `Undo compact slots in voice ${action.data.voice} after deleting slot ${action.data.deletedSlot + 1}`;
    default:
      return "Undo last action";
  }
}

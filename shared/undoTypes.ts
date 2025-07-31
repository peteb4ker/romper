// Memory-only undo/redo action types
// Simplified for immediate renderer state management

export interface UndoAction {
  id: string; // Unique ID for the action
  type: "ADD_SAMPLE" | "REPLACE_SAMPLE" | "DELETE_SAMPLE";
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

export type AnyUndoAction =
  | AddSampleAction
  | ReplaceSampleAction
  | DeleteSampleAction;

// Helper to create action IDs
export function createActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    default:
      return "Undo last action";
  }
}

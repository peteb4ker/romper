// Memory-only undo/redo action types
// Simplified for immediate renderer state management

import type { Sample } from "./db/schema";
import type { RestoredMissingFile } from "./electronApi";
import type { SliceStep } from "./sliceTypes";

export interface AddSampleAction extends UndoAction {
  data: {
    addedSample: {
      filename: string;
      source_path: string;
    };
    /** The kit the sample was added to (#887) */
    kitName: string;
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
  | RemoveMissingSamplesAction
  | RestoreMissingFileAction
  | SequenceEditAction;

export interface DeleteSampleAction extends UndoAction {
  data: {
    deletedSample: {
      filename: string;
      source_path: string;
    };
    /** The kit the sample was deleted from (#887) */
    kitName: string;
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
    /** The kit the sample was moved in (#887) */
    kitName: string;
    mode?: "insert";
    movedSample: {
      filename: string;
      source_path: string;
    };
    toSlot: number;
    toVoice: number;
    /** Both voices' full rows before the move; undo restores them */
    voicesBefore: VoiceSnapshot[];
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
    mode: "insert";
    movedSample: {
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
    /** The kit the sample was deleted from (#887) */
    kitName: string;
    voice: number;
    /** The voice's full rows before the delete; undo restores them */
    voicesBefore: VoiceSnapshot[];
  };
  type: "REINDEX_SAMPLES";
}

/**
 * "Remove missing samples" from a kit (#822). It carries its kit, because
 * it can be made from the Library check while another kit, or none, is
 * open, and undo works on it whether or not the kit is editable (D5).
 */
export interface RemoveMissingSamplesAction extends UndoAction {
  data: {
    kitName: string;
    /** How many rows went */
    samples: number;
    /** The voices the removal changed, as main returned them; undo puts them back */
    voicesBefore: VoiceSnapshot[];
  };
  type: "REMOVE_MISSING_SAMPLES";
}

/**
 * A found file put back for a missing sample (#823): copied back into the
 * store, or the sample pointed at it. It carries its kit, as "Remove
 * missing samples" does, since the Library check makes it for any kit.
 */
export interface RestoreMissingFileAction extends UndoAction {
  data: {
    kitName: string;
    /** What main did, as it returned it; undo reverses exactly that */
    restored: RestoredMissingFile;
  };
  type: "RESTORE_MISSING_FILE";
}

/**
 * A sample row as undo keeps it: everything the user can see or set, so
 * restoring it brings back its gain and WAV details too (RE-86). The id,
 * kit and voice come from where it's restored.
 */
export type SampleSnapshot = Pick<
  Sample,
  | "filename"
  | "gain_db"
  | "slot_number"
  | "source_mtime_ms"
  | "source_path"
  | "source_size"
  | "source_status"
  | "wav_bit_depth"
  | "wav_bitrate"
  | "wav_channels"
  | "wav_format_tag"
  | "wav_sample_rate"
>;

/**
 * A sequencer edit: steps, trigger conditions and slices, before and after.
 * Undo writes `before` back; redo writes `after`.
 */
export interface SequenceEditAction extends UndoAction {
  data: {
    after: SequenceSnapshot;
    before: SequenceSnapshot;
    /** The kit whose sequence was edited (#887) */
    kitName: string;
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
    | "REMOVE_MISSING_SAMPLES"
    | "RESTORE_MISSING_FILE"
    | "SEQUENCE_EDIT";
}

/** A voice's samples, by slot, as they were before an edit */
export interface VoiceSnapshot {
  samples: SampleSnapshot[];
  voice: number;
}

/**
 * The kit an action was made in, and the kit its undo and redo act on
 * (#887): every action records it when it's made. A move between kits
 * belongs to the kit it was moved from.
 */
export function actionKit(action: AnyUndoAction): string {
  return action.type === "MOVE_SAMPLE_BETWEEN_KITS"
    ? action.data.fromKit
    : action.data.kitName;
}

/**
 * Whether the action names its own kit, so it can be undone or redone with
 * any kit open, or none, and whether or not that kit is editable: "Remove
 * missing samples" (#822, D5) and putting a found file back (#823), which
 * the Library check makes for any kit. Main still refuses pointing a
 * read-only kit's sample at another file.
 */
export function carriesItsKit(
  action: AnyUndoAction | null | undefined,
): boolean {
  return (
    action?.type === "REMOVE_MISSING_SAMPLES" ||
    action?.type === "RESTORE_MISSING_FILE"
  );
}

// Helper to create action IDs: the timestamp, then 8 random hex digits, the
// first segment of a UUID. Its length is fixed, unlike the old
// Math.random().toString(36) suffix, which drops trailing zeros (#669).
export function createActionId(): string {
  return `${Date.now()}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
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
    case "REMOVE_MISSING_SAMPLES":
    case "RESTORE_MISSING_FILE":
    case "SEQUENCE_EDIT":
      return `Undo ${action.description.charAt(0).toLowerCase()}${action.description.slice(1)}`;
    default:
      return "Undo last action";
  }
}

/** Snapshot the given voices from a kit's sample rows, for undo */
export function snapshotVoices(
  kitSamples: Sample[],
  voices: Iterable<number>,
): VoiceSnapshot[] {
  return [...new Set(voices)]
    .sort((a, b) => a - b)
    .map((voice) => ({
      samples: kitSamples
        .filter((s) => s.voice_number === voice)
        .sort((a, b) => a.slot_number - b.slot_number)
        .map((s) => ({
          filename: s.filename,
          gain_db: s.gain_db,
          slot_number: s.slot_number,
          source_mtime_ms: s.source_mtime_ms,
          source_path: s.source_path,
          source_size: s.source_size,
          source_status: s.source_status,
          wav_bit_depth: s.wav_bit_depth,
          wav_bitrate: s.wav_bitrate,
          wav_channels: s.wav_channels,
          wav_format_tag: s.wav_format_tag,
          wav_sample_rate: s.wav_sample_rate,
        })),
      voice,
    }));
}

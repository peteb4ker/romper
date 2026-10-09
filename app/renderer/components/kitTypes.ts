// kitTypes.ts
// Central location for all UI TypeScript interfaces/types for kits

import type { KitWithRelations } from "@romper/shared/db/schema";
import type { AnyUndoAction } from "@romper/shared/undoTypes";

export interface KitEditorProps {
  kitIndex?: number;
  kitName: string;
  kits?: KitWithRelations[];
  onAddUndoAction?: (action: AnyUndoAction) => void;
  onBack: (scrollToKit?: string) => void;
  onNextKit?: () => void;
  onPrevKit?: () => void;
  /**
   * Shows a kit after its samples change (the kit named, or the open one):
   * as the edit returned it, or else read again (#452)
   */
  onRequestSamplesReload?: (
    kitName?: string,
    edited?: KitWithRelations,
  ) => Promise<void>;
  samples?: null | VoiceSamples;
  sequenceUndo?: SequenceUndo;
}

export interface KitSamplePlanSlot {
  meta?: Record<string, unknown>;
  source: string;
  target: string;
  voice: number; // 1-4
  voiceType?: string;
}

/** How the sequencer asks a sample to play. */
export interface PlayOptions {
  /** Part of the sample to play (sequencer slicer); whole sample if unset. */
  region?: PlayRegion;
  /** When to start, as a performance.now() timestamp; now if unset or past. */
  startAt?: number;
  /** Set on a choked sample: stop when the choking sound starts. */
  stopAt?: number;
}

/** Part of a sample to play, as fractions of its length (sequencer slicer). */
export interface PlayRegion {
  length: number;
  start: number;
}

export interface SampleData {
  [key: string]: unknown;
  filename: string;
  gain_db?: number;
  slot_number?: number;
  source_path: string;
  /** What Romper found when it last read the file (#537) */
  source_status?: null | string;
  voice_number?: number;
  wav_bit_depth?: number;
  wav_bitrate?: number;
  wav_channels?: number;
  /** The WAV format tag: PCM, float or extensible (#576) */
  wav_format_tag?: number;
  wav_sample_rate?: number;
}

/** Undo for the sequencer's own Undo button: set when the next undo is a
 * sequencer edit. */
export interface SequenceUndo {
  canUndo: boolean;
  undo: () => void;
}

export interface VoiceSamples {
  [voice: number]: string[];
}

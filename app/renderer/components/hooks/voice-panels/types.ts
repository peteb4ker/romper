import React from "react";

import type { PlayOptions, SampleData } from "../../kitTypes";

import { DragAndDropHook } from "./useVoicePanelDragHandlers";
import { SlotRenderingHook } from "./useVoicePanelSlotRendering";

/**
 * Base interface for voice panel hook options
 * Eliminates duplication between useVoicePanelSlots and useVoicePanelSlotRendering
 */
export interface BaseVoicePanelOptions {
  dragAndDropHook: DragAndDropHook;
  /** The kit's sample details couldn't be read, or not yet: gains are unknown (#628) */
  gainsUnknown?: boolean;
  /** The kit's sample details couldn't be read, so previews don't play (#636) */
  gainsUnreadable?: boolean;
  isActive: boolean;
  isEditable: boolean;
  kitName: string;
  /** A slot's gain at each step of a turn of its knob; not saved */
  onGainChange?: SlotGainChange;
  /** A slot's gain to save, once a turn of its knob ends (RE-88) */
  onGainCommit?: SlotGainCommit;
  onSampleSelect?: (voice: number, idx: number) => void;
  onWaveformPlayingChange: (
    voice: number,
    slot: number,
    playing: boolean,
  ) => void;
  playOptions?: { [key: string]: PlayOptions | undefined };
  /** The voice is in a stereo pair, as the write makes it (#569) */
  playsStereo: boolean;
  playTriggers: { [key: string]: number };
  playVolumes?: { [key: string]: number };
  renderDeleteButton: (
    slotNumber: number,
    sampleName?: string,
  ) => React.ReactElement;
  renderPlayButton: (
    isPlaying: boolean,
    slotNumber: number,
  ) => React.ReactElement;
  sampleActionsHook: {
    handleSampleContextMenu: (
      e: React.MouseEvent,
      sampleData: SampleData | undefined,
    ) => void;
  };
  sampleMetadata?: { [slotKey: string]: SampleData }; // keyed by slotKey(voice, slot)
  samplePlaying: { [key: string]: boolean };
  samples: string[];
  selectedIdx: number;
  slotRenderingHook: SlotRenderingHook;
  stopTriggers: { [key: string]: number };
  voice: number;
}

/** A slot's gain as its knob turns */
export type SlotGainChange = (
  voice: number,
  slotNumber: number,
  sampleName: string,
  gainDb: number,
) => void;

/** A slot's gain once a turn ends, and the gain before the turn */
export type SlotGainCommit = (
  voice: number,
  slotNumber: number,
  sampleName: string,
  gainDb: number,
  fromDb: number,
) => void;

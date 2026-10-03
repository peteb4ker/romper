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
  isActive: boolean;
  isEditable: boolean;
  kitName: string;
  onGainChange?: (
    voice: number,
    slotNumber: number,
    sampleName: string,
    gainDb: number,
  ) => void;
  onSampleSelect?: (voice: number, idx: number) => void;
  onWaveformPlayingChange: (
    voice: number,
    sample: string,
    playing: boolean,
  ) => void;
  playOptions?: { [key: string]: PlayOptions | undefined };
  playTriggers: { [key: string]: number };
  playVolumes?: { [key: string]: number };
  renderDeleteButton: (
    slotNumber: number,
    sampleName?: string,
  ) => React.ReactElement;
  renderPlayButton: (
    isPlaying: boolean,
    sampleName: string,
  ) => React.ReactElement;
  sampleActionsHook: {
    handleSampleContextMenu: (
      e: React.MouseEvent,
      sampleData: SampleData | undefined,
    ) => void;
  };
  sampleMetadata?: { [filename: string]: SampleData };
  samplePlaying: { [key: string]: boolean };
  samples: string[];
  selectedIdx: number;
  slotRenderingHook: SlotRenderingHook;
  stopTriggers: { [key: string]: number };
  voice: number;
}

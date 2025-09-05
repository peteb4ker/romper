import React from "react";

import type { SampleData } from "../../kitTypes";

import {
  type DragAndDropHook,
  useVoicePanelDragHandlers,
} from "./useVoicePanelDragHandlers";
import {
  MAX_SLOTS_PER_VOICE,
  type SlotRenderingHook,
  useVoicePanelSlotRendering,
} from "./useVoicePanelSlotRendering";

// Re-export constant for backward compatibility
export { MAX_SLOTS_PER_VOICE };

export interface DragHandlers {
  onDragEnd?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export interface UseVoicePanelSlotsOptions {
  dragAndDropHook: DragAndDropHook;
  isActive: boolean;
  isEditable: boolean;
  kitName: string;
  onSampleSelect?: (voice: number, idx: number) => void;
  onWaveformPlayingChange: (
    voice: number,
    sample: string,
    playing: boolean,
  ) => void;
  playTriggers: { [key: string]: number };
  renderDeleteButton: (slotNumber: number) => React.ReactElement;
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

/**
 * Hook for rendering voice panel slot components
 * Extracted from useVoicePanelRendering to reduce complexity
 */
export function useVoicePanelSlots({
  dragAndDropHook,
  isActive,
  isEditable,
  kitName,
  onSampleSelect,
  onWaveformPlayingChange,
  playTriggers,
  renderDeleteButton,
  renderPlayButton,
  sampleActionsHook,
  sampleMetadata,
  samplePlaying,
  samples,
  selectedIdx,
  slotRenderingHook,
  stopTriggers,
  voice,
}: UseVoicePanelSlotsOptions) {
  // Use extracted drag handlers hook
  const {
    handleCombinedDragLeave,
    handleCombinedDragOver,
    handleCombinedDrop,
  } = useVoicePanelDragHandlers({
    dragAndDropHook,
    isEditable,
  });

  // Use extracted slot rendering hook
  const { renderSampleSlot, renderSampleSlots } = useVoicePanelSlotRendering({
    dragAndDropHook,
    handleCombinedDragLeave,
    handleCombinedDragOver,
    handleCombinedDrop,
    isActive,
    isEditable,
    kitName,
    onSampleSelect,
    onWaveformPlayingChange,
    playTriggers,
    renderDeleteButton,
    renderPlayButton,
    sampleActionsHook,
    sampleMetadata,
    samplePlaying,
    samples,
    selectedIdx,
    slotRenderingHook,
    stopTriggers,
    voice,
  });

  return {
    renderSampleSlot,
    renderSampleSlots,
  };
}

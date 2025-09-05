import React from "react";

import { MAX_SLOTS_PER_VOICE } from "./constants";
import { BaseVoicePanelOptions } from "./types";
import { useVoicePanelDragHandlers } from "./useVoicePanelDragHandlers";
import { useVoicePanelSlotRendering } from "./useVoicePanelSlotRendering";

// Re-export constant for backward compatibility
export { MAX_SLOTS_PER_VOICE };

export interface DragHandlers {
  onDragEnd?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

// Use shared base interface to eliminate duplication
export interface UseVoicePanelSlotsOptions extends BaseVoicePanelOptions {}

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

import React from "react";

import type { SampleData } from "../../kitTypes";

import { useVoicePanelButtons } from "./useVoicePanelButtons";
import { useVoicePanelSlots } from "./useVoicePanelSlots";
import { useVoicePanelUI } from "./useVoicePanelUI";

export interface UseVoicePanelRenderingOptions {
  // Hook dependencies
  dragAndDropHook: {
    dragOverSlot: null | number;
    dropZone: { mode: "append" | "blocked" | "insert"; slot: number } | null;
    getSampleDragHandlers: (slotNumber: number, sampleName: string) => unknown;
    handleDragLeave: () => void;
    handleDragOver: (e: React.DragEvent, slotNumber: number) => void;
    handleDrop: (e: React.DragEvent, slotNumber: number) => void;
    handleInternalDragOver: (e: React.DragEvent, slotNumber: number) => void;
    handleInternalDrop: (e: React.DragEvent, slotNumber: number) => void;
  };
  isActive: boolean;
  isEditable: boolean;
  kitName: string;
  onPlay: (voice: number, sample: string) => void;
  onSampleSelect?: (voice: number, idx: number) => void;
  onStop: (voice: number, sample: string) => void;
  onWaveformPlayingChange: (
    voice: number,
    sample: string,
    playing: boolean,
  ) => void;
  playTriggers: { [key: string]: number };
  sampleActionsHook: {
    handleDeleteSample: (slotNumber: number) => Promise<void>;
    handleSampleContextMenu: (
      e: React.MouseEvent,
      sampleData: SampleData | undefined,
    ) => void;
  };
  sampleMetadata?: { [filename: string]: SampleData };
  samplePlaying: { [key: string]: boolean };
  samples: string[];
  selectedIdx: number;
  slotRenderingHook: {
    calculateRenderSlots: () => {
      nextAvailableSlot: number;
      slotsToRender: number;
    };
    getSampleSlotClassName: (
      slotNumber: number,
      baseClass: string,
      dragOverClass: string,
    ) => string;
    getSampleSlotTitle: (
      slotNumber: number,
      sampleData: SampleData | undefined,
      isDragOver: boolean,
      isStereoHighlight: boolean,
      isDropZone: boolean,
      dropHintTitle: string,
    ) => string;
    getSlotStyling: (
      slotNumber: number,
      sample: string | undefined,
    ) => {
      dragOverClass: string;
      dropHintTitle: string;
      isDragOver: boolean;
      isDropZone: boolean;
      isStereoHighlight: boolean;
      slotBaseClass: string;
    };
  };

  stopTriggers: { [key: string]: number };
  voice: number;
  voiceName: null | string;
  voiceNameEditorHook: {
    editing: boolean;
    editValue: string;
    handleCancel: () => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handleSave: () => void;
    setEditValue: (value: string) => void;
    startEditing: () => void;
  };
}

/**
 * Hook for managing KitVoicePanel rendering functions
 * Refactored to use extracted sub-hooks for better organization
 */
export function useVoicePanelRendering({
  dragAndDropHook,
  isActive,
  isEditable,
  kitName,
  onPlay,
  onSampleSelect,
  onStop,
  onWaveformPlayingChange,
  playTriggers,
  sampleActionsHook,
  sampleMetadata,
  samplePlaying,
  samples,
  selectedIdx,
  slotRenderingHook,
  stopTriggers,
  voice,
  voiceName,
  voiceNameEditorHook,
}: UseVoicePanelRenderingOptions) {
  // Button rendering functions hook
  const buttons = useVoicePanelButtons({
    onPlay,
    onStop,
    sampleActionsHook,
    voice,
  });

  // Slot rendering functions hook
  const slots = useVoicePanelSlots({
    dragAndDropHook,
    isActive,
    isEditable,
    kitName,
    onSampleSelect,
    onWaveformPlayingChange,
    playTriggers,
    renderDeleteButton: buttons.renderDeleteButton,
    renderPlayButton: buttons.renderPlayButton,
    sampleActionsHook,
    sampleMetadata,
    samplePlaying,
    samples,
    selectedIdx,
    slotRenderingHook,
    stopTriggers,
    voice,
  });

  // UI element rendering functions hook
  const ui = useVoicePanelUI({
    isEditable,
    voice,
    voiceName,
    voiceNameEditorHook,
  });

  return {
    renderPlayButton: buttons.renderPlayButton,
    renderSampleSlot: slots.renderSampleSlot,
    renderSampleSlots: slots.renderSampleSlots,
    renderVoiceName: ui.renderVoiceName,
  };
}

import React from "react";

import type { SampleData } from "../../kitTypes";
import type { SlotPlaybackStore } from "../kit-management/slotPlaybackStore";
import type { SlotGainChange, SlotGainCommit } from "./types";

import { useVoicePanelButtons } from "./useVoicePanelButtons";
import { type DragHandlers, useVoicePanelSlots } from "./useVoicePanelSlots";
import { useVoicePanelUI } from "./useVoicePanelUI";

export interface UseVoicePanelRenderingOptions {
  // Hook dependencies
  dragAndDropHook: {
    dragOverSlot: null | number;
    dropZone: { mode: "append" | "blocked" | "insert"; slot: number } | null;
    getSampleDragHandlers: (
      slotNumber: number,
      sampleName: string,
    ) => DragHandlers;
    handleDragLeave: () => void;
    handleDragOver: (e: React.DragEvent, slotNumber: number) => void;
    handleDrop: (e: React.DragEvent, slotNumber: number) => void;
    handleInternalDragOver: (e: React.DragEvent, slotNumber: number) => void;
    handleInternalDrop: (e: React.DragEvent, slotNumber: number) => void;
  };
  /** The kit's sample details couldn't be read, or not yet: gains are unknown (#628) */
  gainsUnknown?: boolean;
  /** The kit's sample details couldn't be read, so previews don't play (#636) */
  gainsUnreadable?: boolean;
  isActive: boolean;
  isEditable: boolean;
  isLinkedPrimary?: boolean;
  kitName: string;
  /** The pair was linked by Romper, not by hand (#537): labelled */
  linkedAutomatically?: boolean;
  linkedWith?: number;
  onGainChange?: SlotGainChange;
  onGainCommit?: SlotGainCommit;
  onPlay: (voice: number, slot: number) => void;
  onSampleSelect?: (voice: number, idx: number) => void;
  onStop: (voice: number, slot: number) => void;
  onVoiceUnlink?: (primaryVoice: number) => void;
  onWaveformPlayingChange: (
    voice: number,
    slot: number,
    playing: boolean,
  ) => void;
  /** The voice is in a stereo pair, as the write makes it (#569) */
  playsStereo: boolean;
  sampleActionsHook: {
    handleDeleteSample: (slotNumber: number) => Promise<void>;
    handleSampleContextMenu: (
      e: React.MouseEvent,
      sampleData: SampleData | undefined,
    ) => void;
  };
  sampleMetadata?: { [slotKey: string]: SampleData }; // Keyed by slotKey(voice, slot)
  samples: string[];
  selectedIdx: number;
  /** Each slot's playback, read by the slot itself (#482) */
  slotPlayback: SlotPlaybackStore;

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
      slotBaseClass: string;
    };
  };
  /** A mono voice's note: its stereo samples are mixed down (#537) */
  stereoNote?: string;
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
  gainsUnknown,
  gainsUnreadable,
  isActive,
  isEditable,
  isLinkedPrimary,
  kitName,
  linkedAutomatically,
  linkedWith,
  onGainChange,
  onGainCommit,
  onPlay,
  onSampleSelect,
  onStop,
  onVoiceUnlink,
  onWaveformPlayingChange,
  playsStereo,
  sampleActionsHook,
  sampleMetadata,
  samples,
  selectedIdx,
  slotPlayback,
  slotRenderingHook,
  stereoNote,
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
    gainsUnknown,
    gainsUnreadable,
    isActive,
    isEditable,
    isLinkedPrimary,
    kitName,
    linkedWith,
    onGainChange,
    onGainCommit,
    onSampleSelect,
    onWaveformPlayingChange,
    playsStereo,
    renderDeleteButton: buttons.renderDeleteButton,
    renderPlayButton: buttons.renderPlayButton,
    sampleActionsHook,
    sampleMetadata,
    samples,
    selectedIdx,
    slotPlayback,
    slotRenderingHook,
    voice,
  });

  // UI element rendering functions hook
  const ui = useVoicePanelUI({
    isEditable,
    isLinkedPrimary,
    linkedAutomatically,
    linkedWith,
    onVoiceUnlink,
    stereoNote,
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

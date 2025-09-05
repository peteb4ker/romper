import React from "react";

import type { SampleData } from "../../kitTypes";

import SampleWaveform from "../../SampleWaveform";
import { MAX_SLOTS_PER_VOICE } from "./constants";
import { createCombinedDragHandlers } from "./dragUtils";
import { DragAndDropHook } from "./useVoicePanelDragHandlers";

// Re-export constant for backward compatibility
export { MAX_SLOTS_PER_VOICE };

export interface SlotRenderingHook {
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
    filename?: string,
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
}

export interface UseVoicePanelSlotRenderingOptions {
  dragAndDropHook: DragAndDropHook;
  handleCombinedDragLeave: () => void;
  handleCombinedDragOver: (e: React.DragEvent, slotNumber: number) => void;
  handleCombinedDrop: (e: React.DragEvent, slotNumber: number) => void;
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
 * Handles sample slot, drop zone, and empty slot rendering
 */
export function useVoicePanelSlotRendering({
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
}: UseVoicePanelSlotRenderingOptions) {
  // Helper to get slot styling properties (eliminates duplication)
  const getSlotStylingProps = React.useCallback(
    (slotNumber: number, sample?: string) => {
      return slotRenderingHook.getSlotStyling(slotNumber, sample);
    },
    [slotRenderingHook],
  );
  // Helper function to render a filled sample slot
  const renderSampleSlot = React.useCallback(
    (slotNumber: number, sample: string) => {
      const {
        dragOverClass,
        dropHintTitle,
        isDragOver,
        isDropZone,
        isStereoHighlight,
        slotBaseClass,
      } = getSlotStylingProps(slotNumber, sample);
      const sampleName = sample;
      const sampleKey = voice + ":" + sampleName;
      const isPlaying = samplePlaying[sampleKey];
      const uiSlotNumber = slotNumber + 1;
      const sampleData = sampleMetadata?.[sampleName];
      const isSelected = selectedIdx === slotNumber && isActive;

      const className = slotRenderingHook.getSampleSlotClassName(
        slotNumber,
        slotBaseClass,
        dragOverClass,
      );
      const title = slotRenderingHook.getSampleSlotTitle(
        slotNumber,
        sampleData,
        isDragOver,
        isStereoHighlight,
        isDropZone,
        dropHintTitle,
        sampleName,
      );
      const dragHandlers = dragAndDropHook.getSampleDragHandlers(
        slotNumber,
        sampleName,
      );

      // Combine internal drag handlers for drop targets - support both internal and external drops
      const combinedDragHandlers = isEditable
        ? {
            ...dragHandlers,
            ...createCombinedDragHandlers(
              dragHandlers,
              {
                onDragOver: handleCombinedDragOver,
                onDrop: handleCombinedDrop,
              },
              slotNumber,
            ),
          }
        : dragHandlers;

      return (
        <li
          aria-label={`Sample ${sampleName} in slot ${uiSlotNumber}`}
          aria-selected={isSelected}
          className={className}
          data-testid={
            isSelected ? `sample-selected-voice-${voice}` : undefined
          }
          draggable={isEditable}
          key={`${voice}-${slotNumber}-${sampleName}`}
          onClick={() => onSampleSelect && onSampleSelect(voice, slotNumber)}
          onContextMenu={(e) =>
            sampleActionsHook.handleSampleContextMenu(e, sampleData)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSampleSelect && onSampleSelect(voice, slotNumber);
            }
          }}
          role="option"
          tabIndex={0}
          title={title}
          {...combinedDragHandlers}
        >
          {renderPlayButton(isPlaying, sampleName)}
          <div className="flex-1 min-w-0">
            <span
              className="truncate text-xs font-mono font-medium text-gray-700 dark:text-gray-200"
              title={sampleName}
            >
              {sampleName}
            </span>
          </div>
          {isEditable && renderDeleteButton(slotNumber)}
          <SampleWaveform
            key={`${kitName}-${voice}-${uiSlotNumber}-${sampleName}`}
            kitName={kitName}
            onError={(err) => {
              if (typeof window !== "undefined" && window.dispatchEvent) {
                window.dispatchEvent(
                  new CustomEvent("SampleWaveformError", { detail: err }),
                );
              }
            }}
            onPlayingChange={(playing) =>
              onWaveformPlayingChange(voice, sample, playing)
            }
            playTrigger={playTriggers[sampleKey] || 0}
            slotNumber={slotNumber}
            stopTrigger={stopTriggers[sampleKey] || 0}
            voiceNumber={voice}
          />
        </li>
      );
    },
    [
      getSlotStylingProps,
      voice,
      samplePlaying,
      sampleMetadata,
      selectedIdx,
      isActive,
      isEditable,
      onSampleSelect,
      sampleActionsHook,
      dragAndDropHook,
      renderPlayButton,
      renderDeleteButton,
      kitName,
      onWaveformPlayingChange,
      playTriggers,
      stopTriggers,
      handleCombinedDragOver,
      handleCombinedDrop,
      slotRenderingHook,
    ],
  );

  // Helper function to render single drop zone per voice (append-only)
  const renderSingleDropZone = React.useCallback(() => {
    const { nextAvailableSlot } = slotRenderingHook.calculateRenderSlots();
    const sampleCount = samples.filter((s) => s).length;

    // Only show drop zone if editable and voice isn't full
    if (!isEditable || sampleCount >= MAX_SLOTS_PER_VOICE) {
      return null;
    }

    const {
      dragOverClass,
      dropHintTitle,
      isDragOver,
      isDropZone,
      isStereoHighlight,
      slotBaseClass,
    } = getSlotStylingProps(nextAvailableSlot, undefined);

    return (
      <li
        aria-label={`Drop zone for voice ${voice}`}
        className={`${slotBaseClass} text-gray-400 dark:text-gray-600 italic${dragOverClass} border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500 min-h-[28px] mb-1`}
        data-testid={`drop-zone-voice-${voice}`}
        key={`${voice}-drop-zone`}
        onDragLeave={isEditable ? handleCombinedDragLeave : undefined}
        onDragOver={
          isEditable
            ? (e) => handleCombinedDragOver(e, nextAvailableSlot)
            : undefined
        }
        onDrop={
          isEditable
            ? (e) => handleCombinedDrop(e, nextAvailableSlot)
            : undefined
        }
        title={
          isDragOver || isStereoHighlight || isDropZone
            ? dropHintTitle
            : `Drop WAV files here to add to voice ${voice}`
        }
      >
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-gray-400 dark:text-gray-500 text-center">
            Drop WAV files here
          </span>
        </div>
      </li>
    );
  }, [
    getSlotStylingProps,
    samples,
    voice,
    isEditable,
    handleCombinedDragOver,
    handleCombinedDragLeave,
    handleCombinedDrop,
    slotRenderingHook,
  ]);

  // Helper function to render an empty slot placeholder (non-interactive)
  const renderEmptySlot = React.useCallback(
    (slotNumber: number) => {
      return (
        <li
          className="min-h-[28px] mb-1 flex items-center text-gray-400 dark:text-gray-600"
          key={`${voice}-empty-${slotNumber}`}
        >
          {/* Empty slot - maintains height */}
        </li>
      );
    },
    [voice],
  );

  // Main render function for all sample slots (always render exactly MAX_SLOTS_PER_VOICE for consistent height)
  const renderSampleSlots = React.useCallback(() => {
    const renderedSlots = [];
    const sampleCount = samples.filter((s) => s).length;

    // Always render exactly MAX_SLOTS_PER_VOICE slot positions
    for (let i = 0; i < MAX_SLOTS_PER_VOICE; i++) {
      const sample = samples[i];
      if (sample) {
        // Render filled slot
        renderedSlots.push(renderSampleSlot(i, sample));
      } else if (
        i === sampleCount &&
        isEditable &&
        sampleCount < MAX_SLOTS_PER_VOICE
      ) {
        // Render the single drop zone at the first empty position (append-only)
        const dropZone = renderSingleDropZone();
        if (dropZone) {
          renderedSlots.push(dropZone);
        } else {
          // If drop zone can't be rendered, render empty slot
          renderedSlots.push(renderEmptySlot(i));
        }
      } else {
        // Render empty slot placeholder
        renderedSlots.push(renderEmptySlot(i));
      }
    }

    return renderedSlots;
  }, [
    samples,
    renderSampleSlot,
    renderSingleDropZone,
    renderEmptySlot,
    isEditable,
  ]);

  return {
    renderEmptySlot,
    renderSampleSlot,
    renderSampleSlots,
    renderSingleDropZone,
  };
}

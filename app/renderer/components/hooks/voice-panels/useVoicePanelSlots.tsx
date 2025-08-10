import React from "react";

import type { SampleData } from "../../kitTypes";

import SampleWaveform from "../../SampleWaveform";

export interface UseVoicePanelSlotsOptions {
  dragAndDropHook: {
    getSampleDragHandlers: (slotIndex: number, sampleName: string) => any;
    handleDragLeave: () => void;
    handleDragOver: (e: React.DragEvent, slotIndex: number) => void;
    handleDrop: (e: React.DragEvent, slotIndex: number) => void;
    handleInternalDragOver: (e: React.DragEvent, slotIndex: number) => void;
    handleInternalDrop: (e: React.DragEvent, slotIndex: number) => void;
  };
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
  renderDeleteButton: (slotIndex: number) => React.ReactElement;
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
  slotRenderingHook: {
    calculateRenderSlots: () => {
      nextAvailableSlot: number;
      slotsToRender: number;
    };
    getSampleSlotClassName: (
      slotIndex: number,
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
      slotIndex: number,
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
  // Combined drag handler for both external and internal drags
  const handleCombinedDragOver = React.useCallback(
    (e: React.DragEvent, slotIndex: number) => {
      if (!isEditable) return;

      // Handle both external and internal drags
      dragAndDropHook.handleDragOver(e, slotIndex);
      dragAndDropHook.handleInternalDragOver(e, slotIndex);
    },
    [isEditable, dragAndDropHook],
  );

  const handleCombinedDragLeave = React.useCallback(() => {
    if (!isEditable) return;

    // Handle both external and internal drag leave
    dragAndDropHook.handleDragLeave();
    // Internal drag leave is handled by the internal handler's own logic
  }, [isEditable, dragAndDropHook]);

  const handleCombinedDrop = React.useCallback(
    (e: React.DragEvent, slotIndex: number) => {
      if (!isEditable) return;

      // Handle both external and internal drops
      dragAndDropHook.handleDrop(e, slotIndex);
      dragAndDropHook.handleInternalDrop(e, slotIndex);
    },
    [isEditable, dragAndDropHook],
  );

  // Helper function to render a filled sample slot
  const renderSampleSlot = React.useCallback(
    (slotIndex: number, sample: string) => {
      const {
        dragOverClass,
        dropHintTitle,
        isDragOver,
        isDropZone,
        isStereoHighlight,
        slotBaseClass,
      } = slotRenderingHook.getSlotStyling(slotIndex, sample);
      const sampleName = sample;
      const sampleKey = voice + ":" + sampleName;
      const isPlaying = samplePlaying[sampleKey];
      const slotNumber = slotIndex + 1;
      const sampleData = sampleMetadata?.[sampleName];
      const isSelected = selectedIdx === slotIndex && isActive;

      const className = slotRenderingHook.getSampleSlotClassName(
        slotIndex,
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
      );
      const dragHandlers = dragAndDropHook.getSampleDragHandlers(
        slotIndex,
        sampleName,
      );

      // Combine internal drag handlers for drop targets
      const combinedDragHandlers = isEditable
        ? {
            ...dragHandlers,
            onDragOver: (e: React.DragEvent) => {
              // Call the original drag over handler first
              if (dragHandlers.onDragOver) {
                dragHandlers.onDragOver(e);
              }
              // Also handle external drags for potential replacement
              handleCombinedDragOver(e, slotIndex);
            },
            onDrop: (e: React.DragEvent) => {
              // Call the original drop handler first
              if (dragHandlers.onDrop) {
                dragHandlers.onDrop(e);
              }
              // Also handle external drops for potential replacement
              handleCombinedDrop(e, slotIndex);
            },
          }
        : dragHandlers;

      return (
        <li
          aria-label={`Sample ${sampleName} in slot ${slotIndex}`}
          aria-selected={isSelected}
          className={className}
          data-testid={
            isSelected ? `sample-selected-voice-${voice}` : undefined
          }
          draggable={isEditable}
          key={`${voice}-${slotIndex}-${sampleName}`}
          onClick={() => onSampleSelect && onSampleSelect(voice, slotIndex)}
          onContextMenu={(e) =>
            sampleActionsHook.handleSampleContextMenu(e, sampleData)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSampleSelect && onSampleSelect(voice, slotIndex);
            }
          }}
          role="option"
          tabIndex={0}
          title={title}
          {...combinedDragHandlers}
        >
          {renderPlayButton(isPlaying, sampleName)}
          <span
            className="truncate text-xs font-mono font-medium text-gray-700 dark:text-gray-200 flex-1"
            title={
              sampleData?.source_path
                ? `${sampleName}\nSource: ${sampleData.source_path}`
                : sampleName
            }
          >
            {sampleName}
          </span>
          {isEditable && renderDeleteButton(slotIndex)}
          <SampleWaveform
            key={`${kitName}-${voice}-${slotIndex}-${sampleName}`}
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
      slotRenderingHook,
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
    ],
  );

  // Helper function to render an empty slot
  const renderEmptySlot = React.useCallback(
    (slotIndex: number, isDropTarget: boolean) => {
      const {
        dragOverClass,
        dropHintTitle,
        isDragOver,
        isDropZone,
        isStereoHighlight,
        slotBaseClass,
      } = slotRenderingHook.getSlotStyling(slotIndex, undefined);

      return (
        <li
          aria-label={`Empty slot ${slotIndex}`}
          aria-selected={false}
          className={`${slotBaseClass} text-gray-400 dark:text-gray-600 italic${dragOverClass}${
            isEditable
              ? " border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500"
              : ""
          }`}
          data-testid={`empty-slot-${voice}-${slotIndex}`}
          draggable={false}
          key={`${voice}-empty-${slotIndex}`}
          onClick={() => onSampleSelect && onSampleSelect(voice, slotIndex)}
          onDragLeave={
            isEditable && isDropTarget ? handleCombinedDragLeave : undefined
          }
          onDragOver={
            isEditable && isDropTarget
              ? (e) => handleCombinedDragOver(e, slotIndex)
              : undefined
          }
          onDrop={
            isEditable && isDropTarget
              ? (e) => handleCombinedDrop(e, slotIndex)
              : undefined
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSampleSelect && onSampleSelect(voice, slotIndex);
            }
          }}
          role="option"
          tabIndex={0}
          title={
            isDragOver || isStereoHighlight || isDropZone
              ? dropHintTitle
              : undefined
          }
        >
          <div className="flex-1 flex items-center justify-center">
            {isEditable ? (
              <span className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Drop WAV file here
              </span>
            ) : (
              <div className="w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-sm"></div>
            )}
          </div>
        </li>
      );
    },
    [
      slotRenderingHook,
      isEditable,
      voice,
      onSampleSelect,
      handleCombinedDragOver,
      handleCombinedDragLeave,
      handleCombinedDrop,
    ],
  );

  // Main render function for all sample slots
  const renderSampleSlots = React.useCallback(() => {
    const { slotsToRender } = slotRenderingHook.calculateRenderSlots();
    const renderedSlots = [];

    for (let i = 0; i < slotsToRender; i++) {
      const sample = samples[i];
      // For external files, all empty slots should be drop targets
      // For internal moves, we can be more restrictive if needed
      const isDropTarget = !sample; // All empty slots are valid drop targets

      if (sample) {
        renderedSlots.push(renderSampleSlot(i, sample));
      } else {
        // Render all empty slots, with the next available slot as the drop target
        renderedSlots.push(renderEmptySlot(i, isDropTarget));
      }
    }

    return renderedSlots;
  }, [slotRenderingHook, samples, renderSampleSlot, renderEmptySlot]);

  return {
    renderEmptySlot,
    renderSampleSlot,
    renderSampleSlots,
  };
}

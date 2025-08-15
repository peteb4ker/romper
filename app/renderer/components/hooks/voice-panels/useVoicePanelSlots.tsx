import React from "react";

import type { SampleData } from "../../kitTypes";

import SampleWaveform from "../../SampleWaveform";

export interface UseVoicePanelSlotsOptions {
  dragAndDropHook: {
    getSampleDragHandlers: (slotNumber: number, sampleName: string) => any;
    handleDragLeave: () => void;
    handleDragOver: (e: React.DragEvent, slotNumber: number) => void;
    handleDrop: (e: React.DragEvent, slotNumber: number) => void;
    handleInternalDragOver: (e: React.DragEvent, slotNumber: number) => void;
    handleInternalDrop: (e: React.DragEvent, slotNumber: number) => void;
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
    (e: React.DragEvent, slotNumber: number) => {
      if (!isEditable) return;

      // Check if this is an internal sample drag
      const isInternalDrag = e.dataTransfer.types.includes(
        "application/x-romper-sample",
      );

      if (isInternalDrag) {
        // Internal drag: only call internal handler
        dragAndDropHook.handleInternalDragOver(e, slotNumber);
      } else {
        // External drag: only call external handler
        dragAndDropHook.handleDragOver(e, slotNumber);
      }
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
    (e: React.DragEvent, slotNumber: number) => {
      if (!isEditable) return;

      // Check if this is an internal sample drag
      const isInternalDrag = e.dataTransfer.types.includes(
        "application/x-romper-sample",
      );

      if (isInternalDrag) {
        // Internal drag: only call internal handler
        dragAndDropHook.handleInternalDrop(e, slotNumber);
      } else {
        // External drag: only call external handler
        dragAndDropHook.handleDrop(e, slotNumber);
      }
    },
    [isEditable, dragAndDropHook],
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
      } = slotRenderingHook.getSlotStyling(slotNumber, sample);
      const sampleName = sample;
      const sampleKey = voice + ":" + sampleName;
      const isPlaying = samplePlaying[sampleKey];
      const uiSlotNumber = slotNumber + 1;
      const sampleData = sampleMetadata?.[sampleName];
      const isSelected = selectedIdx === uiSlotNumber && isActive;

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
      );
      const dragHandlers = dragAndDropHook.getSampleDragHandlers(
        slotNumber,
        sampleName,
      );

      // Combine internal drag handlers for drop targets - support both internal and external drops
      const combinedDragHandlers = isEditable
        ? {
            ...dragHandlers,
            onDragOver: (e: React.DragEvent) => {
              // Check if this is an internal sample drag
              const isInternalDrag = e.dataTransfer.types.includes(
                "application/x-romper-sample",
              );

              if (isInternalDrag && dragHandlers.onDragOver) {
                // Internal drag: only call the original internal handler
                dragHandlers.onDragOver(e);
              } else {
                // External drag: call the combined handler for external drags
                handleCombinedDragOver(e, slotNumber);
              }
            },
            onDrop: (e: React.DragEvent) => {
              // Check if this is an internal sample drag
              const isInternalDrag = e.dataTransfer.types.includes(
                "application/x-romper-sample",
              );

              if (isInternalDrag && dragHandlers.onDrop) {
                // Internal drag: only call the original internal handler
                dragHandlers.onDrop(e);
              } else {
                // External drag: call the combined handler for external drops
                handleCombinedDrop(e, slotNumber);
              }
            },
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
          onClick={() => onSampleSelect && onSampleSelect(voice, uiSlotNumber)}
          onContextMenu={(e) =>
            sampleActionsHook.handleSampleContextMenu(e, sampleData)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSampleSelect && onSampleSelect(voice, uiSlotNumber);
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
    (slotNumber: number) => {
      if (!isEditable) {
        // Read-only empty slot
        return (
          <li
            className="min-h-[28px] mb-1 flex items-center text-gray-400 dark:text-gray-600"
            key={`${voice}-empty-${slotNumber}`}
          >
            {/* Empty slot - maintains height */}
          </li>
        );
      }

      // Editable empty slot - make it a drop zone
      const {
        dragOverClass,
        dropHintTitle,
        isDragOver,
        isDropZone,
        isStereoHighlight,
        slotBaseClass,
      } = slotRenderingHook.getSlotStyling(slotNumber, undefined);

      return (
        <li
          className={`${slotBaseClass} text-gray-400 dark:text-gray-600 min-h-[28px] mb-1${dragOverClass} border border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-400 dark:hover:border-orange-500`}
          key={`${voice}-empty-${slotNumber}`}
          onDragLeave={handleCombinedDragLeave}
          onDragOver={(e) => handleCombinedDragOver(e, slotNumber)}
          onDrop={(e) => handleCombinedDrop(e, slotNumber)}
          title={
            isDragOver || isStereoHighlight || isDropZone
              ? dropHintTitle
              : `Drop WAV files in slot ${slotNumber + 1}`
          }
        >
          {/* Empty droppable slot */}
        </li>
      );
    },
    [
      voice,
      isEditable,
      slotRenderingHook,
      handleCombinedDragLeave,
      handleCombinedDragOver,
      handleCombinedDrop,
    ],
  );

  // Main render function for all sample slots (always render 12 for consistent height)
  const renderSampleSlots = React.useCallback(() => {
    const renderedSlots = [];

    // Always render all 12 slots for consistent height
    for (let i = 0; i < 12; i++) {
      const sample = samples[i];
      if (sample) {
        // Render filled slot
        renderedSlots.push(renderSampleSlot(i, sample));
      } else {
        // Render empty slot (droppable if editable)
        renderedSlots.push(renderEmptySlot(i));
      }
    }

    return renderedSlots;
  }, [samples, renderSampleSlot, renderEmptySlot]);

  return {
    renderSampleSlot,
    renderSampleSlots,
  };
}

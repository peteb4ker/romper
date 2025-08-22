import React from "react";

import type { SampleData } from "../../kitTypes";

import SampleWaveform from "../../SampleWaveform";

// Maximum number of sample slots per voice (Squarp Rample limit)
export const MAX_SLOTS_PER_VOICE = 12;

export interface DragHandlers {
  onDragEnd?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export interface UseVoicePanelSlotsOptions {
  dragAndDropHook: {
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
    } = slotRenderingHook.getSlotStyling(nextAvailableSlot, undefined);

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
    slotRenderingHook,
    samples,
    voice,
    isEditable,
    handleCombinedDragOver,
    handleCombinedDragLeave,
    handleCombinedDrop,
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
    renderSampleSlot,
    renderSampleSlots,
  };
}

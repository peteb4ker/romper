import {
  SAMPLE_FILE_LABELS,
  STEREO_LABELS,
} from "@romper/shared/stereoLinkRules";
import React from "react";

import type { SampleData } from "../../kitTypes";

import { slotKey, slotSampleSource } from "../../../utils/slotKey";
import GainKnob from "../../GainKnob";
import SampleWaveform from "../../SampleWaveform";
import { MAX_SLOTS_PER_VOICE } from "./constants";
import { createCombinedDragHandlers } from "./dragUtils";
import { SlotWithPlayback } from "./SlotWithPlayback";
import { BaseVoicePanelOptions } from "./types";

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
    slotBaseClass: string;
  };
}

// Extends shared base interface with specific rendering handler requirements
export interface UseVoicePanelSlotRenderingOptions extends BaseVoicePanelOptions {
  handleCombinedDragLeave: () => void;
  handleCombinedDragOver: (e: React.DragEvent, slotNumber: number) => void;
  handleCombinedDrop: (e: React.DragEvent, slotNumber: number) => void;
  isLinkedPrimary?: boolean;
  linkedWith?: number;
}

/**
 * Hook for rendering voice panel slot components
 * Handles sample slot, drop zone, and empty slot rendering
 */
export function useVoicePanelSlotRendering({
  dragAndDropHook,
  gainsUnknown,
  gainsUnreadable,
  handleCombinedDragLeave,
  handleCombinedDragOver,
  handleCombinedDrop,
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
  renderDeleteButton,
  renderPlayButton,
  sampleActionsHook,
  sampleMetadata,
  samples,
  selectedIdx,
  slotPlayback,
  slotRenderingHook,
  voice,
}: UseVoicePanelSlotRenderingOptions) {
  // Helper to get slot styling properties (eliminates duplication)
  const getSlotStylingProps = React.useCallback(
    (slotNumber: number, sample?: string) => {
      return slotRenderingHook.getSlotStyling(slotNumber, sample);
    },
    [slotRenderingHook],
  );

  // Helper for conditional drag handlers (eliminates duplication)
  const getConditionalDragHandlers = React.useCallback(
    (slotNumber: number) => ({
      onDragLeave: isEditable ? handleCombinedDragLeave : undefined,
      onDragOver: isEditable
        ? (e: React.DragEvent) => handleCombinedDragOver(e, slotNumber)
        : undefined,
      onDrop: isEditable
        ? (e: React.DragEvent) => handleCombinedDrop(e, slotNumber)
        : undefined,
    }),
    [
      isEditable,
      handleCombinedDragLeave,
      handleCombinedDragOver,
      handleCombinedDrop,
    ],
  );
  // Helper function to render a filled sample slot
  const renderSampleSlot = React.useCallback(
    (slotNumber: number, sample: string) => {
      const {
        dragOverClass,
        dropHintTitle,
        isDragOver,
        isDropZone,
        slotBaseClass,
      } = getSlotStylingProps(slotNumber, sample);
      const sampleName = sample;
      const displayName =
        sampleName.length > 20
          ? sampleName.slice(0, 20) + "\u2026"
          : sampleName;
      // Playback and metadata are keyed by slot, not file name (RE-45)
      const sampleKey = slotKey(voice, slotNumber);
      const uiSlotNumber = slotNumber + 1;
      const sampleData = sampleMetadata?.[sampleKey];
      const isSelected = selectedIdx === slotNumber && isActive;
      // A mono sample in a stereo pair quarantines the kit (#537, #574)
      const monoInPair = Boolean(
        isLinkedPrimary && sampleData?.wav_channels === 1,
      );
      const monoLabelId = `mono-in-pair-${kitName}-${voice}-${slotNumber}`;
      // A file that's missing or can't be read says so (#537)
      const fileStatus = sampleData?.source_status;
      const fileLabel =
        fileStatus === "missing" || fileStatus === "unreadable"
          ? SAMPLE_FILE_LABELS[fileStatus]
          : null;
      const fileLabelId = `sample-file-${kitName}-${voice}-${slotNumber}`;
      const describedBy =
        [monoInPair && monoLabelId, fileLabel && fileLabelId]
          .filter(Boolean)
          .join(" ") || undefined;

      const className = slotRenderingHook.getSampleSlotClassName(
        slotNumber,
        slotBaseClass,
        dragOverClass,
      );
      const title = slotRenderingHook.getSampleSlotTitle(
        slotNumber,
        sampleData,
        isDragOver,
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

      // The slot reads its own playback, so a trigger re-renders only the
      // slots it plays or stops (#482). Each slot is a grid row whose
      // controls sit in cells, so assistive technology reaches them; a
      // listbox option can't hold buttons or a slider (#522)
      return (
        <SlotWithPlayback
          key={`${voice}-${slotNumber}-${sampleName}`}
          slotKey={sampleKey}
          store={slotPlayback}
        >
          {(playback) => (
            <li
              aria-describedby={describedBy}
              aria-label={`Sample ${sampleName} in slot ${uiSlotNumber}`}
              aria-selected={isSelected}
              className={className}
              data-playing={playback.playing}
              data-testid={
                isSelected ? `sample-selected-voice-${voice}` : undefined
              }
              draggable={isEditable}
              onClick={() => onSampleSelect?.(voice, slotNumber)}
              onContextMenu={(e) =>
                sampleActionsHook.handleSampleContextMenu(e, sampleData)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSampleSelect?.(voice, slotNumber);
                }
              }}
              role="row"
              tabIndex={0}
              title={title}
              {...combinedDragHandlers}
            >
              <SlotCell>
                {renderPlayButton(playback.playing, slotNumber)}
              </SlotCell>
              <div className="flex-1 min-w-0" role="gridcell">
                <span
                  className="block truncate text-xs font-mono font-medium text-text-primary"
                  title={sampleName}
                >
                  {displayName}
                </span>
                {monoInPair && (
                  <span
                    className="block truncate text-[10px] text-accent-warning"
                    data-testid={`mono-in-pair-label-${voice}-${slotNumber}`}
                    id={monoLabelId}
                  >
                    {STEREO_LABELS.monoInPair}
                  </span>
                )}
                {fileLabel && (
                  <span
                    className={`block truncate text-[10px] ${
                      // Missing is skipped at write; unreadable quarantines
                      fileStatus === "missing"
                        ? "text-accent-warning"
                        : "text-accent-danger"
                    }`}
                    data-testid={`sample-file-label-${voice}-${slotNumber}`}
                    id={fileLabelId}
                  >
                    {fileLabel}
                  </span>
                )}
              </div>
              {isEditable && (
                <SlotCell>
                  <GainKnob
                    onChange={(db) =>
                      onGainChange?.(voice, slotNumber, sampleName, db)
                    }
                    onCommit={(db, fromDb) =>
                      // The parent saves it and reports a failure (RE-91)
                      onGainCommit?.(voice, slotNumber, sampleName, db, fromDb)
                    }
                    value={gainsUnknown ? null : (sampleData?.gain_db ?? 0)}
                  />
                </SlotCell>
              )}
              {isEditable && (
                <SlotCell>
                  {renderDeleteButton(slotNumber, sampleName)}
                </SlotCell>
              )}
              <SampleWaveform
                // Unread, the gain plays at 0 dB; unreadable, nothing plays (#636)
                gainDb={gainsUnreadable ? null : sampleData?.gain_db}
                key={`${kitName}-${voice}-${uiSlotNumber}-${sampleName}`}
                kitName={kitName}
                onError={(err) => {
                  if (
                    typeof globalThis !== "undefined" &&
                    globalThis.dispatchEvent
                  ) {
                    globalThis.dispatchEvent(
                      new CustomEvent("SampleWaveformError", { detail: err }),
                    );
                  }
                }}
                onPlayingChange={(playing) =>
                  onWaveformPlayingChange(voice, slotNumber, playing)
                }
                playOptions={playback.options}
                playsStereo={playsStereo}
                playTrigger={playback.playTrigger}
                sampleSource={slotSampleSource(sampleData, sampleName)}
                slotNumber={slotNumber}
                stopTrigger={playback.stopTrigger}
                voiceColor={`var(--voice-${voice})`}
                voiceNumber={voice}
                volume={playback.volume}
              />
            </li>
          )}
        </SlotWithPlayback>
      );
    },
    [
      getSlotStylingProps,
      voice,
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
      playsStereo,
      slotPlayback,
      handleCombinedDragOver,
      handleCombinedDrop,
      onGainChange,
      onGainCommit,
      slotRenderingHook,
      isLinkedPrimary,
      gainsUnknown,
      gainsUnreadable,
    ],
  );

  // Helper function to render single drop zone per voice (append-only)
  const renderSingleDropZone = React.useCallback(() => {
    const { nextAvailableSlot } = slotRenderingHook.calculateRenderSlots();
    const sampleCount = samples.filter(Boolean).length;

    // Only show drop zone if editable and voice isn't full
    if (!isEditable || sampleCount >= MAX_SLOTS_PER_VOICE) {
      return null;
    }

    const {
      dragOverClass,
      dropHintTitle,
      isDragOver,
      isDropZone,
      slotBaseClass,
    } = getSlotStylingProps(nextAvailableSlot);

    return (
      <li
        aria-label={`Drop zone for voice ${voice}`}
        className={`${slotBaseClass} text-text-tertiary italic${dragOverClass} border-2 border-dashed border-border-default hover:border-accent-sync min-h-[28px] mb-1`}
        data-testid={`drop-zone-voice-${voice}`}
        key={`${voice}-drop-zone`}
        role="row"
        {...getConditionalDragHandlers(nextAvailableSlot)}
        title={(() => {
          if (isDragOver || isDropZone) return dropHintTitle;
          if (isLinkedPrimary && linkedWith)
            return `Drop stereo WAV files here for voices ${voice} and ${linkedWith}`;
          return `Drop WAV files here to add to voice ${voice}`;
        })()}
      >
        <div
          className="flex-1 flex items-center justify-center"
          role="gridcell"
        >
          <span className="text-sm text-text-tertiary text-center">
            {isLinkedPrimary && linkedWith
              ? `Drop WAV files here (stereo · voices ${voice} + ${linkedWith})`
              : "Drop WAV files here"}
          </span>
        </div>
      </li>
    );
  }, [
    getSlotStylingProps,
    getConditionalDragHandlers,
    samples,
    voice,
    isEditable,
    isLinkedPrimary,
    linkedWith,
    slotRenderingHook,
  ]);

  // Helper function to render an empty slot placeholder (non-interactive).
  // It only holds the panel's height, so it's no row of the grid (#522).
  const renderEmptySlot = React.useCallback(
    (slotNumber: number) => {
      return (
        <li
          aria-hidden="true"
          className="min-h-[28px] mb-1 flex items-center text-text-tertiary"
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
    const sampleCount = samples.filter(Boolean).length;

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

/**
 * A cell of a sample row that leaves the row's layout alone: it has no box
 * of its own (display: contents), so the control inside stays a flex item
 * of the row, as it was before the row became a grid row (#522).
 */
function SlotCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="contents" role="gridcell">
      {children}
    </div>
  );
}

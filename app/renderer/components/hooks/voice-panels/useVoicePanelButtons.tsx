import { PlayIcon, StopIcon } from "@phosphor-icons/react";
import React from "react";

import SampleDeleteButton from "../../SampleDeleteButton";

export interface UseVoicePanelButtonsOptions {
  onPlay: (voice: number, sample: string) => void;
  onStop: (voice: number, sample: string) => void;
  sampleActionsHook: {
    handleDeleteSample: (slotNumber: number) => Promise<void>;
  };
  voice: number;
}

/**
 * Hook for rendering voice panel buttons (play/stop/delete)
 * Extracted from useVoicePanelRendering to reduce complexity
 */
export function useVoicePanelButtons({
  onPlay,
  onStop,
  sampleActionsHook,
  voice,
}: UseVoicePanelButtonsOptions) {
  // Helper function to render play/stop button
  const renderPlayButton = React.useCallback(
    (isPlaying: boolean, sampleName: string) => {
      const buttonStyle = {
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        minHeight: 24,
        minWidth: 24,
      };

      if (isPlaying) {
        return (
          <button
            aria-label="Stop"
            className="p-1 rounded hover:bg-surface-3 text-xs text-accent-danger"
            onClick={() => onStop(voice, sampleName)}
            style={buttonStyle}
          >
            <StopIcon size={14} />
          </button>
        );
      }

      return (
        <button
          aria-label="Play"
          className="p-1 rounded hover:bg-surface-3 text-xs"
          onClick={() => onPlay(voice, sampleName)}
          style={buttonStyle}
        >
          <PlayIcon size={14} />
        </button>
      );
    },
    [onPlay, onStop, voice],
  );

  // Helper function to render delete button. It asks first when "Confirm
  // destructive actions" is on (RE-44).
  const renderDeleteButton = React.useCallback(
    (slotNumber: number, sampleName?: string) => (
      <SampleDeleteButton
        onDelete={() => {
          void sampleActionsHook.handleDeleteSample(slotNumber);
        }}
        sampleName={sampleName}
      />
    ),
    [sampleActionsHook],
  );

  return {
    renderDeleteButton,
    renderPlayButton,
  };
}

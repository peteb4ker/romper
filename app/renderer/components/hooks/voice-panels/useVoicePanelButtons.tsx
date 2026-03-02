import React from "react";
import { FiPlay, FiSquare, FiTrash2 } from "react-icons/fi";

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
            <FiSquare />
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
          <FiPlay />
        </button>
      );
    },
    [onPlay, onStop, voice],
  );

  // Helper function to render delete button
  const renderDeleteButton = React.useCallback(
    (slotNumber: number) => (
      <button
        aria-label="Delete sample"
        className="p-1 rounded hover:bg-accent-danger/15 text-xs text-accent-danger ml-2"
        onClick={(e) => {
          e.stopPropagation();
          sampleActionsHook.handleDeleteSample(slotNumber);
        }}
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          minHeight: 24,
          minWidth: 24,
        }}
        title="Delete sample"
      >
        <FiTrash2 />
      </button>
    ),
    [sampleActionsHook],
  );

  return {
    renderDeleteButton,
    renderPlayButton,
  };
}

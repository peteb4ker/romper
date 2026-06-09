import React from "react";

interface UseKitErrorReportingParams {
  kitError: null | string;
  onMessage?: (text: string, type?: string, duration?: number) => void;
  playbackError: null | string;
}

/**
 * Forwards kit editor errors to the parent message handler: playback errors,
 * kit loading errors, and SampleWaveform errors bubbled up from children via
 * the global "SampleWaveformError" custom event.
 */
export function useKitErrorReporting({
  kitError,
  onMessage,
  playbackError,
}: UseKitErrorReportingParams) {
  React.useEffect(() => {
    if (playbackError && onMessage) {
      onMessage(playbackError, "error");
    }
  }, [playbackError, onMessage]);

  React.useEffect(() => {
    if (kitError && onMessage) {
      onMessage(kitError, "error");
    }
  }, [kitError, onMessage]);

  // Listen for SampleWaveform errors bubbled up from children
  React.useEffect(() => {
    if (!onMessage) return;
    const handler = (e: CustomEvent) => {
      onMessage(e.detail, "error");
    };
    globalThis.addEventListener(
      "SampleWaveformError",
      handler as EventListener,
    );
    return () => {
      globalThis.removeEventListener(
        "SampleWaveformError",
        handler as EventListener,
      );
    };
  }, [onMessage]);
}

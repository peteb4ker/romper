import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";

import React from "react";

interface UseKitEditorKeyboardNavParams {
  isEditable: boolean;
  onInferVoiceNames: () => void;
  onNextKit?: () => void;
  onPlaySample: (voice: number, sample: string) => void;
  onPrevKit?: () => void;
  onSampleKeyNav: (direction: "down" | "up") => void;
  onScanKit: () => void;
  samples: VoiceSamples;
  selectedSampleIdx: number;
  selectedVoice: number;
  sequencerOpen: boolean;
  setSequencerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Global keyboard shortcuts for the kit editor: kit navigation (, .),
 * scanning (/), sequencer toggle (s), and sample navigation/preview
 * (arrows + space) while the sequencer is closed.
 */
export function useKitEditorKeyboardNav({
  isEditable,
  onInferVoiceNames,
  onNextKit,
  onPlaySample,
  onPrevKit,
  onSampleKeyNav,
  onScanKit,
  samples,
  selectedSampleIdx,
  selectedVoice,
  sequencerOpen,
  setSequencerOpen,
}: UseKitEditorKeyboardNavParams) {
  React.useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      // Ignore if a modal, input, textarea, or contenteditable is focused
      const active = document.activeElement;
      if (
        active &&
        ((active.tagName === "INPUT" &&
          (active as HTMLInputElement).type !== "checkbox") ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // Kit navigation shortcuts
      if (e.key === ",") {
        e.preventDefault();
        onPrevKit?.();
        return;
      }
      if (e.key === ".") {
        e.preventDefault();
        onNextKit?.();
        return;
      }
      // Kit scanning shortcut (context-aware: editable kits use in-memory inference)
      if (e.key === "/") {
        e.preventDefault();
        if (isEditable) {
          onInferVoiceNames();
        } else {
          onScanKit();
        }
        return;
      }
      // S key toggles sequencer
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSequencerOpen((open) => !open);
        return;
      }
      // Only handle navigation keys for sample nav if sequencer is closed
      // Enter key removed to prevent conflicts with kit name editing
      if (!sequencerOpen && [" ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        if (e.key === "ArrowDown") {
          onSampleKeyNav("down");
        } else if (e.key === "ArrowUp") {
          onSampleKeyNav("up");
        } else if (e.key === " ") {
          // Preview/play selected sample with Space key only
          const samplesForVoice = samples[selectedVoice] || [];
          const sample = samplesForVoice[selectedSampleIdx];
          if (sample) {
            onPlaySample(selectedVoice, sample);
          }
        }
      }
    }
    globalThis.addEventListener("keydown", handleGlobalKeyDown);
    return () => globalThis.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    sequencerOpen,
    selectedVoice,
    selectedSampleIdx,
    samples,
    onPlaySample,
    onSampleKeyNav,
    onPrevKit,
    onNextKit,
    isEditable,
    onInferVoiceNames,
    onScanKit,
    setSequencerOpen,
  ]);
}

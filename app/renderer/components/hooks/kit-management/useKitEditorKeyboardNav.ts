import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";

import React from "react";

type SampleNavParams = Pick<
  UseKitEditorKeyboardNavParams,
  | "onPlaySample"
  | "onSampleKeyNav"
  | "samples"
  | "selectedSampleIdx"
  | "selectedVoice"
>;

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
      if (isTypingTarget(document.activeElement)) {
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
        handleSampleNavKey(e.key, {
          onPlaySample,
          onSampleKeyNav,
          samples,
          selectedSampleIdx,
          selectedVoice,
        });
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

/** Handle the sample navigation/preview keys (arrows + space). */
function handleSampleNavKey(key: string, params: SampleNavParams): void {
  if (key === "ArrowDown") {
    params.onSampleKeyNav("down");
    return;
  }
  if (key === "ArrowUp") {
    params.onSampleKeyNav("up");
    return;
  }
  // Preview/play selected sample with Space key only
  const sample = (params.samples[params.selectedVoice] || [])[
    params.selectedSampleIdx
  ];
  if (sample) {
    params.onPlaySample(params.selectedVoice, sample);
  }
}

/** True when focus is in a text-entry field, where shortcuts must not fire. */
function isTypingTarget(active: Element | null): boolean {
  if (!active) {
    return false;
  }
  if (active.tagName === "INPUT") {
    return (active as HTMLInputElement).type !== "checkbox";
  }
  return (
    active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable
  );
}

import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";

import React from "react";

import {
  hasCommandModifier,
  isFavoriteKey,
  usesSpaceItself,
} from "../../../utils/keyboardShortcuts";
import { isModalDialogOpen } from "../../../utils/modalDialog";
import { useLatestRef } from "../shared/useLatestRef";

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
  onPlaySample: (voice: number, slot: number) => void;
  onPrevKit?: () => void;
  onSampleKeyNav: (direction: "down" | "up") => void;
  onScanKit: () => void;
  onToggleFavorite?: () => Promise<void> | void;
  samples: VoiceSamples;
  selectedSampleIdx: number;
  selectedVoice: number;
  sequencerOpen: boolean;
  setSequencerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Global keyboard shortcuts for the kit editor: kit navigation (, .),
 * scanning (/), sequencer toggle (s), favorite (;), and sample navigation/preview
 * (arrows + space) while the sequencer is closed. Space on a focused button
 * or field is the control's, not the preview's.
 */
export function useKitEditorKeyboardNav(params: UseKitEditorKeyboardNavParams) {
  // The listener reads the latest params, so it subscribes once rather than
  // on every render, when the editor passes new callbacks (#462)
  const paramsRef = useLatestRef(params);
  React.useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      const {
        isEditable,
        onInferVoiceNames,
        onNextKit,
        onPlaySample,
        onPrevKit,
        onSampleKeyNav,
        onScanKit,
        onToggleFavorite,
        samples,
        selectedSampleIdx,
        selectedVoice,
        sequencerOpen,
        setSequencerOpen,
      } = paramsRef.current;
      // Ignore if a modal, input, textarea, or contenteditable is focused
      if (isTypingTarget(document.activeElement)) {
        return;
      }
      // Keys pressed in a dialog are the dialog's (#500)
      if (isModalDialogOpen()) {
        return;
      }
      // Cmd/Ctrl/Alt combinations belong to the menu and the system: Cmd+,
      // opens Preferences and must not also step to the previous kit
      if (hasCommandModifier(e)) {
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
      // ";" makes the open kit a favorite, or stops it being one (#552)
      if (isFavoriteKey(e)) {
        if (onToggleFavorite) {
          e.preventDefault();
          void onToggleFavorite();
        }
        return;
      }
      // Only handle navigation keys for sample nav if sequencer is closed
      // Enter key removed to prevent conflicts with kit name editing.
      if (!sequencerOpen && isSampleNavKey(e)) {
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
  }, [paramsRef]);
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
    params.onPlaySample(params.selectedVoice, params.selectedSampleIdx);
  }
}

/**
 * Whether the arrows or Space drive the sample list. A key something else
 * already handled is left alone: Space on a focused sample row is the voice
 * panel list's, and playing it here too started the sample twice (#505).
 * Space on a focused button, checkbox or field presses that control instead
 * of playing the selected sample (#613).
 */
function isSampleNavKey(e: KeyboardEvent): boolean {
  if (e.defaultPrevented) {
    return false;
  }
  if (e.key === " ") {
    return !usesSpaceItself(e.target);
  }
  return e.key === "ArrowDown" || e.key === "ArrowUp";
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

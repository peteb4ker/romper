import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";

import React from "react";

import {
  hasCommandModifier,
  isContextMenuKey,
  isFavoriteKey,
  sampleMoveDirection,
  type SampleMoveDirection,
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
  /** Alt+arrows: move the selected sample a slot or a voice (#522) */
  onMoveSample?: (direction: SampleMoveDirection) => Promise<void> | void;
  onNextKit?: () => void;
  onPlaySample: (voice: number, slot: number) => void;
  onPrevKit?: () => void;
  onSampleKeyNav: (direction: "down" | "up") => void;
  onScanKit: () => void;
  /** Shift+F10 or the context-menu key: what right-clicking it does (#522) */
  onShowSampleFile?: () => void;
  onToggleFavorite?: () => Promise<void> | void;
  samples: VoiceSamples;
  selectedSampleIdx: number;
  selectedVoice: number;
  sequencerOpen: boolean;
  setSequencerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Global keyboard shortcuts for the kit editor: kit navigation (, .),
 * scanning (/), sequencer toggle (s), favorite (;), sample navigation/preview
 * (arrows + space) while the sequencer is closed, and on the selected
 * sample, moving it (Alt+arrows) and its right-click (Shift+F10 or the
 * context-menu key). Space on a focused button or field is the control's,
 * not the preview's.
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
      if (!isEditorKey()) {
        return;
      }
      // Alt+arrows (Option+arrows on macOS) move the selected sample.
      // Before the modifier check below, which leaves Alt presses alone.
      if (handleSampleKey(e, paramsRef.current)) {
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
    // On Windows the context-menu key opens a right-click when it's
    // released; the key down already did, so the release mustn't again
    function handleGlobalKeyUp(e: KeyboardEvent) {
      if (
        e.key === "ContextMenu" &&
        isEditorKey() &&
        paramsRef.current.onShowSampleFile
      ) {
        e.preventDefault();
      }
    }
    globalThis.addEventListener("keydown", handleGlobalKeyDown);
    globalThis.addEventListener("keyup", handleGlobalKeyUp);
    return () => {
      globalThis.removeEventListener("keydown", handleGlobalKeyDown);
      globalThis.removeEventListener("keyup", handleGlobalKeyUp);
    };
  }, [paramsRef]);
}

/**
 * The keys on the selected sample (#522): Alt+arrows move it, Shift+F10 or
 * the context-menu key does what right-clicking it does. A key something
 * else handled, such as Shift+F10 on a sequencer step, is left alone.
 * Returns true when the key is one of them.
 */
function handleSampleKey(
  e: KeyboardEvent,
  params: Pick<
    UseKitEditorKeyboardNavParams,
    "onMoveSample" | "onShowSampleFile"
  >,
): boolean {
  const direction = sampleMoveDirection(e);
  if (direction) {
    if (params.onMoveSample && !e.defaultPrevented) {
      e.preventDefault();
      void params.onMoveSample(direction);
    }
    return true;
  }
  if (isContextMenuKey(e)) {
    if (params.onShowSampleFile && !e.defaultPrevented) {
      // Also stops Windows and Linux opening a right-click of their own
      e.preventDefault();
      params.onShowSampleFile();
    }
    return true;
  }
  return false;
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
 * Whether keys are the kit editor's at all: not while typing in a field,
 * and not while a dialog is open, since keys pressed in a dialog are the
 * dialog's (#500)
 */
function isEditorKey(): boolean {
  return !isTypingTarget(document.activeElement) && !isModalDialogOpen();
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

import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";
import type { KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import type { SampleMoveDirection } from "../../../utils/keyboardShortcuts";

import { showSampleFile } from "../sample-management/useSampleActions";

/** Where a move key sends a sample */
export interface SampleMoveTarget {
  toSlot: number;
  toVoice: number;
}

/** A moved sample whose row takes focus once the kit shows the move */
interface PendingFocus {
  name: string;
  slot: number;
  voice: number;
}

interface UseSampleMoveKeysParams {
  isEditable: boolean;
  kit: KitWithRelations | null;
  /** The drag's move (UC-21): resolves true once the sample has moved */
  onSampleMove: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => Promise<boolean>;
  samples: VoiceSamples;
  selectedSampleIdx: number;
  selectedVoice: number;
  setSelectedSampleIdx: (idx: number) => void;
  setSelectedVoice: (voice: number) => void;
}

/**
 * Where a move key sends the sample in `slot` of `voice`, or null when it
 * stays put. Up and Down swap it with its neighbor in the voice; Left and
 * Right move it to the same slot of the previous or next voice on screen,
 * or after that voice's last sample, as dropping it on that row would.
 * The right-hand voice of a stereo pair isn't on screen, so it's skipped,
 * as it is for a drag. Nothing wraps around: the first slot doesn't go up,
 * the last sample doesn't go down, voice 1 doesn't go left and voice 4
 * doesn't go right (#522).
 */
export function moveKeyTarget(
  direction: SampleMoveDirection,
  voice: number,
  slot: number,
  samples: VoiceSamples,
  hiddenVoices: ReadonlySet<number>,
): null | SampleMoveTarget {
  const voiceSamples = samples[voice] ?? [];
  if (!voiceSamples[slot]) {
    return null;
  }
  if (direction === "up") {
    return slot > 0 ? { toSlot: slot - 1, toVoice: voice } : null;
  }
  if (direction === "down") {
    return voiceSamples[slot + 1] ? { toSlot: slot + 1, toVoice: voice } : null;
  }
  const step = direction === "left" ? -1 : 1;
  let toVoice = voice + step;
  while (hiddenVoices.has(toVoice)) {
    toVoice += step;
  }
  if (toVoice < 1 || toVoice > 4) {
    return null;
  }
  const destinationCount = (samples[toVoice] ?? []).filter(Boolean).length;
  return { toSlot: Math.min(slot, destinationCount), toVoice };
}

/**
 * The kit editor's keys on the selected sample (Q-06, #522): Alt+arrows
 * (Option+arrows on macOS) move it through the same move a drag makes, so
 * it's undoable and marks the kit modified like a drag (UC-21, UC-26), and
 * Shift+F10 or the context-menu key does what right-clicking its row does:
 * show its file in Finder or Explorer (UC-25). The selection, and focus if
 * it was in a sample list, follow the moved sample.
 */
export function useSampleMoveKeys({
  isEditable,
  kit,
  onSampleMove,
  samples,
  selectedSampleIdx,
  selectedVoice,
  setSelectedSampleIdx,
  setSelectedVoice,
}: UseSampleMoveKeysParams) {
  // One move at a time: a key held down or pressed again before the kit
  // shows the last move would move whatever is in the old slot
  const moving = React.useRef(false);
  const pendingFocus = React.useRef<null | PendingFocus>(null);

  const moveSelectedSample = React.useCallback(
    async (direction: SampleMoveDirection) => {
      // A read-only kit can't be dragged in either
      if (!isEditable || moving.current) {
        return;
      }
      const name = samples[selectedVoice]?.[selectedSampleIdx];
      const target = moveKeyTarget(
        direction,
        selectedVoice,
        selectedSampleIdx,
        samples,
        linkedPartnerVoices(kit),
      );
      if (!name || !target) {
        return;
      }
      const keepFocus = focusIsInSampleList();
      moving.current = true;
      try {
        const moved = await onSampleMove(
          selectedVoice,
          selectedSampleIdx,
          target.toVoice,
          target.toSlot,
        );
        if (!moved) {
          return;
        }
        if (keepFocus) {
          pendingFocus.current = {
            name,
            slot: target.toSlot,
            voice: target.toVoice,
          };
        }
        setSelectedVoice(target.toVoice);
        setSelectedSampleIdx(target.toSlot);
      } finally {
        moving.current = false;
      }
    },
    [
      isEditable,
      kit,
      onSampleMove,
      samples,
      selectedSampleIdx,
      selectedVoice,
      setSelectedSampleIdx,
      setSelectedVoice,
    ],
  );

  // Focus the moved sample's row once the kit shows it there: its row is
  // a new element, and the one that had focus is gone
  React.useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) {
      return;
    }
    const shown =
      selectedVoice === pending.voice &&
      selectedSampleIdx === pending.slot &&
      samples[pending.voice]?.[pending.slot] === pending.name;
    if (!shown) {
      return;
    }
    pendingFocus.current = null;
    document
      .querySelector<HTMLElement>(
        `[data-testid="sample-selected-voice-${pending.voice}"]`,
      )
      ?.focus();
  }, [samples, selectedSampleIdx, selectedVoice]);

  const showSelectedSampleFile = React.useCallback(() => {
    const row = kit?.samples?.find(
      (s) =>
        s.voice_number === selectedVoice && s.slot_number === selectedSampleIdx,
    );
    if (row) {
      showSampleFile(row);
    }
  }, [kit, selectedSampleIdx, selectedVoice]);

  return { moveSelectedSample, showSelectedSampleFile };
}

/** True when focus is in one of the kit editor's sample lists */
function focusIsInSampleList(): boolean {
  const active = document.activeElement as HTMLElement | null;
  return Boolean(active?.closest?.('[data-testid^="sample-list-voice-"]'));
}

/**
 * The right-hand voices of the kit's stereo pairs, which the kit editor
 * hides and nothing can be added to
 */
function linkedPartnerVoices(kit: KitWithRelations | null): Set<number> {
  const hidden = new Set<number>();
  for (const voice of kit?.voices ?? []) {
    if (voice.stereo_mode) {
      hidden.add(voice.voice_number + 1);
    }
  }
  return hidden;
}

import { useCallback, useRef, useState } from "react";

import type { PlayOptions } from "../../kitTypes";

import { slotKey } from "../../../utils/slotKey";
import { createSlotPlaybackStore } from "./slotPlaybackStore";

/**
 * Playback state for the kit editor's samples, keyed by slot ("voice:slot",
 * see `slotKey`). Not by file name: two samples with the same name, in one
 * voice or two, are separate sounds (RE-45). A slot nothing has played reads
 * as 0 triggers, not playing.
 *
 * The state is in a per-slot store (`slotPlaybackStore`), not React state:
 * a trigger re-renders only the slots it plays or stops, not the whole
 * editor (#482). The handlers keep their identity across renders.
 *
 * Nothing here resets when the kit's samples are reloaded. It used to: every
 * step, condition, mode, volume or alias edit reloads the kit, and the reset
 * cleared "playing" while samples still sounded, so the next trigger on that
 * voice didn't choke them (RE-13).
 */
export function useKitPlayback() {
  // Nothing reports a playback error yet. A trigger used to clear it, which
  // re-rendered the editor on every trigger (#482).
  const [playbackError] = useState<null | string>(null);
  const [slotPlayback] = useState(createSlotPlaybackStore);

  // Samples triggered and not yet finished. The voice choke reads this, not
  // the slots' playing state: it updates as soon as a sample is triggered (a
  // sequencer can trigger the next sound before the first reports that it's
  // playing) and nothing re-renders or resets it.
  const activeSamples = useRef(new Set<string>());

  const handlePlay = useCallback(
    (voice: number, slot: number, volume?: number, options?: PlayOptions) => {
      const key = slotKey(voice, slot);

      // Voice choke: stop any other sample still sounding on this voice
      const voicePrefix = voice + ":";
      const chokeKeys = [...activeSamples.current].filter(
        (k) => k.startsWith(voicePrefix) && k !== key,
      );
      for (const k of chokeKeys) activeSamples.current.delete(k);
      activeSamples.current.add(key);
      for (const k of chokeKeys) {
        slotPlayback.update(k, (state) => ({
          ...state,
          // Stop the choked samples when the new one starts, not before
          options:
            options?.startAt == null
              ? state.options
              : { ...state.options, stopAt: options.startAt },
          stopTrigger: state.stopTrigger + 1,
        }));
      }

      slotPlayback.update(key, (state) => ({
        ...state,
        // Always record the options (undefined = whole sample, now) so a
        // slice or start time from an earlier trigger never leaks into a
        // later play
        options,
        playTrigger: state.playTrigger + 1,
        volume: volume ?? state.volume,
      }));
    },
    [slotPlayback],
  );
  const handleStop = useCallback(
    (voice: number, slot: number) => {
      const key = slotKey(voice, slot);
      activeSamples.current.delete(key);
      slotPlayback.update(key, (state) => ({
        ...state,
        playing: false,
        stopTrigger: state.stopTrigger + 1,
      }));
    },
    [slotPlayback],
  );
  const handleWaveformPlayingChange = useCallback(
    (voice: number, slot: number, playing: boolean) => {
      const key = slotKey(voice, slot);
      if (playing) activeSamples.current.add(key);
      else activeSamples.current.delete(key);
      slotPlayback.update(key, (state) => ({ ...state, playing }));
    },
    [slotPlayback],
  );

  return {
    handlePlay,
    handleStop,
    handleWaveformPlayingChange,
    playbackError,
    slotPlayback,
  };
}

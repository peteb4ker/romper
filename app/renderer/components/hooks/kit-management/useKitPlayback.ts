import { useRef, useState } from "react";

import type { PlayOptions } from "../../kitTypes";

import { slotKey } from "../../../utils/slotKey";

/**
 * Playback state for the kit editor's samples, keyed by slot ("voice:slot",
 * see `slotKey`). Not by file name: two samples with the same name, in one
 * voice or two, are separate sounds (RE-45). The maps start empty; a missing
 * entry reads as 0 or not playing.
 *
 * Nothing here resets when the kit's samples are reloaded. It used to: every
 * step, condition, mode, volume or alias edit reloads the kit, and the reset
 * cleared "playing" while samples still sounded, so the next trigger on that
 * voice didn't choke them (RE-13).
 */
export function useKitPlayback() {
  const [playbackError, setPlaybackError] = useState<null | string>(null);
  const [playTriggers, setPlayTriggers] = useState<{ [key: string]: number }>(
    {},
  );
  const [stopTriggers, setStopTriggers] = useState<{ [key: string]: number }>(
    {},
  );
  const [samplePlaying, setSamplePlaying] = useState<{
    [key: string]: boolean;
  }>({});

  // Samples triggered and not yet finished. The voice choke reads this, not
  // samplePlaying: it updates as soon as a sample is triggered (a sequencer
  // can trigger the next sound before the first reports that it's playing)
  // and nothing re-renders or resets it.
  const activeSamples = useRef(new Set<string>());

  const [playVolumes, setPlayVolumes] = useState<{ [key: string]: number }>({});
  const [playOptions, setPlayOptions] = useState<{
    [key: string]: PlayOptions | undefined;
  }>({});

  const handlePlay = (
    voice: number,
    slot: number,
    volume?: number,
    options?: PlayOptions,
  ) => {
    const key = slotKey(voice, slot);

    // Voice choke: stop any other sample still sounding on this voice
    const voicePrefix = voice + ":";
    const chokeKeys = [...activeSamples.current].filter(
      (k) => k.startsWith(voicePrefix) && k !== key,
    );
    for (const k of chokeKeys) activeSamples.current.delete(k);
    activeSamples.current.add(key);
    if (chokeKeys.length > 0) {
      // Stop the choked samples when the new one starts, not before
      if (options?.startAt != null) {
        setPlayOptions((prev) => {
          const next = { ...prev };
          for (const k of chokeKeys) {
            next[k] = { ...prev[k], stopAt: options.startAt };
          }
          return next;
        });
      }
      setStopTriggers((triggers) => {
        const updates: { [key: string]: number } = {};
        for (const k of chokeKeys) {
          updates[k] = (triggers[k] || 0) + 1;
        }
        return { ...triggers, ...updates };
      });
    }

    setPlayTriggers((triggers) => ({
      ...triggers,
      [key]: (triggers[key] || 0) + 1,
    }));
    // Always record the options (undefined = whole sample, now) so a slice
    // or start time from an earlier trigger never leaks into a later play
    setPlayOptions((prev) =>
      prev[key] === options ? prev : { ...prev, [key]: options },
    );
    if (volume != null) {
      setPlayVolumes((prev) => ({ ...prev, [key]: volume }));
    }
    setPlaybackError(null);
  };
  const handleStop = (voice: number, slot: number) => {
    const key = slotKey(voice, slot);
    activeSamples.current.delete(key);
    setStopTriggers((triggers) => ({
      ...triggers,
      [key]: (triggers[key] || 0) + 1,
    }));
    setSamplePlaying((state) => ({ ...state, [key]: false }));
  };
  const handleWaveformPlayingChange = (
    voice: number,
    slot: number,
    playing: boolean,
  ) => {
    const key = slotKey(voice, slot);
    if (playing) activeSamples.current.add(key);
    else activeSamples.current.delete(key);
    setSamplePlaying((state) => ({ ...state, [key]: playing }));
  };

  return {
    handlePlay,
    handleStop,
    handleWaveformPlayingChange,
    playbackError,
    playOptions,
    playTriggers,
    playVolumes,
    samplePlaying,
    stopTriggers,
  };
}

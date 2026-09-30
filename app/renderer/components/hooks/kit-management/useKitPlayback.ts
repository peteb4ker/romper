import { useEffect, useState } from "react";

import type { PlayOptions, VoiceSamples } from "../../kitTypes";

export function useKitPlayback(samples: null | undefined | VoiceSamples) {
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

  // Initialize playback states for all existing samples
  useEffect(() => {
    if (!samples) return;

    const newPlayTriggers: { [key: string]: number } = {};
    const newStopTriggers: { [key: string]: number } = {};
    const newSamplePlaying: { [key: string]: boolean } = {};

    // Initialize states for all samples across all voices
    for (let voice = 1; voice <= 4; voice++) {
      const voiceSamples = samples?.[voice] || [];
      voiceSamples.forEach((sample: string) => {
        if (sample) {
          const sampleKey = voice + ":" + sample;
          newPlayTriggers[sampleKey] = 0;
          newStopTriggers[sampleKey] = 0;
          newSamplePlaying[sampleKey] = false;
        }
      });
    }

    setPlayTriggers(newPlayTriggers);
    setStopTriggers(newStopTriggers);
    setSamplePlaying(newSamplePlaying);
  }, [samples]);

  const [playVolumes, setPlayVolumes] = useState<{ [key: string]: number }>({});
  const [playOptions, setPlayOptions] = useState<{
    [key: string]: PlayOptions | undefined;
  }>({});

  const handlePlay = (
    voice: number,
    sample: string,
    volume?: number,
    options?: PlayOptions,
  ) => {
    const key = voice + ":" + sample;

    // Voice choke: stop any other sample currently playing on this voice
    const voicePrefix = voice + ":";
    setSamplePlaying((state) => {
      const chokeKeys = Object.keys(state).filter(
        (k) => k.startsWith(voicePrefix) && k !== key && state[k],
      );
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
      return state;
    });

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
  const handleStop = (voice: number, sample: string) => {
    setStopTriggers((triggers) => ({
      ...triggers,
      [voice + ":" + sample]: (triggers[voice + ":" + sample] || 0) + 1,
    }));
    setSamplePlaying((state) => ({ ...state, [voice + ":" + sample]: false }));
  };
  const handleWaveformPlayingChange = (
    voice: number,
    sample: string,
    playing: boolean,
  ) => {
    setSamplePlaying((state) => ({
      ...state,
      [voice + ":" + sample]: playing,
    }));
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

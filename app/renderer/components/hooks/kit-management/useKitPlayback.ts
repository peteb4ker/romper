import { useEffect, useState } from "react";

import type { VoiceSamples } from "../../kitTypes";

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

  const handlePlay = (voice: number, sample: string, volume?: number) => {
    const key = voice + ":" + sample;

    // Voice choke: stop any other sample currently playing on this voice
    const voicePrefix = voice + ":";
    setSamplePlaying((state) => {
      const chokeKeys = Object.keys(state).filter(
        (k) => k.startsWith(voicePrefix) && k !== key && state[k],
      );
      if (chokeKeys.length > 0) {
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

  useEffect(() => {
    // @ts-ignore
    const handleEnded = () => {};
    // @ts-ignore
    const handleError = (errMsg: string) => {
      setPlaybackError(errMsg || "Playback failed");
    };
    // @ts-ignore
    window.electronAPI.onSamplePlaybackEnded?.(handleEnded);
    // @ts-ignore
    window.electronAPI.onSamplePlaybackError?.(handleError);
    return () => {
      // @ts-ignore
      window.electronAPI.onSamplePlaybackEnded?.(() => {});
      // @ts-ignore
      window.electronAPI.onSamplePlaybackError?.(() => {});
    };
  }, []);

  return {
    handlePlay,
    handleStop,
    handleWaveformPlayingChange,
    playbackError,
    playTriggers,
    playVolumes,
    samplePlaying,
    stopTriggers,
  };
}

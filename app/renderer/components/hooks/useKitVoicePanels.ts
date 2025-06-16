import { useCallback } from "react";

import type { RampleKitLabel, VoiceSamples } from "./kitTypes";

export function useKitVoicePanels({
  samples,
  kitLabel,
  selectedVoice,
  selectedSampleIdx,
  setSelectedVoice,
  setSelectedSampleIdx,
  onSaveVoiceName,
  onRescanVoiceName,
  samplePlaying,
  playTriggers,
  stopTriggers,
  onPlay,
  onStop,
  onWaveformPlayingChange,
  sdCardPath,
  kitName,
  onSampleSelect,
  sequencerOpen = false,
}: {
  samples: VoiceSamples;
  kitLabel: RampleKitLabel | null;
  selectedVoice: number;
  selectedSampleIdx: number;
  setSelectedVoice: (v: number) => void;
  setSelectedSampleIdx: (i: number) => void;
  onSaveVoiceName: (voice: number, newName: string) => void;
  onRescanVoiceName: (voice: number, samples: VoiceSamples) => void;
  samplePlaying: { [key: string]: boolean };
  playTriggers: { [key: string]: number };
  stopTriggers: { [key: string]: number };
  onPlay: (voice: number, sample: string) => void;
  onStop: (voice: number, sample: string) => void;
  onWaveformPlayingChange: (
    voice: number,
    sample: string,
    playing: boolean,
  ) => void;
  sdCardPath: string;
  kitName: string;
  onSampleSelect: (voice: number, idx: number) => void;
  sequencerOpen?: boolean;
}) {
  // Helper to get number of samples for a voice
  const getNumSamples = useCallback(
    (voice: number) => (samples[voice] ? samples[voice].length : 0),
    [samples],
  );

  // Handler for sample navigation (up/down, cross-voice)
  const handleSampleNavigation = useCallback(
    (direction: "up" | "down") => {
      if (sequencerOpen) return; // Disable sample navigation if sequencer is open
      let v = selectedVoice;
      let idx = selectedSampleIdx;
      const numSamples = getNumSamples(v);
      if (direction === "down") {
        if (idx < numSamples - 1) {
          setSelectedSampleIdx(idx + 1);
        } else {
          // Move to first sample of next voice if possible
          if (v < 4 && getNumSamples(v + 1) > 0) {
            setSelectedVoice(v + 1);
            setSelectedSampleIdx(0);
          }
        }
      } else if (direction === "up") {
        if (idx > 0) {
          setSelectedSampleIdx(idx - 1);
        } else {
          // Move to last sample of previous voice if possible
          if (v > 1 && getNumSamples(v - 1) > 0) {
            setSelectedVoice(v - 1);
            setSelectedSampleIdx(getNumSamples(v - 1) - 1);
          }
        }
      }
    },
    [
      selectedVoice,
      selectedSampleIdx,
      setSelectedVoice,
      setSelectedSampleIdx,
      getNumSamples,
      sequencerOpen,
    ],
  );

  // This hook is a pass-through for now, but can be extended for memoization or logic
  // Return all props for KitVoicePanels
  return {
    samples,
    kitLabel,
    selectedVoice,
    selectedSampleIdx,
    onSaveVoiceName,
    onRescanVoiceName,
    samplePlaying,
    playTriggers,
    stopTriggers,
    onPlay,
    onStop,
    onWaveformPlayingChange,
    sdCardPath,
    kitName,
    onSampleKeyNav: handleSampleNavigation,
    onSampleSelect,
  };
}

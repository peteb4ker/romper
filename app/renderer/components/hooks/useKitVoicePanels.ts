import { useCallback } from "react";

import type { KitWithRelations } from "../../../../shared/db/schema";
import type { VoiceSamples } from "../kitTypes";

export function useKitVoicePanels({
  samples,
  kit,
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
  kitName,
  onSampleSelect,
  sequencerOpen = false,
}: {
  samples: VoiceSamples;
  kit: KitWithRelations | null;
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
  kitName: string;
  onSampleSelect: (voice: number, idx: number) => void;
  sequencerOpen?: boolean;
}) {
  // Helper to get number of samples for a voice
  const getNumSamples = useCallback(
    (voice: number) => (samples[voice] ? samples[voice].length : 0),
    [samples],
  );

  // Helper function to handle downward navigation
  const handleDownNavigation = useCallback(
    (currentVoice: number, currentIndex: number) => {
      const numSamples = getNumSamples(currentVoice);
      if (currentIndex < numSamples - 1) {
        setSelectedSampleIdx(currentIndex + 1);
      } else if (currentVoice < 4 && getNumSamples(currentVoice + 1) > 0) {
        setSelectedVoice(currentVoice + 1);
        setSelectedSampleIdx(0);
      }
    },
    [getNumSamples, setSelectedVoice, setSelectedSampleIdx],
  );

  // Helper function to handle upward navigation
  const handleUpNavigation = useCallback(
    (currentVoice: number, currentIndex: number) => {
      if (currentIndex > 0) {
        setSelectedSampleIdx(currentIndex - 1);
      } else if (currentVoice > 1 && getNumSamples(currentVoice - 1) > 0) {
        setSelectedVoice(currentVoice - 1);
        setSelectedSampleIdx(getNumSamples(currentVoice - 1) - 1);
      }
    },
    [getNumSamples, setSelectedVoice, setSelectedSampleIdx],
  );

  // Handler for sample navigation (up/down, cross-voice)
  const handleSampleNavigation = useCallback(
    (direction: "up" | "down") => {
      if (sequencerOpen) return; // Disable sample navigation if sequencer is open

      if (direction === "down") {
        handleDownNavigation(selectedVoice, selectedSampleIdx);
      } else if (direction === "up") {
        handleUpNavigation(selectedVoice, selectedSampleIdx);
      }
    },
    [
      selectedVoice,
      selectedSampleIdx,
      sequencerOpen,
      handleDownNavigation,
      handleUpNavigation,
    ],
  );

  // This hook is a pass-through for now, but can be extended for memoization or logic
  // Return all props for KitVoicePanels
  return {
    samples,
    kit,
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
    kitName,
    onSampleKeyNav: handleSampleNavigation,
    onSampleSelect,
  };
}

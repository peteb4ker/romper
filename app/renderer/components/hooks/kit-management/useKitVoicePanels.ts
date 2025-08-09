import type { VoiceSamples } from "@romper/app/renderer/components/kitTypes";
import type { KitWithRelations } from "@romper/shared/db/schema";

import { useCallback } from "react";

export function useKitVoicePanels({
  kit,
  kitName,
  onPlay,
  onRescanVoiceName,
  onSampleSelect,
  onSaveVoiceName,
  onStop,
  onWaveformPlayingChange,
  playTriggers,
  samplePlaying,
  samples,
  selectedSampleIdx,
  selectedVoice,
  sequencerOpen = false,
  setSelectedSampleIdx,
  setSelectedVoice,
  stopTriggers,
}: {
  kit: KitWithRelations | null;
  kitName: string;
  onPlay: (voice: number, sample: string) => void;
  onRescanVoiceName: (voice: number, samples: VoiceSamples) => void;
  onSampleSelect: (voice: number, idx: number) => void;
  onSaveVoiceName: (voice: number, newName: string) => void;
  onStop: (voice: number, sample: string) => void;
  onWaveformPlayingChange: (
    voice: number,
    sample: string,
    playing: boolean,
  ) => void;
  playTriggers: { [key: string]: number };
  samplePlaying: { [key: string]: boolean };
  samples: VoiceSamples;
  selectedSampleIdx: number;
  selectedVoice: number;
  sequencerOpen?: boolean;
  setSelectedSampleIdx: (i: number) => void;
  setSelectedVoice: (v: number) => void;
  stopTriggers: { [key: string]: number };
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
    (direction: "down" | "up") => {
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
    kit,
    kitName,
    onPlay,
    onRescanVoiceName,
    onSampleKeyNav: handleSampleNavigation,
    onSampleSelect,
    onSaveVoiceName,
    onStop,
    onWaveformPlayingChange,
    playTriggers,
    samplePlaying,
    samples,
    selectedSampleIdx,
    selectedVoice,
    stopTriggers,
  };
}

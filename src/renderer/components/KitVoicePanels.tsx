import React from "react";

import { useKitVoicePanels } from "./hooks/useKitVoicePanels.ts";
import type { RampleKitLabel, VoiceSamples } from "./kitTypes";
import KitVoicePanel from "./KitVoicePanel";

interface KitVoicePanelsProps {
  samples: VoiceSamples;
  kitLabel: RampleKitLabel | null;
  selectedVoice: number;
  selectedSampleIdx: number;
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
  onSampleKeyNav: (direction: "up" | "down") => void;
  onSampleSelect: (voice: number, idx: number) => void;
  sequencerOpen: boolean;
}

const KitVoicePanels: React.FC<KitVoicePanelsProps> = (props) => {
  const hookProps = useKitVoicePanels({
    ...props,
    sequencerOpen: props.sequencerOpen,
  });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((voice) => (
        <div
          key={`${hookProps.kitName}-voicepanel-${voice}`}
          data-testid={`voice-panel-${voice}`}
        >
          <KitVoicePanel
            voice={voice}
            samples={hookProps.samples[voice] || []}
            voiceName={hookProps.kitLabel?.voiceNames?.[voice] || null}
            onSaveVoiceName={hookProps.onSaveVoiceName}
            onRescanVoiceName={() =>
              hookProps.onRescanVoiceName(voice, hookProps.samples)
            }
            samplePlaying={hookProps.samplePlaying}
            playTriggers={hookProps.playTriggers}
            stopTriggers={hookProps.stopTriggers}
            onPlay={hookProps.onPlay}
            onStop={hookProps.onStop}
            onWaveformPlayingChange={hookProps.onWaveformPlayingChange}
            sdCardPath={hookProps.sdCardPath}
            kitName={hookProps.kitName}
            dataTestIdVoiceName={`voice-name-${voice}`}
            selectedIdx={
              voice === hookProps.selectedVoice
                ? hookProps.selectedSampleIdx
                : -1
            }
            onSampleKeyNav={hookProps.onSampleKeyNav}
            onSampleSelect={hookProps.onSampleSelect}
            isActive={voice === hookProps.selectedVoice}
          />
        </div>
      ))}
    </div>
  );
};

export default KitVoicePanels;

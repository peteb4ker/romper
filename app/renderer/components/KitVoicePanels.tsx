import React from "react";

import type { KitWithRelations } from "../../../shared/db/schema";
import { useKitVoicePanels } from "./hooks/useKitVoicePanels";
import type { VoiceSamples } from "./kitTypes";
import KitVoicePanel from "./KitVoicePanel";

interface KitVoicePanelsProps {
  samples: VoiceSamples;
  kit: KitWithRelations | null;
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
  kitName: string;
  onSampleKeyNav: (direction: "up" | "down") => void;
  onSampleSelect: (voice: number, idx: number) => void;
  sequencerOpen: boolean;
  setSelectedVoice: (v: number) => void;
  setSelectedSampleIdx: (i: number) => void;
  isEditable?: boolean;

  // New props for drag-and-drop sample management (Task 5.2.2 & 5.2.3)
  onSampleAdd?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onSampleReplace?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onSampleDelete?: (voice: number, slotIndex: number) => Promise<void>;
}

const KitVoicePanels: React.FC<KitVoicePanelsProps> = (props) => {
  const hookProps = useKitVoicePanels({
    ...props,
    setSelectedVoice: props.setSelectedVoice,
    setSelectedSampleIdx: props.setSelectedSampleIdx,
    sequencerOpen: props.sequencerOpen,
  });
  return (
    <div
      className="grid grid-cols-4 gap-4 w-full"
      data-testid="voice-panels-row"
    >
      {[1, 2, 3, 4].map((voice) => (
        <div
          key={`${hookProps.kitName}-voicepanel-${voice}`}
          data-testid={`voice-panel-${voice}`}
        >
          <KitVoicePanel
            voice={voice}
            samples={hookProps.samples[voice] || []}
            voiceName={
              hookProps.kit?.voices?.find((v) => v.voice_number === voice)
                ?.voice_alias || null
            }
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
            isEditable={props.isEditable ?? false}
            onSampleAdd={props.onSampleAdd}
            onSampleReplace={props.onSampleReplace}
            onSampleDelete={props.onSampleDelete}
          />
        </div>
      ))}
    </div>
  );
};

export default KitVoicePanels;

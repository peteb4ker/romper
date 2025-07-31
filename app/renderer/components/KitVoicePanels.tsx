import React, { useState } from "react";
import { FiLink } from "react-icons/fi";

import type { KitWithRelations } from "../../../shared/db/schema";
import { useKitVoicePanels } from "./hooks/useKitVoicePanels";
import type { SampleData, VoiceSamples } from "./kitTypes";
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

  // Task 22.2: Sample move operations with contiguity
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ) => Promise<void>;
}

const KitVoicePanels: React.FC<KitVoicePanelsProps> = (props) => {
  const hookProps = useKitVoicePanels({
    ...props,
    setSelectedVoice: props.setSelectedVoice,
    setSelectedSampleIdx: props.setSelectedSampleIdx,
    sequencerOpen: props.sequencerOpen,
  });

  // State for sample metadata lookup
  const [sampleMetadata, setSampleMetadata] = useState<{
    [filename: string]: SampleData;
  }>({});

  // Task 7.1.3: State to track stereo drop targets
  const [stereoDragInfo, setStereoDragInfo] = useState<{
    targetVoice: number;
    nextVoice: number;
    slotIndex: number;
  } | null>(null);

  // Load sample metadata when kit changes
  React.useEffect(() => {
    const loadSampleMetadata = async () => {
      if (!hookProps.kitName || !window.electronAPI?.getAllSamplesForKit) {
        setSampleMetadata({});
        return;
      }

      try {
        const samplesResult = await window.electronAPI.getAllSamplesForKit(
          hookProps.kitName,
        );
        if (samplesResult?.success && samplesResult.data) {
          const metadata: { [filename: string]: SampleData } = {};
          samplesResult.data.forEach((sample: any) => {
            metadata[sample.filename] = {
              filename: sample.filename,
              source_path: sample.source_path,
            };
          });
          setSampleMetadata(metadata);
        }
      } catch (error) {
        console.error("Failed to load sample metadata:", error);
        setSampleMetadata({});
      }
    };

    loadSampleMetadata();
  }, [hookProps.kitName]);

  // Callback for voice panels to notify about stereo drops
  const handleStereoDragOver = (
    voice: number,
    slotIndex: number,
    isStereo: boolean,
  ) => {
    if (isStereo && voice < 4) {
      setStereoDragInfo({
        targetVoice: voice,
        nextVoice: voice + 1,
        slotIndex,
      });
    } else {
      setStereoDragInfo(null);
    }
  };

  const handleStereoDragLeave = () => {
    setStereoDragInfo(null);
  };

  return (
    <div
      className="grid grid-cols-4 gap-4 w-full relative"
      data-testid="voice-panels-row"
    >
      {[1, 2, 3, 4].map((voice) => (
        <React.Fragment key={`${hookProps.kitName}-voicepanel-${voice}`}>
          <div data-testid={`voice-panel-${voice}`} className="relative">
            <KitVoicePanel
              voice={voice}
              samples={hookProps.samples[voice] || []}
              sampleMetadata={sampleMetadata}
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
              onSampleMove={props.onSampleMove}
              isStereoDragTarget={
                stereoDragInfo?.targetVoice === voice ||
                stereoDragInfo?.nextVoice === voice
              }
              stereoDragSlotIndex={
                stereoDragInfo?.targetVoice === voice ||
                stereoDragInfo?.nextVoice === voice
                  ? stereoDragInfo.slotIndex
                  : undefined
              }
              onStereoDragOver={handleStereoDragOver}
              onStereoDragLeave={handleStereoDragLeave}
            />
            {/* Task 7.1.3: Show link icon between voices for stereo drops */}
            {stereoDragInfo?.targetVoice === voice && (
              <div
                className="absolute -right-6 top-1/2 transform -translate-y-1/2 z-10 
                          bg-purple-500 text-white rounded-full p-2 shadow-lg
                          animate-pulse"
                style={{
                  // Position at the specific slot
                  top: `calc(50px + ${stereoDragInfo.slotIndex * 32}px)`,
                }}
                title="Stereo link"
              >
                <FiLink className="w-4 h-4" />
              </div>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export default KitVoicePanels;

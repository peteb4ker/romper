import type { KitWithRelations } from "@romper/shared/db/schema";

import React, { useState } from "react";
import { FiLink } from "react-icons/fi";

import type { SampleData, VoiceSamples } from "./kitTypes";

import { useKitVoicePanels } from "./hooks/kit-management/useKitVoicePanels";
import KitVoicePanel from "./KitVoicePanel";

interface KitVoicePanelsProps {
  isEditable?: boolean; // Used directly in KitVoicePanel
  kit: KitWithRelations | null; // Used by useKitVoicePanels hook
  kitName: string; // Used by useKitVoicePanels hook
  onPlay: (voice: number, sample: string) => void; // Used by useKitVoicePanels hook
  onRescanVoiceName: (voice: number, samples: VoiceSamples) => void; // Used by useKitVoicePanels hook
  // New props for drag-and-drop sample management (Task 5.2.2 & 5.2.3)
  onSampleAdd?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onSampleDelete?: (voice: number, slotIndex: number) => Promise<void>;
  onSampleKeyNav: (direction: "down" | "up") => void; // Used directly in KitVoicePanel
  // Task 22.2: Sample move operations with contiguity
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ) => Promise<void>;
  onSampleReplace?: (
    voice: number,
    slotIndex: number,
    filePath: string,
  ) => Promise<void>;
  onSampleSelect: (voice: number, idx: number) => void; // Used by useKitVoicePanels hook
  onSaveVoiceName: (voice: number, newName: string) => void; // Used by useKitVoicePanels hook
  onStop: (voice: number, sample: string) => void; // Used by useKitVoicePanels hook
  onWaveformPlayingChange: (
    voice: number,
    sample: string,
    playing: boolean,
  ) => void; // Used by useKitVoicePanels hook
  playTriggers: { [key: string]: number }; // Used by useKitVoicePanels hook
  samplePlaying: { [key: string]: boolean }; // Used by useKitVoicePanels hook
  samples: VoiceSamples; // Used by useKitVoicePanels hook
  selectedSampleIdx: number; // Used by useKitVoicePanels hook
  selectedVoice: number; // Used by useKitVoicePanels hook

  sequencerOpen: boolean; // Used by useKitVoicePanels hook
  setSelectedSampleIdx: (i: number) => void; // Used by useKitVoicePanels hook
  setSelectedVoice: (v: number) => void; // Used by useKitVoicePanels hook

  stopTriggers: { [key: string]: number }; // Used by useKitVoicePanels hook
}

const KitVoicePanels: React.FC<KitVoicePanelsProps> = (props) => {
  const hookProps = useKitVoicePanels({
    ...props,
    sequencerOpen: props.sequencerOpen,
    setSelectedSampleIdx: props.setSelectedSampleIdx,
    setSelectedVoice: props.setSelectedVoice,
  });

  // State for sample metadata lookup
  const [sampleMetadata, setSampleMetadata] = useState<{
    [filename: string]: SampleData;
  }>({});

  // Task 7.1.3: State to track stereo drop targets
  const [stereoDragInfo, setStereoDragInfo] = useState<{
    nextVoice: number;
    slotIndex: number;
    targetVoice: number;
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
    const canHandleStereo = isStereo && voice < 4;
    const shouldSetDragInfo = canHandleStereo;

    if (shouldSetDragInfo) {
      setStereoDragInfo({
        nextVoice: voice + 1,
        slotIndex,
        targetVoice: voice,
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
          <div className="relative" data-testid={`voice-panel-${voice}`}>
            <KitVoicePanel
              dataTestIdVoiceName={`voice-name-${voice}`}
              isActive={voice === hookProps.selectedVoice}
              isEditable={props.isEditable ?? false}
              isStereoDragTarget={
                stereoDragInfo?.targetVoice === voice ||
                stereoDragInfo?.nextVoice === voice
              }
              kitName={hookProps.kitName}
              onPlay={hookProps.onPlay}
              onRescanVoiceName={() =>
                hookProps.onRescanVoiceName(voice, hookProps.samples)
              }
              onSampleAdd={props.onSampleAdd}
              onSampleDelete={props.onSampleDelete}
              onSampleKeyNav={hookProps.onSampleKeyNav}
              onSampleMove={props.onSampleMove}
              onSampleReplace={props.onSampleReplace}
              onSampleSelect={hookProps.onSampleSelect}
              onSaveVoiceName={hookProps.onSaveVoiceName}
              onStereoDragLeave={handleStereoDragLeave}
              onStereoDragOver={handleStereoDragOver}
              onStop={hookProps.onStop}
              onWaveformPlayingChange={hookProps.onWaveformPlayingChange}
              playTriggers={hookProps.playTriggers}
              sampleMetadata={sampleMetadata}
              samplePlaying={hookProps.samplePlaying}
              samples={hookProps.samples[voice] || []}
              selectedIdx={
                voice === hookProps.selectedVoice
                  ? hookProps.selectedSampleIdx
                  : -1
              }
              stereoDragSlotIndex={
                stereoDragInfo?.targetVoice === voice ||
                stereoDragInfo?.nextVoice === voice
                  ? stereoDragInfo.slotIndex
                  : undefined
              }
              stopTriggers={hookProps.stopTriggers}
              voice={voice}
              voiceName={
                hookProps.kit?.voices?.find((v) => v.voice_number === voice)
                  ?.voice_alias || null
              }
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

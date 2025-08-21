import type { KitWithRelations, Sample } from "@romper/shared/db/schema";

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
    slotNumber: number,
    filePath: string,
  ) => Promise<void>;
  onSampleDelete?: (voice: number, slotNumber: number) => Promise<void>;
  onSampleKeyNav: (direction: "down" | "up") => void; // Used directly in KitVoicePanel
  // Task 22.2: Sample move operations with contiguity
  onSampleMove?: (
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => Promise<void>;
  onSampleReplace?: (
    voice: number,
    slotNumber: number,
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
    slotNumber: number;
    targetVoice: number;
  } | null>(null);

  // State to track internal drag operations across all voices
  const [internalDraggedSample, setInternalDraggedSample] = useState<{
    sampleName: string;
    slot: number;
    voice: number;
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
          samplesResult.data.forEach((sample: Sample) => {
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
    slotNumber: number,
    isStereo: boolean,
  ) => {
    const canHandleStereo = isStereo && voice < 4;
    const shouldSetDragInfo = canHandleStereo;

    if (shouldSetDragInfo) {
      setStereoDragInfo({
        nextVoice: voice + 1,
        slotNumber,
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
    <div className="flex w-full relative" data-testid="voice-panels-row">
      {/* Global slot numbers column */}
      <div className="flex flex-col justify-start pt-12 pr-3">
        {[...Array(12)].map((_, i) => (
          <div
            className="min-h-[28px] flex items-center justify-end"
            key={`global-slot-${i}`}
            style={{ marginBottom: 4 }}
          >
            <span
              className="text-xs font-mono text-gray-500 dark:text-gray-400 select-none bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-center w-8 h-5 flex items-center justify-center inline-block"
              data-testid={`global-slot-number-${i}`}
              style={{ display: "inline-block", width: "32px" }}
            >
              {i + 1}.
            </span>
          </div>
        ))}
      </div>

      {/* Voice panels grid */}
      <div className="grid grid-cols-4 gap-4 flex-1">
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
                setSharedDraggedSample={setInternalDraggedSample}
                sharedDraggedSample={internalDraggedSample}
                stereoDragSlotNumber={
                  stereoDragInfo?.targetVoice === voice ||
                  stereoDragInfo?.nextVoice === voice
                    ? stereoDragInfo.slotNumber
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
                    top: `calc(50px + ${stereoDragInfo.slotNumber * 32}px)`,
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
    </div>
  );
};

export default KitVoicePanels;

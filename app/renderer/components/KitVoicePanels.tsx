import type { KitWithRelations, Sample } from "@romper/shared/db/schema";

import { Link } from "@phosphor-icons/react";
import React, { useState } from "react";

import type { SampleData, VoiceSamples } from "./kitTypes";

import { useKitVoicePanels } from "./hooks/kit-management/useKitVoicePanels";
import { useStereoHandling } from "./hooks/sample-management/useStereoHandling";
import KitVoicePanel from "./KitVoicePanel";

interface KitVoicePanelsProps {
  isEditable?: boolean; // Used directly in KitVoicePanel
  kit: KitWithRelations | null; // Used by useKitVoicePanels hook
  kitName: string; // Used by useKitVoicePanels hook
  onKitUpdated?: () => Promise<void>; // Called after voice stereo mode changes to reload kit data
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
  playVolumes?: { [key: string]: number }; // Volume per sample key, set by sequencer
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

  // Stereo handling hook for voice linking
  const stereoHandling = useStereoHandling();

  // State for sample metadata lookup
  const [sampleMetadata, setSampleMetadata] = useState<{
    [filename: string]: SampleData;
  }>({});

  // Get voice data from kit with fallback defaults
  const voiceData = React.useMemo(() => {
    if (!props.kit?.voices) {
      // Fallback to default voice structure if no voices in kit
      return [1, 2, 3, 4].map((voice_number) => ({
        id: voice_number,
        kit_name: hookProps.kitName || "",
        sample_mode: "first",
        stereo_mode: false,
        voice_alias: null,
        voice_number,
        voice_volume: 100,
      }));
    }

    // Use actual voice data from database
    return props.kit.voices.map((voice) => ({
      id: voice.id,
      kit_name: voice.kit_name,
      sample_mode: voice.sample_mode || "first",
      stereo_mode: voice.stereo_mode || false,
      voice_alias: voice.voice_alias,
      voice_number: voice.voice_number,
      voice_volume: voice.voice_volume ?? 100,
    }));
  }, [props.kit?.voices, hookProps.kitName]);

  // Convert sample data for stereo handling
  const sampleData = React.useMemo(() => {
    const samples: Sample[] = [];
    if (sampleMetadata) {
      Object.entries(sampleMetadata).forEach(([filename, data]) => {
        // Simple hash of filename for deterministic ID generation
        const hash = filename
          .split("")
          .reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0);
        samples.push({
          filename,
          id: Math.abs(hash), // Ensure positive ID
          is_stereo: data.is_stereo || data.wav_channels === 2,
          kit_name: hookProps.kitName || "",
          slot_number: 0, // Default slot since SampleData doesn't have slot
          source_path: data.source_path,
          voice_number: 1, // Default voice since SampleData doesn't have voice
          wav_bit_depth: data.wav_bit_depth || null,
          wav_bitrate: data.wav_bitrate || null,
          wav_channels: data.wav_channels || null,
          wav_sample_rate: data.wav_sample_rate || null,
        });
      });
    }
    return samples;
  }, [sampleMetadata, hookProps.kitName]);

  // Voice linking handlers
  const handleVoiceLink = React.useCallback(
    async (primaryVoice: number) => {
      const secondaryVoice = primaryVoice + 1;

      // Block if either voice is already linked
      const primaryStatus = stereoHandling.getVoiceLinkingStatus(
        primaryVoice,
        voiceData,
      );
      const secondaryStatus = stereoHandling.getVoiceLinkingStatus(
        secondaryVoice,
        voiceData,
      );
      if (primaryStatus.isLinked || secondaryStatus.isLinked) {
        console.warn("One of these voices is already linked");
        return;
      }

      // Block if secondary voice has samples
      const secondarySamples = hookProps.samples[secondaryVoice] || [];
      if (secondarySamples.some((s) => s?.trim())) {
        console.warn(
          `Voice ${secondaryVoice} has samples — remove them before linking`,
        );
        return;
      }

      await stereoHandling.linkVoicesForStereo(
        primaryVoice,
        voiceData,
        sampleData,
        async (voiceNumber, updates) => {
          if (window.electronAPI?.updateVoiceStereoMode) {
            await window.electronAPI.updateVoiceStereoMode(
              hookProps.kitName,
              voiceNumber,
              updates.stereo_mode ?? false,
            );
          }
        },
      );
      await props.onKitUpdated?.();
    },
    [
      stereoHandling,
      voiceData,
      sampleData,
      hookProps.samples,
      hookProps.kitName,
      props,
    ],
  );

  const handleVoiceUnlink = React.useCallback(
    async (primaryVoice: number) => {
      await stereoHandling.unlinkVoices(
        primaryVoice,
        voiceData,
        sampleData,
        async (voiceNumber, updates) => {
          if (window.electronAPI?.updateVoiceStereoMode) {
            await window.electronAPI.updateVoiceStereoMode(
              hookProps.kitName,
              voiceNumber,
              updates.stereo_mode ?? false,
            );
          }
        },
      );
      await props.onKitUpdated?.();
    },
    [stereoHandling, voiceData, sampleData, hookProps.kitName, props],
  );

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
              is_stereo: sample.is_stereo,
              source_path: sample.source_path,
              wav_bit_depth: sample.wav_bit_depth ?? undefined,
              wav_bitrate: sample.wav_bitrate ?? undefined,
              wav_channels: sample.wav_channels ?? undefined,
              wav_sample_rate: sample.wav_sample_rate ?? undefined,
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

  // Track which voices were recently visible so content stays rendered during collapse animation
  const [deferredSecondaries, setDeferredSecondaries] = useState<Set<number>>(
    new Set(),
  );

  React.useEffect(() => {
    const currentSecondaries = new Set<number>();
    for (const voice of voiceData) {
      const status = stereoHandling.getVoiceLinkingStatus(
        voice.voice_number,
        voiceData,
      );
      if (status.isLinked && !status.isPrimary) {
        currentSecondaries.add(voice.voice_number);
      }
    }

    // If a voice just became secondary, delay hiding its content until animation completes
    const newlyHidden = [...currentSecondaries].filter(
      (v) => !deferredSecondaries.has(v),
    );
    if (newlyHidden.length > 0) {
      const timer = setTimeout(() => {
        setDeferredSecondaries(currentSecondaries);
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }

    setDeferredSecondaries(currentSecondaries);
  }, [voiceData, stereoHandling.getVoiceLinkingStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex w-full relative" data-testid="voice-panels-row">
      {/* Global slot numbers column */}
      <div className="flex flex-col justify-start pt-8 pr-3">
        {[...Array(12)].map((_, i) => (
          <div
            className="min-h-[28px] flex items-center justify-end"
            key={`global-slot-${i}`}
            style={{ marginBottom: 4 }}
          >
            <span
              className="text-xs font-mono text-text-tertiary select-none bg-surface-3 px-1.5 py-0.5 rounded text-center w-8 h-5 flex items-center justify-center inline-block"
              data-testid={`global-slot-number-${i}`}
              style={{ display: "inline-block", width: "32px" }}
            >
              {i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Voice panels flex layout */}
      <div className="flex gap-1.5 flex-1" data-testid="voice-panels-flex">
        {[1, 2, 3, 4].map((voice) => {
          // Get voice linking status
          const linkingStatus = stereoHandling.getVoiceLinkingStatus(
            voice,
            voiceData,
          );
          const isSecondary =
            linkingStatus.isLinked && !linkingStatus.isPrimary;
          const isPrimary = linkingStatus.isLinked && linkingStatus.isPrimary;
          const nextVoiceLinked =
            voice < 4 &&
            stereoHandling.getVoiceLinkingStatus(voice + 1, voiceData).isLinked;
          const showChainIcon =
            voice < 4 && !isPrimary && !isSecondary && !nextVoiceLinked;

          return (
            <div
              className={[
                "group/panel relative transition-all duration-300 ease-in-out overflow-hidden",
                isSecondary ? "opacity-0" : "flex-1 opacity-100",
              ].join(" ")}
              data-testid={`voice-panel-${voice}`}
              key={`${hookProps.kitName}-voicepanel-${voice}`}
              style={
                isSecondary
                  ? { flex: 0, gap: 0, minWidth: 0, padding: 0 }
                  : isPrimary
                    ? { flex: 2 }
                    : undefined
              }
            >
              {!deferredSecondaries.has(voice) && (
                <KitVoicePanel
                  dataTestIdVoiceName={`voice-name-${voice}`}
                  isActive={voice === hookProps.selectedVoice}
                  isDisabled={isSecondary}
                  isEditable={props.isEditable ?? false}
                  isLinkedPrimary={isPrimary}
                  isStereoDragTarget={
                    stereoDragInfo?.targetVoice === voice ||
                    stereoDragInfo?.nextVoice === voice
                  }
                  kitName={hookProps.kitName}
                  linkedWith={linkingStatus.linkedWith}
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
                  onVoiceUnlink={handleVoiceUnlink}
                  onWaveformPlayingChange={hookProps.onWaveformPlayingChange}
                  playTriggers={hookProps.playTriggers}
                  playVolumes={hookProps.playVolumes}
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
              )}
              {/* Stereo drag indicator between voices */}
              {!deferredSecondaries.has(voice) &&
                stereoDragInfo?.targetVoice === voice && (
                  <div
                    className="absolute -right-3 z-10 bg-purple-500 text-white rounded-full p-1.5 shadow-lg animate-pulse"
                    style={{
                      top: `calc(50px + ${stereoDragInfo.slotNumber * 32}px)`,
                    }}
                    title="Stereo link"
                  >
                    <Link size={14} />
                  </div>
                )}
              {/* Chain icon — right edge of panel, always visible */}
              {showChainIcon && (
                <div
                  className="absolute right-0 top-0 z-10"
                  data-testid={`chain-icon-${voice}-${voice + 1}`}
                >
                  <button
                    className="opacity-80 hover:opacity-100 transition-opacity text-text-secondary"
                    data-testid={`link-button-${voice}-${voice + 1}`}
                    onClick={() => handleVoiceLink(voice)}
                    title="Click to link stereo channels"
                    type="button"
                  >
                    <Link size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KitVoicePanels;

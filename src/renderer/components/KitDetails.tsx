import React from "react";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiFolder,
  FiPlay,
  FiRefreshCw,
  FiSquare,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import { useKitDetails } from "./hooks/useKitDetails";
import { useKitLabel } from "./hooks/useKitLabel";
import { useKitPlayback } from "./hooks/useKitPlayback";
import { useKitVoicePanel } from "./hooks/useKitVoicePanel";
import KitHeader from "./KitHeader";
import KitMetadataForm from "./KitMetadataForm";
import KitStepSequencer from "./KitStepSequencer";
import type {
  KitDetailsProps,
  RampleKitLabel,
  RampleLabels,
  VoiceSamples,
} from "./kitTypes";
import { inferVoiceTypeFromFilename } from "./kitUtils";
import KitVoicePanel from "./KitVoicePanel";
import SampleWaveform from "./SampleWaveform";
import VoiceSamplesList from "./VoiceSamplesList";

interface KitDetailsAllProps extends KitDetailsProps {
  kitLabel?: RampleKitLabel;
  onRescanAllVoiceNames?: () => void;
  onCreateKit?: () => void;
  onMessage?: (msg: { type: string; text: string }) => void;
}

const KitDetails: React.FC<KitDetailsAllProps> = (props) => {
  // Playback logic
  const {
    playbackError,
    playTriggers,
    stopTriggers,
    samplePlaying,
    handlePlay,
    handleStop,
    handleWaveformPlayingChange,
  } = useKitPlayback(props.samples);

  // Use the shared useKitLabel hook for all label/voice rescanning logic
  const {
    handleSaveVoiceName,
    handleRescanVoiceName,
    handleRescanAllVoiceNames,
    kitLabel: managedKitLabel,
    setKitLabel,
    labelsLoading,
    labelsError,
    editingKitLabel,
    setEditingKitLabel,
    kitLabelInput,
    setKitLabelInput,
    handleSaveKitLabel,
    handleSaveKitTags,
    handleSaveKitMetadata,
    reloadKitLabel,
    stepPattern,
    setStepPattern,
  } = useKitLabel(props);

  // Default samples to avoid undefined errors
  const samples = props.samples || { 1: [], 2: [], 3: [], 4: [] };

  // Auto-scan logic: triggers auto-rescan if all voice names are missing and samples are loaded
  useKitDetails({
    kitLabel: managedKitLabel,
    samples,
    sdCardPath: props.sdCardPath,
    kitName: props.kitName,
    onRescanAllVoiceNames: () => handleRescanAllVoiceNames(samples),
  });

  // Show playback errors via onMessage callback
  React.useEffect(() => {
    if (playbackError && props.onMessage) {
      props.onMessage({ type: "error", text: playbackError });
    }
  }, [playbackError, props.onMessage]);

  // Show label errors via onMessage callback
  React.useEffect(() => {
    if (labelsError && props.onMessage) {
      props.onMessage({ type: "error", text: labelsError });
    }
  }, [labelsError, props.onMessage]);

  // Listen for SampleWaveform errors bubbled up from children
  React.useEffect(() => {
    if (!props.onMessage) return;
    const handler = (e: CustomEvent) => {
      props.onMessage({ type: "error", text: e.detail });
    };
    window.addEventListener("SampleWaveformError", handler as EventListener);
    return () => {
      window.removeEventListener(
        "SampleWaveformError",
        handler as EventListener,
      );
    };
  }, [props.onMessage]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full p-2 pb-0 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-sm shadow">
      <KitHeader
        kitName={props.kitName}
        kitLabel={managedKitLabel}
        onBack={props.onBack}
        onNextKit={props.onNextKit}
        onPrevKit={props.onPrevKit}
        onCreateKit={props.onCreateKit}
        kits={props.kits}
        kitIndex={props.kitIndex}
        // Always show navigation buttons, but disable as needed
        disablePrev={props.kitIndex === 0}
        disableNext={props.kits && props.kitIndex === props.kits.length - 1}
        onRescanAllVoiceNames={() => handleRescanAllVoiceNames(samples)}
      />
      <KitMetadataForm
        kitLabel={managedKitLabel}
        loading={labelsLoading}
        error={null} // error now handled by centralized message display
        editing={editingKitLabel}
        onEdit={() => setEditingKitLabel(true)}
        onCancel={() => setEditingKitLabel(false)}
        onSave={handleSaveKitLabel}
        hideDescription={true}
        tagsEditable={false} // Remove tag editing
      />
      {/* playbackError and labelsError are now handled by centralized message display */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((voice) => (
            <div
              key={`${props.kitName}-voicepanel-${voice}`}
              onClick={() => {
                /* no-op or optional: could call a callback if needed */
              }}
              data-testid={`voice-panel-${voice}`}
            >
              <KitVoicePanel
                voice={voice}
                samples={samples[voice] || []}
                voiceName={managedKitLabel?.voiceNames?.[voice] || null}
                onSaveVoiceName={handleSaveVoiceName}
                onRescanVoiceName={() => handleRescanVoiceName(voice, samples)}
                samplePlaying={samplePlaying}
                playTriggers={playTriggers}
                stopTriggers={stopTriggers}
                onPlay={handlePlay}
                onStop={handleStop}
                onWaveformPlayingChange={handleWaveformPlayingChange}
                sdCardPath={props.sdCardPath}
                kitName={props.kitName}
                // Add data-testid for voice name span for robust test selection
                dataTestIdVoiceName={`voice-name-${voice}`}
              />
            </div>
          ))}
        </div>
      </div>
      {/* Step Sequencer Drawer */}
      <KitStepSequencer
        samples={samples}
        onPlaySample={handlePlay}
        stepPattern={stepPattern}
        setStepPattern={setStepPattern}
      />
    </div>
  );
};

export default KitDetails;

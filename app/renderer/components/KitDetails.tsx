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
import { useKitVoicePanels } from "./hooks/useKitVoicePanels";
import KitHeader from "./KitHeader";
import KitMetadataForm from "./KitMetadataForm";
import KitStepSequencer from "./KitStepSequencer";
import type {
  KitDetailsProps,
  RampleKitLabel,
  RampleLabels,
  VoiceSamples,
} from "./kitTypes";
import { inferVoiceTypeFromFilename } from "@romper/shared";
import KitVoicePanel from "./KitVoicePanel";
import KitVoicePanels from "./KitVoicePanels";
import SampleWaveform from "./SampleWaveform";

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

  const [selectedVoice, setSelectedVoice] = React.useState(1);
  const [selectedSampleIdx, setSelectedSampleIdx] = React.useState(0);
  // Track sequencer drawer open state
  const [sequencerOpen, setSequencerOpen] = React.useState(false);

  // Ref for sequencer grid
  const sequencerGridRef = React.useRef<HTMLDivElement>(null);

  // Focus sequencer grid when opening, focus sample when closing
  React.useEffect(() => {
    if (sequencerOpen) {
      // Focus the sequencer grid
      setTimeout(() => {
        sequencerGridRef.current?.focus();
      }, 0);
    }
    // No-op for sample focus: sample navigation is always available by up/down
  }, [sequencerOpen]);

  // Use KitVoicePanels hook for navigation logic
  const kitVoicePanels = useKitVoicePanels({
    samples,
    kitLabel: managedKitLabel,
    selectedVoice,
    selectedSampleIdx,
    setSelectedVoice,
    setSelectedSampleIdx,
    onSaveVoiceName: handleSaveVoiceName,
    onRescanVoiceName: handleRescanVoiceName,
    samplePlaying,
    playTriggers,
    stopTriggers,
    onPlay: handlePlay,
    onStop: handleStop,
    onWaveformPlayingChange: handleWaveformPlayingChange,
    sdCardPath: props.sdCardPath,
    kitName: props.kitName,
    onSampleSelect: (voice, idx) => {
      setSelectedVoice(voice);
      setSelectedSampleIdx(idx);
    },
  });

  // --- Global keyboard navigation for sample preview and sequencer toggle ---
  React.useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      // Ignore if a modal, input, textarea, or contenteditable is focused
      const active = document.activeElement;
      if (
        active &&
        ((active.tagName === "INPUT" &&
          (active as HTMLInputElement).type !== "checkbox") ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }
      // 3.10: S key toggles sequencer
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSequencerOpen((open) => !open);
        return;
      }
      // Only handle navigation keys for sample nav if sequencer is closed
      if (
        !sequencerOpen &&
        ["ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)
      ) {
        e.preventDefault();
        if (e.key === "ArrowDown") {
          kitVoicePanels.onSampleKeyNav("down");
        } else if (e.key === "ArrowUp") {
          kitVoicePanels.onSampleKeyNav("up");
        } else if (e.key === " " || e.key === "Enter") {
          // Preview/play selected sample
          const samplesForVoice = samples[selectedVoice] || [];
          const sample = samplesForVoice[selectedSampleIdx];
          if (sample) {
            handlePlay(selectedVoice, sample);
          }
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    sequencerOpen,
    selectedVoice,
    selectedSampleIdx,
    samples,
    handlePlay,
    kitVoicePanels,
  ]);

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
      <div className="flex-1 min-h-0 overflow-y-auto">
        <KitVoicePanels
          samples={samples}
          kitLabel={managedKitLabel}
          selectedVoice={selectedVoice}
          selectedSampleIdx={selectedSampleIdx}
          onSaveVoiceName={handleSaveVoiceName}
          onRescanVoiceName={handleRescanVoiceName}
          samplePlaying={samplePlaying}
          playTriggers={playTriggers}
          stopTriggers={stopTriggers}
          onPlay={handlePlay}
          onStop={handleStop}
          onWaveformPlayingChange={handleWaveformPlayingChange}
          sdCardPath={props.sdCardPath}
          kitName={props.kitName}
          onSampleKeyNav={kitVoicePanels.onSampleKeyNav}
          onSampleSelect={(voice, idx) => {
            setSelectedVoice(voice);
            setSelectedSampleIdx(idx);
          }}
          sequencerOpen={sequencerOpen}
        />
      </div>
      <KitStepSequencer
        samples={samples}
        onPlaySample={handlePlay}
        stepPattern={stepPattern}
        setStepPattern={setStepPattern}
        sequencerOpen={sequencerOpen}
        setSequencerOpen={setSequencerOpen}
        gridRef={sequencerGridRef}
      />
    </div>
  );
};

export default KitDetails;

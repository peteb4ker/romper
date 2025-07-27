import React from "react";

import { useKitDetailsLogic } from "./hooks/useKitDetailsLogic";
import KitHeader from "./KitHeader";
import KitMetadataForm from "./KitMetadataForm";
import KitStepSequencer from "./KitStepSequencer";
import type { KitDetailsProps, RampleKitLabel } from "./kitTypes";
import KitVoicePanels from "./KitVoicePanels";
import UnscannedKitPrompt from "./UnscannedKitPrompt";

interface KitDetailsAllProps extends KitDetailsProps {
  kitLabel?: RampleKitLabel;
  onRescanAllVoiceNames?: () => void;
  onCreateKit?: () => void;
  onMessage?: (msg: { type: string; text: string }) => void;
  onRequestSamplesReload?: () => Promise<void>;
}

const KitDetails: React.FC<KitDetailsAllProps> = (props) => {
  const logic = useKitDetailsLogic(props);
  const [dismissedUnscannedPrompt, setDismissedUnscannedPrompt] =
    React.useState(false);

  // Check if kit needs scanning - this is just a simple heuristic for now
  // A more robust implementation would check the database for scan status
  const needsScanning =
    logic.metadata.kitLabel &&
    (!logic.metadata.kitLabel.voiceNames ||
      Object.keys(logic.metadata.kitLabel.voiceNames).length === 0) &&
    !dismissedUnscannedPrompt;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full p-2 pb-0 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-sm shadow">
      <KitHeader
        kitName={props.kitName}
        kitLabel={logic.metadata.kitLabel || null}
        editingKitLabel={logic.metadata.editingKitLabel}
        setEditingKitLabel={logic.metadata.setEditingKitLabel}
        kitLabelInput={logic.metadata.kitLabelInput}
        setKitLabelInput={logic.metadata.setKitLabelInput}
        handleSaveKitLabel={logic.metadata.handleSaveKitLabel}
        kitLabelInputRef={
          React.createRef<HTMLInputElement>() as React.RefObject<HTMLInputElement>
        }
        onBack={props.onBack}
        onNextKit={props.onNextKit}
        onPrevKit={props.onPrevKit}
        onCreateKit={props.onCreateKit}
        kits={props.kits}
        kitIndex={props.kitIndex}
        onRescanAllVoiceNames={() =>
          logic.metadata.handleRescanAllVoiceNames(logic.samples)
        }
        onScanKit={logic.handleScanKit}
      />

      {needsScanning && (
        <UnscannedKitPrompt
          kitName={props.kitName}
          onScan={() => logic.handleScanKit()}
          onDismiss={() => setDismissedUnscannedPrompt(true)}
        />
      )}

      <KitMetadataForm
        kitLabel={logic.metadata.kitLabel}
        loading={logic.metadata.labelsLoading}
        error={null} // error now handled by centralized message display
        editing={logic.metadata.editingKitLabel}
        onEdit={() => logic.metadata.setEditingKitLabel()}
        onCancel={() => logic.metadata.setEditingKitLabel()}
        onSave={logic.metadata.handleSaveKitLabel}
        hideDescription={true}
        tagsEditable={false} // Remove tag editing
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <KitVoicePanels
          samples={logic.samples}
          kitLabel={logic.metadata.kitLabel || null}
          selectedVoice={logic.selectedVoice}
          selectedSampleIdx={logic.selectedSampleIdx}
          setSelectedVoice={logic.setSelectedVoice}
          setSelectedSampleIdx={logic.setSelectedSampleIdx}
          onSaveVoiceName={logic.metadata.handleSaveVoiceName}
          onSampleSelect={(voice, idx) => {
            logic.setSelectedVoice(voice);
            logic.setSelectedSampleIdx(idx);
          }}
          onRescanVoiceName={logic.metadata.handleRescanVoiceName}
          sequencerOpen={logic.sequencerOpen}
          samplePlaying={logic.playback.samplePlaying}
          playTriggers={logic.playback.playTriggers}
          stopTriggers={logic.playback.stopTriggers}
          onPlay={logic.playback.handlePlay}
          onStop={logic.playback.handleStop}
          onWaveformPlayingChange={logic.playback.handleWaveformPlayingChange}
          localStorePath={props.localStorePath}
          kitName={props.kitName}
          onSampleKeyNav={logic.kitVoicePanels.onSampleKeyNav}
        />
      </div>
      <KitStepSequencer
        samples={logic.samples}
        onPlaySample={logic.playback.handlePlay}
        stepPattern={logic.metadata.stepPattern}
        setStepPattern={logic.metadata.setStepPattern}
        sequencerOpen={logic.sequencerOpen}
        setSequencerOpen={logic.setSequencerOpen}
        gridRef={logic.sequencerGridRef as React.RefObject<HTMLDivElement>}
      />
    </div>
  );
};

export default KitDetails;

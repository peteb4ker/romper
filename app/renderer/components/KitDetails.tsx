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
    logic.kitLabel &&
    (!logic.kitLabel.voiceNames ||
      Object.keys(logic.kitLabel.voiceNames).length === 0) &&
    !dismissedUnscannedPrompt;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full p-2 pb-0 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-sm shadow">
      <KitHeader
        kitName={props.kitName}
        kitLabel={logic.kitLabel}
        editingKitLabel={false}
        setEditingKitLabel={() => {}}
        kitLabelInput={logic.kit?.alias || logic.kit?.name || ""}
        setKitLabelInput={() => {}}
        handleSaveKitLabel={logic.updateKitAlias}
        kitLabelInputRef={
          React.createRef<HTMLInputElement>() as React.RefObject<HTMLInputElement>
        }
        onBack={props.onBack}
        onNextKit={props.onNextKit}
        onPrevKit={props.onPrevKit}
        onCreateKit={props.onCreateKit}
        kits={props.kits}
        kitIndex={props.kitIndex}
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
        kitLabel={logic.kitLabel}
        loading={logic.kitLoading}
        error={null} // error now handled by centralized message display
        editing={false}
        onEdit={() => {}}
        onCancel={() => {}}
        onSave={logic.updateKitAlias}
        hideDescription={true}
        tagsEditable={false} // Remove tag editing
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <KitVoicePanels
          samples={logic.samples}
          kitLabel={logic.kitLabel}
          selectedVoice={logic.selectedVoice}
          selectedSampleIdx={logic.selectedSampleIdx}
          setSelectedVoice={logic.setSelectedVoice}
          setSelectedSampleIdx={logic.setSelectedSampleIdx}
          onSaveVoiceName={logic.updateVoiceAlias}
          onSampleSelect={(voice, idx) => {
            logic.setSelectedVoice(voice);
            logic.setSelectedSampleIdx(idx);
          }}
          onRescanVoiceName={() => {}}
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
        stepPattern={logic.stepPattern}
        setStepPattern={logic.setStepPattern}
        sequencerOpen={logic.sequencerOpen}
        setSequencerOpen={logic.setSequencerOpen}
        gridRef={logic.sequencerGridRef as React.RefObject<HTMLDivElement>}
      />
    </div>
  );
};

export default KitDetails;

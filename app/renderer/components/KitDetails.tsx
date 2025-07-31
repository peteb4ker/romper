import React from "react";

import { useKitDetailsLogic } from "./hooks/useKitDetailsLogic";
import KitForm from "./KitForm";
import KitHeader from "./KitHeader";
import KitStepSequencer from "./KitStepSequencer";
import type { KitDetailsProps } from "./kitTypes";
import KitVoicePanels from "./KitVoicePanels";
import UnscannedKitPrompt from "./UnscannedKitPrompt";

interface KitDetailsAllProps extends KitDetailsProps {
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
    logic.kit &&
    (!logic.kit.voices ||
      logic.kit.voices.length === 0 ||
      logic.kit.voices.every((v) => !v.voice_alias)) &&
    !dismissedUnscannedPrompt;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full p-2 pb-0 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-sm shadow">
      <KitHeader
        kitName={props.kitName}
        kit={logic.kit}
        editingKitAlias={false}
        setEditingKitAlias={() => {}}
        kitAliasInput={logic.kit?.alias || logic.kit?.name || ""}
        setKitAliasInput={() => {}}
        handleSaveKitAlias={logic.updateKitAlias}
        kitAliasInputRef={
          React.createRef<HTMLInputElement>() as React.RefObject<HTMLInputElement>
        }
        onBack={props.onBack}
        onNextKit={props.onNextKit}
        onPrevKit={props.onPrevKit}
        onCreateKit={props.onCreateKit}
        kits={props.kits}
        kitIndex={props.kitIndex}
        onScanKit={logic.handleScanKit}
        onToggleEditableMode={logic.toggleEditableMode}
        isEditable={logic.kit?.editable ?? false}
      />

      {needsScanning && (
        <UnscannedKitPrompt
          kitName={props.kitName}
          onScan={() => logic.handleScanKit()}
          onDismiss={() => setDismissedUnscannedPrompt(true)}
        />
      )}

      <KitForm
        kit={logic.kit}
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
          kit={logic.kit}
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
          kitName={props.kitName}
          onSampleKeyNav={logic.kitVoicePanels.onSampleKeyNav}
          isEditable={logic.kit?.editable ?? false}
          onSampleAdd={logic.sampleManagement.handleSampleAdd}
          onSampleReplace={logic.sampleManagement.handleSampleReplace}
          onSampleDelete={logic.sampleManagement.handleSampleDelete}
          onSampleMove={logic.sampleManagement.handleSampleMove}
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

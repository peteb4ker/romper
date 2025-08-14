import React from "react";

import type { KitDetailsProps } from "./kitTypes";

import { useKitDetailsLogic } from "./hooks/kit-management/useKitDetailsLogic";
import KitForm from "./KitForm";
import KitHeader from "./KitHeader";
import KitStepSequencer from "./KitStepSequencer";
import KitVoicePanels from "./KitVoicePanels";
import UnscannedKitPrompt from "./UnscannedKitPrompt";

interface KitDetailsAllProps extends KitDetailsProps {
  onCreateKit?: () => void; // Used by useKitDetailsLogic hook
  onMessage?: (text: string, type?: string, duration?: number) => void; // Used by useKitDetailsLogic hook
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
    <div
      className="flex flex-col flex-1 min-h-0 h-full p-2 pb-0 bg-gray-100 dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-sm shadow"
      data-testid="kit-details"
    >
      <KitHeader
        editingKitAlias={false}
        handleSaveKitAlias={logic.updateKitAlias}
        isEditable={logic.kit?.editable ?? false}
        kit={logic.kit}
        kitAliasInput={logic.kit?.alias || logic.kit?.name || ""}
        kitAliasInputRef={
          React.createRef<HTMLInputElement>() as React.RefObject<HTMLInputElement>
        }
        kitIndex={props.kitIndex}
        kitName={props.kitName}
        kits={props.kits}
        onBack={props.onBack}
        onNextKit={props.onNextKit}
        onPrevKit={props.onPrevKit}
        onScanKit={logic.handleScanKit}
        onToggleEditableMode={logic.toggleEditableMode}
        setEditingKitAlias={() => {}}
        setKitAliasInput={() => {}}
      />

      {needsScanning && (
        <UnscannedKitPrompt
          kitName={props.kitName}
          onDismiss={() => setDismissedUnscannedPrompt(true)}
          onScan={() => logic.handleScanKit()}
        />
      )}

      <KitForm
        error={null} // error now handled by centralized message display
        kit={logic.kit}
        loading={logic.kitLoading}
        onSave={logic.updateKitAlias}
        tagsEditable={false} // Remove tag editing
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <KitVoicePanels
          isEditable={logic.kit?.editable ?? false}
          kit={logic.kit}
          kitName={props.kitName}
          onPlay={logic.playback.handlePlay}
          onRescanVoiceName={() => {}}
          onSampleAdd={logic.sampleManagement.handleSampleAdd}
          onSampleDelete={logic.sampleManagement.handleSampleDelete}
          onSampleKeyNav={logic.kitVoicePanels.onSampleKeyNav}
          onSampleMove={logic.sampleManagement.handleSampleMove}
          onSampleReplace={logic.sampleManagement.handleSampleReplace}
          onSampleSelect={(voice, idx) => {
            logic.setSelectedVoice(voice);
            logic.setSelectedSampleIdx(idx);
          }}
          onSaveVoiceName={logic.updateVoiceAlias}
          onStop={logic.playback.handleStop}
          onWaveformPlayingChange={logic.playback.handleWaveformPlayingChange}
          playTriggers={logic.playback.playTriggers}
          samplePlaying={logic.playback.samplePlaying}
          samples={logic.samples}
          selectedSampleIdx={logic.selectedSampleIdx}
          selectedVoice={logic.selectedVoice}
          sequencerOpen={logic.sequencerOpen}
          setSelectedSampleIdx={logic.setSelectedSampleIdx}
          setSelectedVoice={logic.setSelectedVoice}
          stopTriggers={logic.playback.stopTriggers}
        />
      </div>
      <KitStepSequencer
        gridRef={logic.sequencerGridRef as React.RefObject<HTMLDivElement>}
        onPlaySample={logic.playback.handlePlay}
        samples={logic.samples}
        sequencerOpen={logic.sequencerOpen}
        setSequencerOpen={logic.setSequencerOpen}
        setStepPattern={logic.setStepPattern}
        stepPattern={logic.stepPattern}
      />
    </div>
  );
};

export default KitDetails;

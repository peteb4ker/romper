import type { KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import type { KitEditorProps } from "./kitTypes";

import { useKitEditorLogic } from "./hooks/kit-management/useKitEditorLogic";
import KitForm from "./KitForm";
import KitHeader from "./KitHeader";
import KitStepSequencer from "./KitStepSequencer";
import KitVoicePanels from "./KitVoicePanels";
import UnscannedKitPrompt from "./UnscannedKitPrompt";

interface KitEditorAllProps extends KitEditorProps {
  kit?: KitWithRelations; // Kit data passed from parent - used via useKitEditorLogic hook
  kitError?: null | string; // Error from parent kit loading - used via useKitEditorLogic hook
  onCreateKit?: () => void; // Used by useKitEditorLogic hook
  onKitUpdated?: () => Promise<void>; // Called when kit metadata is updated
  onMessage?: (text: string, type?: string, duration?: number) => void; // Used by useKitEditorLogic hook
  onRequestSamplesReload?: () => Promise<void>;
  onToggleEditableMode?: (kitName: string) => Promise<void>; // Toggle editable mode - used via useKitEditorLogic hook
  onToggleFavorite?: (
    kitName: string,
  ) => Promise<{ isFavorite?: boolean; success: boolean }>; // For favorite star button
  onUpdateKitAlias?: (kitName: string, alias: string) => Promise<void>; // Update kit alias - used via useKitEditorLogic hook
}

const KitEditor: React.FC<KitEditorAllProps> = (props) => {
  // Note: All props are used via useKitEditorLogic hook
  // SonarQube doesn't detect indirect prop usage through hooks
  const logic = useKitEditorLogic(props);
  const [dismissedUnscannedPrompt, setDismissedUnscannedPrompt] =
    React.useState(false);

  // Kit alias editing state
  const [editingKitAlias, setEditingKitAlias] = React.useState(false);
  const [kitAliasInput, setKitAliasInput] = React.useState(
    logic.kit?.alias || "",
  );
  const kitAliasInputRef = React.useRef<HTMLInputElement>(null!);

  // Update kitAliasInput when kit changes
  React.useEffect(() => {
    setKitAliasInput(logic.kit?.alias || "");
  }, [logic.kit?.alias]);

  // Check if kit needs scanning - this is just a simple heuristic for now
  // A more robust implementation would check the database for scan status
  // Don't show scanning prompt for empty kits (no samples to scan yet)
  const hasAnySamples =
    logic.samples &&
    Object.values(logic.samples).some(
      (voiceSamples) => voiceSamples.length > 0,
    );
  const needsScanning =
    logic.kit &&
    hasAnySamples && // Only show scanning prompt if there are actually samples to scan
    (!logic.kit.voices ||
      logic.kit.voices.length === 0 ||
      logic.kit.voices.every((v) => !v.voice_alias)) &&
    !dismissedUnscannedPrompt;

  return (
    <div
      className="flex flex-col flex-1 min-h-0 h-full bg-surface-0 text-text-primary rounded-sm shadow"
      data-testid="kit-editor"
    >
      <KitHeader
        editingKitAlias={editingKitAlias}
        handleSaveKitAlias={logic.updateKitAlias}
        isEditable={logic.kit?.editable ?? false}
        kit={logic.kit}
        kitAliasInput={kitAliasInput}
        kitAliasInputRef={kitAliasInputRef}
        kitIndex={props.kitIndex}
        kitName={props.kitName}
        kits={props.kits}
        onBack={props.onBack}
        onNextKit={props.onNextKit}
        onPrevKit={props.onPrevKit}
        onScanKit={logic.handleScanKit}
        onToggleEditableMode={logic.toggleEditableMode}
        onToggleFavorite={props.onToggleFavorite}
        setEditingKitAlias={setEditingKitAlias}
        setKitAliasInput={setKitAliasInput}
      />

      {needsScanning && (
        <div className="px-2">
          <UnscannedKitPrompt
            kitName={props.kitName}
            onDismiss={() => setDismissedUnscannedPrompt(true)}
            onScan={() => logic.handleScanKit()}
          />
        </div>
      )}

      <div className="px-2">
        <KitForm
          error={null} // error now handled by centralized message display
          kit={logic.kit}
          loading={logic.kitLoading}
          onSave={logic.updateKitAlias}
          tagsEditable={false} // Remove tag editing
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2">
        <KitVoicePanels
          isEditable={logic.kit?.editable ?? false}
          kit={logic.kit}
          kitName={props.kitName}
          onKitUpdated={logic.reloadKit}
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
          playVolumes={logic.playback.playVolumes}
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
        bpm={logic.kit?.bpm}
        gridRef={logic.sequencerGridRef as React.RefObject<HTMLDivElement>}
        kitName={props.kitName}
        onPlaySample={logic.playback.handlePlay}
        onVoiceSettingChanged={logic.reloadKit}
        samples={logic.samples}
        sequencerOpen={logic.sequencerOpen}
        setSequencerOpen={logic.setSequencerOpen}
        setStepPattern={logic.setStepPattern}
        setTriggerConditions={logic.setTriggerConditions}
        stepPattern={logic.stepPattern}
        triggerConditions={logic.triggerConditions}
        voices={logic.kit?.voices}
      />
    </div>
  );
};

export default KitEditor;

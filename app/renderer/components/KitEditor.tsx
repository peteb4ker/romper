import type { DbResult, KitWithRelations } from "@romper/shared/db/schema";

import React from "react";

import type { KitEditorProps } from "./kitTypes";

import { useKitEditorLogic } from "./hooks/kit-management/useKitEditorLogic";
import KitForm from "./KitForm";
import KitHeader from "./KitHeader";
import KitStepSequencer from "./KitStepSequencer";
import KitVoicePanels from "./KitVoicePanels";

interface KitEditorAllProps extends KitEditorProps {
  kit?: KitWithRelations; // Kit data passed from parent - used via useKitEditorLogic hook
  kitError?: null | string; // Error from parent kit loading - used via useKitEditorLogic hook
  onBpmSaved?: (kitName: string, bpm: number) => void; // Patches the loaded kit after a BPM save (#565)
  onCreateKit?: () => void; // Used by useKitEditorLogic hook
  onKitModified?: (kitName: string) => void; // Shows an edit main flagged without a reload (RE-35)
  onKitUpdated?: () => Promise<void>; // Called when kit metadata is updated
  onMessage?: (text: string, type?: string, duration?: number) => void; // Used by useKitEditorLogic hook
  onRefreshKitMetadata?: () => Promise<void>; // Targeted refresh for single kit metadata (voice aliases)
  onRequestSamplesReload?: () => Promise<void>;
  onToggleEditableMode?: (kitName: string) => Promise<void>; // Toggle editable mode - used via useKitEditorLogic hook
  onToggleFavorite?: (
    kitName: string,
  ) => Promise<DbResult<{ isFavorite: boolean }>>; // Star button and ; key, via useKitEditorLogic
  onUpdateKitAlias?: (kitName: string, alias: string) => Promise<void>; // Update kit alias - used via useKitEditorLogic hook
}

const KitEditor: React.FC<KitEditorAllProps> = (props) => {
  // Note: All props are used via useKitEditorLogic hook
  // SonarQube doesn't detect indirect prop usage through hooks
  const logic = useKitEditorLogic(props);

  // Kit alias editing state
  const [editingKitAlias, setEditingKitAlias] = React.useState(false);
  const [kitAliasInput, setKitAliasInput] = React.useState(
    logic.kit?.alias || "",
  );
  const kitAliasInputRef = React.useRef<HTMLInputElement>(null!);

  // Update kitAliasInput when kit changes
  const kitAlias = logic.kit?.alias;
  const [shownAlias, setShownAlias] = React.useState(kitAlias);
  if (shownAlias !== kitAlias) {
    setShownAlias(kitAlias);
    setKitAliasInput(kitAlias || "");
  }

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
        onScanKit={
          logic.kit?.editable
            ? logic.handleInferVoiceNames
            : logic.handleScanKit
        }
        onToggleEditableMode={logic.toggleEditableMode}
        onToggleFavorite={logic.toggleFavorite}
        setEditingKitAlias={setEditingKitAlias}
        setKitAliasInput={setKitAliasInput}
      />

      {/* Inline scan status */}
      {logic.scanStatus.status === "scanning" && (
        <div
          className="px-2.5 py-1.5 text-xs text-text-secondary flex items-center gap-2"
          data-testid="kit-scan-status"
        >
          <span className="inline-block w-3 h-3 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />{" "}
          Rescanning...
        </div>
      )}
      {logic.scanStatus.status === "success" && (
        <div
          className="px-2.5 py-1.5 text-xs text-accent-success"
          data-testid="kit-scan-status"
        >
          Found {logic.scanStatus.sampleCount} samples
          {logic.scanStatus.detail ? `: ${logic.scanStatus.detail}` : ""}
          {logic.scanStatus.stereoLines && (
            <ul
              className="mt-0.5 text-text-secondary"
              data-testid="kit-scan-stereo"
            >
              {logic.scanStatus.stereoLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {logic.scanStatus.status === "error" && (
        <div
          className="px-2.5 py-1.5 text-xs text-accent-error"
          data-testid="kit-scan-status"
        >
          {logic.scanStatus.message}
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
          flashVoices={logic.flashVoices}
          isEditable={logic.kit?.editable ?? false}
          kit={logic.kit}
          kitName={props.kitName}
          onBatchDropComplete={logic.reloadKit}
          onKitModified={props.onKitModified}
          onKitUpdated={logic.reloadKit}
          onMessage={props.onMessage}
          onPlay={logic.playback.handlePlay}
          onSampleAdd={logic.sampleManagement.handleSampleAdd}
          onSampleDelete={logic.sampleManagement.handleSampleDelete}
          onSampleKeyNav={logic.kitVoicePanels.onSampleKeyNav}
          onSampleMove={logic.sampleManagement.handleSampleMove}
          onSampleSelect={(voice, idx) => {
            logic.setSelectedVoice(voice);
            logic.setSelectedSampleIdx(idx);
          }}
          onSaveVoiceName={logic.updateVoiceAlias}
          onStop={logic.playback.handleStop}
          onWaveformPlayingChange={logic.playback.handleWaveformPlayingChange}
          samples={logic.samples}
          selectedSampleIdx={logic.selectedSampleIdx}
          selectedVoice={logic.selectedVoice}
          sequencerOpen={logic.sequencerOpen}
          setSelectedSampleIdx={logic.setSelectedSampleIdx}
          setSelectedVoice={logic.setSelectedVoice}
          slotPlayback={logic.playback.slotPlayback}
        />
      </div>
      <KitStepSequencer
        bpm={logic.kit?.bpm}
        gridRef={logic.sequencerGridRef as React.RefObject<HTMLDivElement>}
        kitName={props.kitName}
        kitSamples={logic.kit?.samples}
        onAddUndoAction={props.onAddUndoAction}
        onBpmSaved={props.onBpmSaved}
        onMessage={props.onMessage}
        onPlaySample={logic.playback.handlePlay}
        onVoiceSettingChanged={logic.reloadKit}
        samples={logic.samples}
        selectedSampleIdx={logic.selectedSampleIdx}
        selectedVoice={logic.selectedVoice}
        sequencerOpen={logic.sequencerOpen}
        sequenceUndo={props.sequenceUndo}
        setSequencerOpen={logic.setSequencerOpen}
        setStepPattern={logic.setStepPattern}
        setTriggerConditions={logic.setTriggerConditions}
        slicerDivision={logic.kit?.slicer_division}
        sliceSteps={logic.kit?.slice_steps}
        stepPattern={logic.stepPattern}
        triggerConditions={logic.triggerConditions}
        voices={logic.kit?.voices}
      />
    </div>
  );
};

export default KitEditor;

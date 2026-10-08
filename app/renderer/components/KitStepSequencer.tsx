import type { Sample } from "@romper/shared/db/schema";
import type { SliceStep } from "@romper/shared/sliceTypes";
import type { AnyUndoAction } from "@romper/shared/undoTypes";

import React from "react";

import type { SliceView } from "./hooks/shared/sliceConstants";
import type { PlayOptions, SequenceUndo } from "./kitTypes";

import { isModalDialogOpen } from "../utils/modalDialog";
import { slotSampleSource } from "../utils/slotKey";
import { useKitStepSequencerLogic } from "./hooks/kit-management/useKitStepSequencerLogic";
import { useSequenceHistory } from "./hooks/kit-management/useSequenceHistory";
import {
  type SlicerVoiceData,
  useSlicerEditor,
  useVoiceSliceSettings,
} from "./hooks/kit-management/useSlicerEditor";
import {
  type FocusedStep,
  NUM_VOICES,
  SAMPLE_MODE_LABELS,
  type SampleMode,
  type TriggerCondition,
} from "./hooks/shared/stepPatternConstants";
import { useBpm } from "./hooks/shared/useBpm";
import { useLatestRef } from "./hooks/shared/useLatestRef";
import { useSettingSave } from "./hooks/shared/useSettingSave";
import { useSliceSteps } from "./hooks/shared/useSliceSteps";
import { SequencerKeysOverlay } from "./SequencerHelp";
import {
  PAD_GAP,
  PADS_LEFT,
  SEQUENCER_VARS,
  STEPS_SPAN,
  TRANSPORT_GAP,
} from "./sequencerLayout";
import SliceStrip from "./SliceStrip";
import StepSequencerControls from "./StepSequencerControls";
import StepSequencerDrawer from "./StepSequencerDrawer";
import StepSequencerGrid from "./StepSequencerGrid";

export interface StereoLinks {
  linkedSecondaries: Set<number>;
  primaryLabels: Record<number, string>;
}

interface KitStepSequencerProps {
  bpm?: number;
  gridRef?: React.RefObject<HTMLDivElement>;
  kitName: string;
  /** The kit's sample rows, which say which file each slot holds */
  kitSamples?: Sample[];
  /** Records sequencer edits on the kit's undo stack. */
  onAddUndoAction?: (action: AnyUndoAction) => void;
  /** Called once main has saved a kit's BPM, to patch the loaded kit (#565) */
  onBpmSaved?: (kitName: string, bpm: number) => void;
  /** Tells the user a sequencer edit wasn't saved (RE-91, #511) */
  onMessage?: (text: string, type?: string, duration?: number) => void;
  onPlaySample: (
    voice: number,
    slot: number,
    volume?: number,
    options?: PlayOptions,
  ) => void;
  onVoiceSettingChanged?: () => void;
  samples: { [voice: number]: string[] };
  /** Slot selected in the voice panels; the slice strip shows it. */
  selectedSampleIdx?: number;
  selectedVoice?: number;
  sequencerOpen: boolean;
  sequenceUndo?: SequenceUndo;
  setSequencerOpen: (open: boolean) => void;
  setStepPattern: (pattern: number[][]) => void;
  setTriggerConditions: (conditions: (null | string)[][]) => void;
  slicerDivision?: null | number;
  sliceSteps?: (null | SliceStep)[][] | null;
  stepPattern: null | number[][];
  triggerConditions: (null | string)[][];
  voices?: VoiceData[];
}

type SequencerVoices = KitStepSequencerProps["voices"];

interface VoiceData extends SlicerVoiceData {
  sample_mode?: string;
  stereo_mode?: boolean;
  voice_number: number;
  voice_volume?: number;
}

/** Each voice's sample mode: the loaded voices', or "first" until they load */
function modesFromVoices(voices: SequencerVoices): Record<number, SampleMode> {
  const modes: Record<number, SampleMode> = {};
  if (voices?.length) {
    for (const voice of voices) {
      modes[voice.voice_number] = (voice.sample_mode as SampleMode) || "first";
    }
    return modes;
  }
  for (let i = 1; i <= NUM_VOICES; i++) modes[i] = "first";
  return modes;
}

function unmutedVoices(): Record<number, boolean> {
  const mutes: Record<number, boolean> = {};
  for (let i = 1; i <= NUM_VOICES; i++) {
    mutes[i] = false;
  }
  return mutes;
}

/** Each voice's level: the loaded voices', or 100 until they load */
function volumesFromVoices(voices: SequencerVoices): Record<number, number> {
  const volumes: Record<number, number> = {};
  if (voices?.length) {
    for (const voice of voices) {
      volumes[voice.voice_number] = voice.voice_volume ?? 100;
    }
    return volumes;
  }
  for (let i = 1; i <= NUM_VOICES; i++) volumes[i] = 100;
  return volumes;
}

const KitStepSequencer: React.FC<KitStepSequencerProps> = (props) => {
  // Destructure props used inside useCallback to satisfy exhaustive-deps
  // without depending on the whole `props` object.
  const {
    kitName,
    onBpmSaved,
    onMessage,
    onVoiceSettingChanged,
    triggerConditions,
  } = props;

  // The kit on screen, so a save that fails after you step to another kit
  // doesn't put its value back on the new kit's voice (#565)
  const kitRef = useLatestRef(kitName);

  // Manage BPM state at this level to ensure sequencer logic gets live updates
  const bpmLogic = useBpm({
    initialBpm: props.bpm,
    kitName,
    onMessage,
    onSaved: onBpmSaved,
  });

  // Voice mute state — session only, not persisted, and each kit starts
  // unmuted: the editor isn't remounted when you step to another kit (#565)
  const [voiceMutes, setVoiceMutes] =
    React.useState<Record<number, boolean>>(unmutedVoices);
  const [mutesKit, setMutesKit] = React.useState(kitName);
  if (mutesKit !== kitName) {
    setMutesKit(kitName);
    setVoiceMutes(unmutedVoices());
  }

  const handleMuteToggle = React.useCallback((voiceNumber: number) => {
    setVoiceMutes((prev) => ({ ...prev, [voiceNumber]: !prev[voiceNumber] }));
  }, []);

  // Voice volume state — initialized from voice data, managed locally
  const [voiceVolumes, setVoiceVolumes] = React.useState<
    Record<number, number>
  >(() => volumesFromVoices(props.voices));

  // Sample mode state — initialized from voice data, managed locally
  const [sampleModes, setSampleModes] = React.useState<
    Record<number, SampleMode>
  >(() => modesFromVoices(props.voices));

  // Level and sample mode saves: a failed one goes back and says so (RE-91)
  const { reset: resetVolumeSaves, save: saveVolume } = useSettingSave<
    number,
    number
  >();
  const { reset: resetModeSaves, save: saveMode } = useSettingSave<
    number,
    SampleMode
  >();

  // Sync state from voice data when it arrives/changes
  const [shownVoices, setShownVoices] = React.useState(props.voices);
  if (shownVoices !== props.voices) {
    setShownVoices(props.voices);
    if (props.voices?.length) {
      setVoiceVolumes(volumesFromVoices(props.voices));
      setSampleModes(modesFromVoices(props.voices));
    }
  }
  React.useEffect(() => {
    if (!props.voices?.length) return;
    resetVolumeSaves();
    resetModeSaves();
  }, [props.voices, resetVolumeSaves, resetModeSaves]);

  // Debounce kit cache refresh for volume slider drags
  const refreshTimerRef = React.useRef<null | ReturnType<typeof setTimeout>>(
    null,
  );
  const debouncedRefresh = React.useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      onVoiceSettingChanged?.();
    }, 500);
  }, [onVoiceSettingChanged]);

  // Handle volume change — update local state + persist via IPC
  const handleVolumeChange = React.useCallback(
    (voiceNumber: number, volume: number) => {
      const setVolume = (value: number) =>
        setVoiceVolumes((prev) => ({ ...prev, [voiceNumber]: value }));
      setVolume(volume);
      void saveVolume({
        current: voiceVolumes[voiceNumber] ?? 100,
        key: voiceNumber,
        report: (saved) =>
          onMessage?.(
            `Couldn't save the level for voice ${voiceNumber}, so it's back to ${saved}. Try again.`,
            "error",
          ),
        restore: (saved) => {
          if (kitRef.current === kitName) setVolume(saved);
        },
        send: () =>
          globalThis.electronAPI?.updateVoiceVolume?.(
            kitName,
            voiceNumber,
            volume,
          ),
        value: volume,
        what: `the level for voice ${voiceNumber}`,
      });
      debouncedRefresh();
    },
    [kitName, kitRef, debouncedRefresh, onMessage, saveVolume, voiceVolumes],
  );

  // Handle sample mode change — update local state + persist via IPC
  const handleSampleModeChange = React.useCallback(
    (voiceNumber: number, mode: SampleMode) => {
      const setMode = (value: SampleMode) =>
        setSampleModes((prev) => ({ ...prev, [voiceNumber]: value }));
      setMode(mode);
      void saveMode({
        current: sampleModes[voiceNumber] ?? "first",
        key: voiceNumber,
        onSaved: () => onVoiceSettingChanged?.(),
        report: (saved) =>
          onMessage?.(
            `Couldn't save the sample mode for voice ${voiceNumber}, so it's back to ${SAMPLE_MODE_LABELS[saved]}. Try again.`,
            "error",
          ),
        restore: (saved) => {
          if (kitRef.current === kitName) setMode(saved);
        },
        send: () =>
          globalThis.electronAPI?.updateVoiceSampleMode?.(
            kitName,
            voiceNumber,
            mode,
          ),
        value: mode,
        what: `the sample mode for voice ${voiceNumber}`,
      });
    },
    [kitName, kitRef, onMessage, onVoiceSettingChanged, saveMode, sampleModes],
  );

  // Compute stereo-linked voice pairs from voice data
  const stereoLinks = React.useMemo<StereoLinks>(() => {
    const linkedSecondaries = new Set<number>();
    const primaryLabels: Record<number, string> = {};

    if (props.voices) {
      for (const voice of props.voices) {
        if (voice.stereo_mode && voice.voice_number < NUM_VOICES) {
          const secondary = voice.voice_number + 1;
          linkedSecondaries.add(secondary);
          primaryLabels[voice.voice_number] =
            `${voice.voice_number}+${secondary}`;
        }
      }
    }

    return { linkedSecondaries, primaryLabels };
  }, [props.voices]);

  // Slicer: per-step slice data, kit-wide division, per-voice settings
  const slicerData = useSliceSteps({
    initialDivision: props.slicerDivision,
    initialSliceSteps: props.sliceSteps,
    kitName,
    onMessage,
    onSaved: onVoiceSettingChanged,
  });
  // Every step, condition and slice edit goes on the kit's undo stack
  const history = useSequenceHistory({
    onAddUndoAction: props.onAddUndoAction,
    setSliceSteps: slicerData.setSliceSteps,
    setStepPattern: props.setStepPattern,
    setTriggerConditions: props.setTriggerConditions,
    sliceSteps: slicerData.sliceSteps,
    stepPattern: props.stepPattern,
    triggerConditions,
  });
  const setHistoryTriggerConditions = history.setTriggerConditions;

  // Handle trigger condition change — update local state + persist
  const handleConditionChange = React.useCallback(
    (voiceIdx: number, stepIdx: number, condition: TriggerCondition) => {
      const newConditions = triggerConditions.map((row, v) =>
        v === voiceIdx
          ? row.map((c, s) => (s === stepIdx ? condition : c))
          : row,
      );
      setHistoryTriggerConditions(newConditions, {
        description: `Set step ${stepIdx + 1} on voice ${voiceIdx + 1} to ${condition ?? "always"}`,
      });
    },
    [triggerConditions, setHistoryTriggerConditions],
  );

  const { sliceSettings, updateSliceSettings } = useVoiceSliceSettings(
    kitName,
    props.voices,
    onVoiceSettingChanged,
    onMessage,
  );

  // The slicer editor needs the sequencer logic and vice versa; these refs
  // bridge the two callbacks the logic hook calls into the slicer.
  const gridKeyRef = React.useRef<
    (e: React.KeyboardEvent<HTMLDivElement>, focus: FocusedStep) => boolean
  >(() => false);
  const sliceTriggeredRef = React.useRef<
    (voiceNumber: number, view: SliceView) => void
  >(() => {});
  const onGridKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, focus: FocusedStep) =>
      gridKeyRef.current(e, focus),
    [],
  );
  const onSliceTriggered = React.useCallback(
    (voiceNumber: number, view: SliceView) =>
      sliceTriggeredRef.current(voiceNumber, view),
    [],
  );

  // Pass the current BPM from bpmLogic to sequencer logic for live updates
  const logic = useKitStepSequencerLogic({
    ...props,
    bpm: bpmLogic.bpm,
    onGridKeyDown,
    onSliceTriggered,
    sampleModes,
    setStepPattern: history.setStepPattern,
    slicerDivision: slicerData.slicerDivision,
    sliceSettings,
    sliceSteps: slicerData.sliceSteps,
    stereoLinks,
    triggerConditions: props.triggerConditions,
    voiceMutes,
    voiceVolumes,
  });

  const slicer = useSlicerEditor({
    focusedStep: logic.focusedStep,
    isSeqPlaying: logic.isSeqPlaying,
    kitName,
    onPlaySample: props.onPlaySample,
    samples: props.samples,
    selectedSampleIdx: props.selectedSampleIdx,
    selectedVoice: props.selectedVoice,
    setFocusedStep: logic.setFocusedStep,
    setSliceSteps: history.setSliceSteps,
    slicerDivision: slicerData.slicerDivision,
    sliceSettings,
    sliceSteps: slicerData.sliceSteps,
    stepPattern: logic.safeStepPattern,
    toggleStep: logic.toggleStep,
    updateSliceSettings,
    voiceVolumes,
  });
  React.useLayoutEffect(() => {
    gridKeyRef.current = slicer.handleGridKeyDown;
    sliceTriggeredRef.current = slicer.handleSliceTriggered;
  });

  const sliceEnabled = React.useMemo(() => {
    const enabled: Record<number, boolean> = {};
    for (const [voice, settings] of Object.entries(sliceSettings)) {
      enabled[Number(voice)] = settings.enabled;
    }
    return enabled;
  }, [sliceSettings]);

  const sliceUnavailable = React.useMemo(() => {
    const unavailable: Record<number, boolean> = {};
    for (let v = 1; v <= NUM_VOICES; v++) {
      unavailable[v] = !(props.samples[v] ?? []).some(Boolean);
    }
    return unavailable;
  }, [props.samples]);

  // The shortcut overlay: "?" toggles it while the sequencer shows
  const [keysOpen, setKeysOpen] = React.useState(false);
  const { gridRefInternal } = logic;
  const gridRefProp = props.gridRef;
  const closeKeys = React.useCallback(() => {
    setKeysOpen(false);
    (gridRefProp || gridRefInternal).current?.focus();
  }, [gridRefProp, gridRefInternal]);
  // Closing the sequencer closes the overlay
  if (!props.sequencerOpen && keysOpen) setKeysOpen(false);
  React.useEffect(() => {
    if (!props.sequencerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "?" || e.defaultPrevented || isModalDialogOpen()) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      setKeysOpen((open) => !open);
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [props.sequencerOpen]);

  const editingVoice = slicer.editingVoice;
  const editingIdx = editingVoice == null ? -1 : editingVoice - 1;
  // The file in the slot the strip shows, so it loads another file that
  // takes the slot (#575)
  const displayedSource = slotSampleSource(
    props.kitSamples?.find(
      (row) =>
        row.voice_number === editingVoice &&
        row.slot_number === slicer.displayedSlot,
    ),
    slicer.displayedSample,
  );
  const editingRowOn = (step: number) =>
    (logic.safeStepPattern[editingIdx]?.[step] ?? 0) > 0;
  const selectedStep = slicer.selectedStep;
  const hover = slicer.hoverStep;
  const usedSlices = React.useMemo(() => {
    const used = new Set<number>();
    if (editingIdx < 0) return used;
    slicer.sliceViews[editingIdx]?.forEach((view, step) => {
      const cell = slicerData.sliceSteps[editingIdx]?.[step];
      if (
        (logic.safeStepPattern[editingIdx]?.[step] ?? 0) > 0 &&
        !cell?.random
      ) {
        used.add(view.startSlice);
      }
    });
    return used;
  }, [
    editingIdx,
    logic.safeStepPattern,
    slicer.sliceViews,
    slicerData.sliceSteps,
  ]);

  return (
    <StepSequencerDrawer
      sequencerOpen={props.sequencerOpen}
      setSequencerOpen={props.setSequencerOpen}
    >
      <div
        className="relative flex flex-col"
        data-testid="kit-step-sequencer-body"
        style={SEQUENCER_VARS}
      >
        {slicer.editorOpen && editingVoice != null && (
          <SliceStrip
            canUndo={props.sequenceUndo?.canUndo ?? false}
            division={slicerData.slicerDivision}
            editingVoice={editingVoice}
            hoverView={
              hover?.voice === editingIdx &&
              hover.step !== selectedStep &&
              editingRowOn(hover.step)
                ? (slicer.sliceViews[editingIdx]?.[hover.step] ?? null)
                : null
            }
            kitName={kitName}
            notice={slicer.notice}
            onAssign={slicer.assignSlice}
            onAudition={slicer.auditionSlice}
            onClose={slicer.closeEditor}
            onDivisionChange={(d) => void slicerData.setSlicerDivision(d)}
            onRoll={() => slicer.roll(editingVoice)}
            onSelectVoice={slicer.setEditingVoice}
            onSettingsChange={(update) =>
              slicer.handleSliceSettingsChange(editingVoice, update)
            }
            onUndo={() => props.sequenceUndo?.undo()}
            playingView={
              slicer.playingSlice?.voiceNumber === editingVoice
                ? slicer.playingSlice.view
                : null
            }
            sampleName={slicer.displayedSample}
            sampleSource={displayedSource}
            selectedStep={selectedStep}
            selectedStepRandom={
              selectedStep != null &&
              (slicerData.sliceSteps[editingIdx]?.[selectedStep]?.random ??
                false)
            }
            selectedView={
              selectedStep == null
                ? null
                : (slicer.sliceViews[editingIdx]?.[selectedStep] ?? null)
            }
            settings={sliceSettings[editingVoice]}
            sliceVoices={slicer.sliceVoices}
            slotIndex={slicer.displayedSlot}
            usedSlices={usedSlices}
            voiceLabel={
              stereoLinks.primaryLabels[editingVoice] ?? String(editingVoice)
            }
            waveformStyle={{
              // Under the strip's 1px border and 8px padding, so slice
              // columns line up with the step columns below
              marginLeft: PADS_LEFT - 9 - PAD_GAP / 2,
              width: STEPS_SPAN,
            }}
          />
        )}
        <div
          className="flex flex-row items-start"
          style={{ gap: TRANSPORT_GAP }}
        >
          {/* Transport column — left */}
          <StepSequencerControls
            bpmLogic={bpmLogic}
            cycleCount={logic.cycleCount}
            isSeqPlaying={logic.isSeqPlaying}
            kitName={props.kitName}
            onShowKeys={() => setKeysOpen(true)}
            setIsSeqPlaying={logic.setIsSeqPlaying}
          />
          {/* Grid with integrated voice controls on right */}
          <StepSequencerGrid
            currentSeqStep={logic.currentSeqStep}
            firingVoices={logic.firingVoices}
            focusedStep={logic.focusedStep}
            gridRef={props.gridRef || logic.gridRefInternal}
            handleStepGridKeyDown={logic.handleStepGridKeyDown}
            isSeqPlaying={logic.isSeqPlaying}
            LED_GLOWS={logic.LED_GLOWS}
            NUM_STEPS={logic.NUM_STEPS}
            NUM_VOICES={logic.NUM_VOICES}
            onConditionChange={handleConditionChange}
            onMuteToggle={handleMuteToggle}
            onSampleModeChange={handleSampleModeChange}
            onSliceStepUpdate={slicer.updateSliceStep}
            onSliceToggle={slicer.handleSliceToggle}
            onStepClick={slicer.handleStepClick}
            onStepHover={slicer.setHoverStep}
            onStepWheel={slicer.handleStepWheel}
            onVolumeChange={handleVolumeChange}
            rolledSteps={slicer.rolledSteps}
            ROW_COLORS={logic.ROW_COLORS}
            safeStepPattern={logic.safeStepPattern}
            sampleModes={sampleModes}
            setFocusedStep={logic.setFocusedStep}
            sliceEnabled={sliceEnabled}
            slicerDivision={slicerData.slicerDivision}
            sliceSteps={slicerData.sliceSteps}
            sliceUnavailable={sliceUnavailable}
            sliceViews={slicer.sliceViews}
            stereoLinks={stereoLinks}
            toggleStep={logic.toggleStep}
            triggerConditions={props.triggerConditions}
            voiceMutes={voiceMutes}
            voiceVolumes={voiceVolumes}
          />
        </div>
        {keysOpen && <SequencerKeysOverlay onClose={closeKeys} />}
      </div>
    </StepSequencerDrawer>
  );
};

export default KitStepSequencer;

import type { KitEdit } from "@romper/shared/db/schema";

import {
  DEFAULT_VOICE_SLICE_SETTINGS,
  type SlicerDivision,
  type SliceStep,
  type VoiceSliceSettings,
} from "@romper/shared/sliceTypes";
import React from "react";

import type { PlayOptions } from "../../kitTypes";
import type { SequenceEditMeta } from "./useSequenceHistory";

import {
  makeSliceStep,
  nudgeLengthSlices,
  nudgeStartSlice,
  rollSliceRow,
  sequentialSliceStep,
  sliceRegion,
  type SliceView,
  toSliceView,
} from "../shared/sliceConstants";
import { type FocusedStep, NUM_VOICES } from "../shared/stepPatternConstants";
import { useLatestRef } from "../shared/useLatestRef";
import { useSettingSave } from "../shared/useSettingSave";

export interface PlayingSlice {
  id: number;
  view: SliceView;
  voiceNumber: number;
}

export interface RolledSteps {
  id: number;
  steps: number[];
  voiceIdx: number;
}

export interface SlicerVoiceData {
  slice_enabled?: boolean;
  slice_max_length?: number;
  slice_roll_amount?: number;
  slice_vary_length?: boolean;
  voice_number: number;
}

type SliceSteps = (null | SliceStep)[][];

interface UseSlicerEditorParams {
  focusedStep: FocusedStep;
  isSeqPlaying: boolean;
  kitName: string;
  onPlaySample: (
    voice: number,
    slot: number,
    volume?: number,
    options?: PlayOptions,
  ) => void;
  samples: { [voice: number]: string[] };
  selectedSampleIdx?: number;
  selectedVoice?: number;
  setFocusedStep: (step: FocusedStep) => void;
  setSliceSteps: (
    update: ((prev: SliceSteps) => SliceSteps) | SliceSteps,
    meta?: SequenceEditMeta,
  ) => Promise<void> | void;
  slicerDivision: SlicerDivision;
  sliceSettings: Record<number, VoiceSliceSettings>;
  sliceSteps: SliceSteps;
  stepPattern: number[][];
  toggleStep: (voiceIdx: number, stepIdx: number) => void;
  updateSliceSettings: (
    voiceNumber: number,
    update: Partial<VoiceSliceSettings>,
  ) => void;
  voiceVolumes: Record<number, number>;
}

/** Index of the slot the slice strip shows for a voice, or null if empty. */
export function displayedSlotIndex(
  voiceSamples: string[] | undefined,
  voiceNumber: number,
  selectedVoice?: number,
  selectedSampleIdx?: number,
): null | number {
  if (!voiceSamples?.length) return null;
  if (
    selectedVoice === voiceNumber &&
    selectedSampleIdx != null &&
    voiceSamples[selectedSampleIdx]
  ) {
    return selectedSampleIdx;
  }
  const first = voiceSamples.findIndex(Boolean);
  return first === -1 ? null : first;
}

/**
 * What to tell the user when a voice's slicer setting isn't saved; `saved`
 * is the setting now back on screen (#511).
 */
export function sliceSettingNotSaved(
  voiceNumber: number,
  saved: Partial<VoiceSliceSettings>,
): string {
  const fields = Object.keys(saved);
  if (fields.length === 1) {
    if (saved.enabled != null) {
      return `Couldn't turn slicing ${saved.enabled ? "off" : "on"} for voice ${voiceNumber}. Try again.`;
    }
    if (saved.rollAmount != null) {
      return `Couldn't save the roll amount for voice ${voiceNumber}, so it's back to ${saved.rollAmount}%. Try again.`;
    }
    if (saved.varyLength != null) {
      return `Couldn't turn Vary length ${saved.varyLength ? "off" : "on"} for voice ${voiceNumber}. Try again.`;
    }
    if (saved.maxLength != null) {
      return `Couldn't save the longest random length for voice ${voiceNumber}, so it's back to ${saved.maxLength}. Try again.`;
    }
  }
  return `Couldn't save the slicer settings for voice ${voiceNumber}. Try again.`;
}

/**
 * State and actions for the sequencer slicer: which voice the slice strip
 * edits, the selected step, per-voice slicer settings, slice edits, rolls
 * (undone through the kit's undo stack), and slicer keyboard shortcuts.
 */
export function useSlicerEditor(params: UseSlicerEditorParams) {
  const {
    focusedStep,
    isSeqPlaying,
    kitName,
    onPlaySample,
    samples,
    selectedSampleIdx,
    selectedVoice,
    setFocusedStep,
    setSliceSteps,
    slicerDivision,
    sliceSettings,
    sliceSteps,
    stepPattern,
    toggleStep,
    updateSliceSettings,
    voiceVolumes,
  } = params;

  const [chosenVoice, setChosenVoice] = React.useState<null | number>(null);
  // Whether the slice strip is showing. Separate from slice mode: closing
  // the editor leaves every sliced voice playing its slices.
  const [editorOpen, setEditorOpen] = React.useState(true);
  const [selection, setSelection] = React.useState<FocusedStep | null>(null);
  const [hoverStep, setHoverStep] = React.useState<FocusedStep | null>(null);
  const [playingSlice, setPlayingSlice] = React.useState<null | PlayingSlice>(
    null,
  );
  const [rolledSteps, setRolledSteps] = React.useState<null | RolledSteps>(
    null,
  );
  const [notice, setNotice] = React.useState<null | string>(null);

  // Forget selection, undo and flashes when switching kits
  const [editorKit, setEditorKit] = React.useState(kitName);
  if (editorKit !== kitName) {
    setEditorKit(kitName);
    setChosenVoice(null);
    setEditorOpen(true);
    setSelection(null);
    setRolledSteps(null);
    setPlayingSlice(null);
    setNotice(null);
  }

  // Stopping clears the playing slice's flash
  const [wasPlaying, setWasPlaying] = React.useState(isSeqPlaying);
  if (wasPlaying !== isSeqPlaying) {
    setWasPlaying(isSeqPlaying);
    if (!isSeqPlaying) setPlayingSlice(null);
  }

  const sliceVoices = React.useMemo(
    () =>
      Object.entries(sliceSettings)
        .filter(([, s]) => s.enabled)
        .map(([v]) => Number(v))
        .sort((a, b) => a - b),
    [sliceSettings],
  );

  // The voice the slice strip edits: the last one used, else the first sliced
  const editingVoice =
    chosenVoice != null && sliceSettings[chosenVoice]?.enabled
      ? chosenVoice
      : (sliceVoices[0] ?? null);

  const isSliceVoice = React.useCallback(
    (voiceNumber: number) => sliceSettings[voiceNumber]?.enabled ?? false,
    [sliceSettings],
  );

  // Keyboard focus on a slice row selects that step
  const [prevFocus, setPrevFocus] = React.useState(focusedStep);
  if (prevFocus !== focusedStep) {
    setPrevFocus(focusedStep);
    const voiceNumber = focusedStep.voice + 1;
    if (isSliceVoice(voiceNumber)) {
      setSelection(focusedStep);
      setChosenVoice(voiceNumber);
    }
  }

  const selectedStep =
    selection && editingVoice != null && selection.voice === editingVoice - 1
      ? selection.step
      : null;

  const handleSliceToggle = React.useCallback(
    (voiceNumber: number) => {
      const enabled = !isSliceVoice(voiceNumber);
      updateSliceSettings(voiceNumber, { enabled });
      if (enabled) {
        setChosenVoice(voiceNumber);
        setEditorOpen(true);
        setNotice(null);
      }
    },
    [isSliceVoice, updateSliceSettings],
  );

  /** Apply an edit to one step's slice (materialising its default first). */
  const updateSliceStep = React.useCallback(
    (
      voiceIdx: number,
      stepIdx: number,
      edit: (step: SliceStep) => SliceStep,
      meta?: SequenceEditMeta,
    ) => {
      void setSliceSteps(
        (prev) =>
          replaceRow(
            prev,
            voiceIdx,
            prev[voiceIdx].map((cell, s) =>
              s === stepIdx
                ? edit(cell ?? sequentialSliceStep(stepIdx, slicerDivision))
                : cell,
            ),
          ),
        {
          description: `Edit the slice on step ${stepIdx + 1} of voice ${voiceIdx + 1}`,
          mergeKey: `slice:${voiceIdx}:${stepIdx}`,
          ...meta,
        },
      );
    },
    [setSliceSteps, slicerDivision],
  );

  /** Slice rows: click selects an active step; clicking it again turns it off. */
  const handleStepClick = React.useCallback(
    (voiceIdx: number, stepIdx: number) => {
      const voiceNumber = voiceIdx + 1;
      const wasSelected =
        selection?.voice === voiceIdx && selection?.step === stepIdx;
      setFocusedStep({ step: stepIdx, voice: voiceIdx });
      if (!isSliceVoice(voiceNumber)) {
        toggleStep(voiceIdx, stepIdx);
        return;
      }
      setChosenVoice(voiceNumber);
      setEditorOpen(true);
      setSelection({ step: stepIdx, voice: voiceIdx });
      const isOn = (stepPattern[voiceIdx]?.[stepIdx] ?? 0) > 0;
      if (!isOn || wasSelected) {
        toggleStep(voiceIdx, stepIdx);
      }
    },
    [isSliceVoice, selection, setFocusedStep, stepPattern, toggleStep],
  );

  const handleStepWheel = React.useCallback(
    (voiceIdx: number, stepIdx: number, delta: number, length: boolean) => {
      if (!isSliceVoice(voiceIdx + 1)) return;
      if ((stepPattern[voiceIdx]?.[stepIdx] ?? 0) === 0) return;
      updateSliceStep(voiceIdx, stepIdx, (step) =>
        length
          ? nudgeLengthSlices(step, delta, slicerDivision)
          : nudgeStartSlice(step, delta, slicerDivision),
      );
    },
    [isSliceVoice, slicerDivision, stepPattern, updateSliceStep],
  );

  const handleSliceTriggered = React.useCallback(
    (voiceNumber: number, view: SliceView) => {
      setPlayingSlice((prev) => ({
        id: (prev?.id ?? 0) + 1,
        view,
        voiceNumber,
      }));
    },
    [],
  );

  // The sample the strip shows for the editing voice
  const displayedSlot =
    editingVoice == null
      ? null
      : displayedSlotIndex(
          samples[editingVoice],
          editingVoice,
          selectedVoice,
          selectedSampleIdx,
        );
  const displayedSample =
    editingVoice != null && displayedSlot != null
      ? samples[editingVoice][displayedSlot]
      : null;

  const auditionSlice = React.useCallback(
    (startSlice: number, lengthSlices: number) => {
      if (
        isSeqPlaying ||
        editingVoice == null ||
        displayedSlot == null ||
        !displayedSample
      )
        return;
      onPlaySample(
        editingVoice,
        displayedSlot,
        voiceVolumes[editingVoice] ?? 100,
        { region: sliceRegion({ lengthSlices, startSlice }, slicerDivision) },
      );
    },
    [
      displayedSample,
      displayedSlot,
      editingVoice,
      isSeqPlaying,
      onPlaySample,
      slicerDivision,
      voiceVolumes,
    ],
  );

  /** Point the selected step at a slice span (turning the step on if needed). */
  const assignSlice = React.useCallback(
    (startSlice: number, lengthSlices: number) => {
      auditionSlice(startSlice, lengthSlices);
      if (editingVoice == null || selectedStep == null) return;
      const voiceIdx = editingVoice - 1;
      // Same merge key as toggleStep: assigning to an off step turns it on,
      // and both undo together
      updateSliceStep(
        voiceIdx,
        selectedStep,
        (step) =>
          makeSliceStep(startSlice, lengthSlices, slicerDivision, {
            locked: step.locked,
          }),
        { mergeKey: `step:${voiceIdx}:${selectedStep}` },
      );
      if ((stepPattern[voiceIdx]?.[selectedStep] ?? 0) === 0) {
        toggleStep(voiceIdx, selectedStep);
      }
    },
    [
      auditionSlice,
      editingVoice,
      selectedStep,
      slicerDivision,
      stepPattern,
      toggleStep,
      updateSliceStep,
    ],
  );

  const roll = React.useCallback(
    (voiceNumber: number) => {
      const voiceIdx = voiceNumber - 1;
      const settings = sliceSettings[voiceNumber];
      const row = sliceSteps[voiceIdx];
      if (!settings || !row) return;
      const active = (stepPattern[voiceIdx] ?? []).map((v) => v > 0);
      const result = rollSliceRow(row, active, {
        amount: settings.rollAmount,
        division: slicerDivision,
        maxLength: settings.maxLength,
        varyLength: settings.varyLength,
      });
      if (result.rolled.length === 0) {
        setNotice(
          "Nothing to roll: turn on some steps, or unlock them, in this row.",
        );
        return;
      }
      setNotice(null);
      setRolledSteps((prev) => ({
        id: (prev?.id ?? 0) + 1,
        steps: result.rolled,
        voiceIdx,
      }));
      void setSliceSteps((prev) => replaceRow(prev, voiceIdx, result.row), {
        description: `Roll slices on voice ${voiceNumber}`,
      });
    },
    [setSliceSteps, sliceSettings, slicerDivision, sliceSteps, stepPattern],
  );

  // Clear the rolled-step flash shortly after it appears
  React.useEffect(() => {
    if (!rolledSteps) return;
    const timer = setTimeout(() => setRolledSteps(null), 600);
    return () => clearTimeout(timer);
  }, [rolledSteps]);

  /** Slicer keyboard shortcuts on the focused step; true when handled. */
  const handleGridKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, focus: FocusedStep): boolean => {
      const voiceNumber = focus.voice + 1;
      if (e.metaKey || e.ctrlKey || e.altKey) return false;
      // Escape closes the slicer first; the next Escape leaves the kit
      if (e.key === "Escape") {
        if (!editorOpen || sliceVoices.length === 0) return false;
        setEditorOpen(false);
        setSelection(null);
        e.stopPropagation();
        return true;
      }
      if (!isSliceVoice(voiceNumber)) return false;

      const { step, voice } = focus;
      const isOn = (stepPattern[voice]?.[step] ?? 0) > 0;
      switch (e.key) {
        case "[":
        case "]":
          if (isOn) {
            updateSliceStep(voice, step, (s) =>
              nudgeStartSlice(s, e.key === "]" ? 1 : -1, slicerDivision),
            );
          }
          return true;
        case "{":
        case "}":
          if (isOn) {
            updateSliceStep(voice, step, (s) =>
              nudgeLengthSlices(s, e.key === "}" ? 1 : -1, slicerDivision),
            );
          }
          return true;
        case "d":
        case "D":
          roll(voiceNumber);
          return true;
        case "l":
        case "L":
          updateSliceStep(voice, step, (s) => ({ ...s, locked: !s.locked }), {
            description: `Lock or unlock step ${step + 1} of voice ${voiceNumber}`,
            mergeKey: undefined,
          });
          return true;
        case "r":
        case "R":
          updateSliceStep(voice, step, (s) => ({ ...s, random: !s.random }), {
            description: `Toggle random slice on step ${step + 1} of voice ${voiceNumber}`,
            mergeKey: undefined,
          });
          return true;
        default:
          return false;
      }
    },
    [
      editorOpen,
      isSliceVoice,
      roll,
      slicerDivision,
      sliceVoices.length,
      stepPattern,
      updateSliceStep,
    ],
  );

  /** Slice views of every step, with defaults filled in, for display. */
  const sliceViews = React.useMemo(
    () =>
      sliceSteps.map((row) =>
        row.map((cell, s) =>
          toSliceView(
            cell ?? sequentialSliceStep(s, slicerDivision),
            slicerDivision,
          ),
        ),
      ),
    [sliceSteps, slicerDivision],
  );

  const closeEditor = React.useCallback(() => {
    setEditorOpen(false);
    setSelection(null);
  }, []);

  return {
    assignSlice,
    auditionSlice,
    closeEditor,
    displayedSample,
    displayedSlot,
    editingVoice,
    editorOpen,
    handleGridKeyDown,
    handleSliceSettingsChange: updateSliceSettings,
    handleSliceToggle,
    handleSliceTriggered,
    handleStepClick,
    handleStepWheel,
    hoverStep,
    notice,
    playingSlice,
    roll,
    rolledSteps,
    selectedStep,
    selection,
    setEditingVoice: setChosenVoice,
    setHoverStep,
    sliceViews,
    sliceVoices,
    updateSliceStep,
  };
}

/**
 * Per-voice slicer settings, initialised from voice data like volume and
 * sample mode, and persisted over IPC when changed. A change that isn't
 * saved goes back and says so (#511).
 */
export function useVoiceSliceSettings(
  kitName: string,
  voices: SlicerVoiceData[] | undefined,
  onVoiceSettingChanged?: (edited?: KitEdit) => void,
  onMessage?: (text: string, type?: string, duration?: number) => void,
) {
  const [sliceSettings, setSliceSettings] = React.useState(() =>
    withVoiceSettings(defaultSettingsRecord(), voices),
  );
  // The settings on screen, so each change knows what it replaces
  const latestRef = useLatestRef(sliceSettings);
  const kitRef = useLatestRef(kitName);

  // Keyed by voice and the fields changed, so a toggle and a roll amount
  // change on the same voice don't decide each other's outcome
  const { reset, save } = useSettingSave<
    string,
    Partial<VoiceSliceSettings>,
    KitEdit
  >();

  // Show the loaded voices' settings whenever the kit's voices load
  const [shownVoices, setShownVoices] = React.useState(voices);
  if (shownVoices !== voices) {
    setShownVoices(voices);
    if (voices?.length) {
      setSliceSettings((prev) => withVoiceSettings(prev, voices));
    }
  }
  React.useEffect(() => {
    if (voices?.length) reset();
  }, [voices, reset]);

  const updateSliceSettings = React.useCallback(
    (voiceNumber: number, update: Partial<VoiceSliceSettings>) => {
      const apply = (change: Partial<VoiceSliceSettings>) =>
        setSliceSettings((prev) => ({
          ...prev,
          [voiceNumber]: { ...prev[voiceNumber], ...change },
        }));
      const fields = Object.keys(update) as (keyof VoiceSliceSettings)[];
      const before = latestRef.current[voiceNumber];
      const current: Partial<VoiceSliceSettings> = {};
      for (const field of fields) {
        (current as Record<string, unknown>)[field] = before?.[field];
      }
      apply(update);

      void save({
        current,
        key: `${voiceNumber}:${[...fields].sort((a, b) => a.localeCompare(b)).join(",")}`,
        onSaved: (edited) => onVoiceSettingChanged?.(edited),
        report: (saved) =>
          onMessage?.(sliceSettingNotSaved(voiceNumber, saved), "error"),
        restore: (saved) => {
          // The kit changed while this was saving; its settings are on screen
          if (kitRef.current === kitName) apply(saved);
        },
        send: () =>
          globalThis.electronAPI?.updateVoiceSliceSettings?.(
            kitName,
            voiceNumber,
            update,
          ),
        value: update,
        what: `the slicer settings for voice ${voiceNumber}`,
      });
    },
    [kitName, kitRef, latestRef, onMessage, onVoiceSettingChanged, save],
  );

  return { sliceSettings, updateSliceSettings };
}

function defaultSettingsRecord(): Record<number, VoiceSliceSettings> {
  const record: Record<number, VoiceSliceSettings> = {};
  for (let v = 1; v <= NUM_VOICES; v++) {
    record[v] = { ...DEFAULT_VOICE_SLICE_SETTINGS };
  }
  return record;
}

function replaceRow(
  grid: SliceSteps,
  voiceIdx: number,
  row: (null | SliceStep)[],
): SliceSteps {
  return grid.map((r, v) => (v === voiceIdx ? row : r));
}

function settingsFromVoice(voice: SlicerVoiceData): VoiceSliceSettings {
  return {
    enabled: voice.slice_enabled ?? DEFAULT_VOICE_SLICE_SETTINGS.enabled,
    maxLength: voice.slice_max_length ?? DEFAULT_VOICE_SLICE_SETTINGS.maxLength,
    rollAmount:
      voice.slice_roll_amount ?? DEFAULT_VOICE_SLICE_SETTINGS.rollAmount,
    varyLength:
      voice.slice_vary_length ?? DEFAULT_VOICE_SLICE_SETTINGS.varyLength,
  };
}

/** `settings` with each loaded voice's own settings in place of its entry */
function withVoiceSettings(
  settings: Record<number, VoiceSliceSettings>,
  voices: SlicerVoiceData[] | undefined,
): Record<number, VoiceSliceSettings> {
  if (!voices?.length) return settings;
  const next = { ...settings };
  for (const voice of voices) {
    next[voice.voice_number] = settingsFromVoice(voice);
  }
  return next;
}

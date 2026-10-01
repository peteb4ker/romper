import type { SliceStep } from "@romper/shared/sliceTypes";

import {
  DiceFiveIcon,
  LockSimpleIcon,
  ScissorsIcon,
} from "@phosphor-icons/react";
import React from "react";
import ReactDOM from "react-dom";

import type { RolledSteps } from "./hooks/kit-management/useSlicerEditor";
import type { StereoLinks } from "./KitStepSequencer";

import ConditionPips from "./ConditionPips";
import { sequentialSliceStep } from "./hooks/shared/sliceConstants";
import {
  describeCondition,
  type FocusedStep,
  SAMPLE_MODE_LABELS,
  type SampleMode,
  TRIGGER_CONDITIONS,
  type TriggerCondition,
} from "./hooks/shared/stepPatternConstants";
import { usePopoverDismiss } from "./hooks/shared/usePopoverDismiss";
import {
  LABEL_GAP,
  LABEL_WIDTH,
  MUTE_GAP,
  MUTE_WIDTH,
  PAD_GAP,
  ROW_GAP,
  stepOffset,
} from "./sequencerLayout";
import SliceStepEditor from "./SliceStepEditor";

const SAMPLE_MODES: SampleMode[] = ["first", "random", "round-robin"];

const SAMPLE_MODE_TITLES: Record<SampleMode, string> = {
  first: "Always play the voice's first sample",
  random: "Play a random sample from the voice each time",
  "round-robin": "Play the voice's samples in turn",
};

/** From the grid's left edge to the first pad. */
const PADS_OFFSET = LABEL_WIDTH + LABEL_GAP + MUTE_WIDTH + MUTE_GAP;
/** Space between the last pad and the row's settings. */
const SETTINGS_GAP = 20;

const SLICE_COLUMN_WIDTH = 30;
const MODE_COLUMN_WIDTH = 102;
const LEVEL_COLUMN_WIDTH = 112;

const headerClass =
  "text-[10px] font-semibold uppercase tracking-wide text-text-tertiary";

/** What a step on a slice-mode row shows. */
export interface StepSliceDisplay {
  flash: boolean; // just changed by a roll
  lengthSlices: number;
  locked: boolean;
  random: boolean;
  startSlice: number;
}

interface StepButtonProps {
  condition: TriggerCondition;
  isFiring: boolean;
  isFocused: boolean;
  isOn: boolean;
  isPlayhead: boolean;
  ledGlow: string;
  onClick: () => void;
  onColor: string;
  onContextMenu: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  slice?: StepSliceDisplay;
  stepIdx: number;
  voiceIdx: number;
  voiceNumber: number;
}

/** Off pads alternate shade by beat, like the TR-808's step groups. */
function offPadClass(stepIdx: number): string {
  return Math.floor(stepIdx / 4) % 2 === 0
    ? "bg-surface-3 border-border-default"
    : "bg-surface-4 border-border-default";
}

function sliceAriaSuffix(slice?: StepSliceDisplay): string {
  if (!slice) return "";
  const parts: string[] = [];
  if (slice.random) {
    parts.push("random slice");
  } else {
    parts.push(`slice ${slice.startSlice + 1}`);
    if (slice.lengthSlices > 1) {
      parts.push(`${slice.lengthSlices} slices long`);
    }
  }
  if (slice.locked) parts.push("locked");
  return `, ${parts.join(", ")}`;
}

function sliceToggleTitle(enabled: boolean, unavailable: boolean): string {
  if (enabled) {
    return "Slice mode on: each step plays a slice of the sample. Click to play whole samples again.";
  }
  if (unavailable) return "Add a sample to this voice to slice it";
  return "Slice mode: play parts of a long sample from each step";
}

/** Slice number (or dice), length bar and lock mark on a lit pad. */
const StepSliceContent: React.FC<{
  slice: StepSliceDisplay;
  stepIdx: number;
  voiceIdx: number;
}> = ({ slice, stepIdx, voiceIdx }) => (
  <span
    className="absolute inset-0 pointer-events-none select-none"
    data-testid={`seq-slice-${voiceIdx}-${stepIdx}`}
    style={{ zIndex: 1 }}
  >
    <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums">
      {slice.random ? (
        <DiceFiveIcon size={16} weight="bold" />
      ) : (
        slice.startSlice + 1
      )}
    </span>
    {slice.lengthSlices > 1 && !slice.random && (
      <span
        className="absolute bottom-1 left-1 h-[3px] rounded bg-current opacity-80"
        style={{
          // A quarter of the pad per slice of length, full at 4+
          width: `calc(${Math.min(1, slice.lengthSlices / 4) * 100}% - 8px)`,
        }}
      />
    )}
    {slice.locked && (
      <LockSimpleIcon
        className="absolute top-1 right-1"
        size={9}
        weight="fill"
      />
    )}
  </span>
);

const StepButton: React.FC<StepButtonProps> = ({
  condition,
  isFiring,
  isFocused,
  isOn,
  isPlayhead,
  ledGlow,
  onClick,
  onColor,
  onContextMenu,
  onMouseEnter,
  slice,
  stepIdx,
  voiceIdx,
  voiceNumber,
}) => {
  const conditionSuffix = condition ? ` (${condition})` : "";
  const showSlice = slice && isOn;

  return (
    <button
      aria-label={`Toggle step ${stepIdx + 1} for voice ${voiceNumber}${conditionSuffix}${isOn ? sliceAriaSuffix(slice) : ""}`}
      aria-pressed={isOn}
      className={`relative shrink-0 rounded-md border-2 focus:outline-none transition-colors ${onColor} ${ledGlow}${slice?.flash ? " ring-2 ring-white" : ""}${isFiring ? " motion-safe:animate-seq-fire" : ""}`}
      data-firing={isFiring || undefined}
      data-playhead={isPlayhead || undefined}
      data-slice-step={slice ? `${voiceIdx}:${stepIdx}` : undefined}
      data-testid={`seq-step-${voiceIdx}-${stepIdx}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      role="gridcell"
      style={{
        color: isOn ? `var(--voice-${voiceNumber}-ink)` : undefined,
        height: "var(--seq-pad-h)",
        width: "var(--seq-pad)",
      }}
      type="button"
    >
      {showSlice && (
        <StepSliceContent slice={slice} stepIdx={stepIdx} voiceIdx={voiceIdx} />
      )}
      {/* Trigger condition: dots, top-left when lit, centered when off */}
      {condition && (
        <span
          className={`absolute pointer-events-none select-none flex ${isOn ? "top-1 left-1 opacity-90" : "inset-0 items-center justify-center text-text-tertiary"}`}
          style={{ zIndex: 1 }}
        >
          <ConditionPips
            condition={condition}
            data-testid={`seq-condition-${voiceIdx}-${stepIdx}`}
          />
        </span>
      )}
      {isFocused && (
        <span
          className="absolute -inset-[3px] rounded-lg pointer-events-none"
          data-testid="seq-step-focus-ring"
          style={{
            boxShadow: "0 0 0 2px var(--focus-ring)",
            zIndex: 2,
          }}
        />
      )}
    </button>
  );
};

// Step options popover (right-click)
interface ConditionPopoverProps {
  currentCondition: TriggerCondition;
  onClose: () => void;
  onSelect: (condition: TriggerCondition) => void;
  position: { x: number; y: number };
  sliceSection?: React.ReactNode;
}

const ConditionPopover: React.FC<ConditionPopoverProps> = ({
  currentCondition,
  onClose,
  onSelect,
  position,
  sliceSection,
}) => {
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = React.useState(position);

  usePopoverDismiss(popoverRef, onClose);

  // Take focus so Escape and typing go to the popover, not the grid behind
  React.useEffect(() => {
    popoverRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.focus();
  }, []);

  React.useEffect(() => {
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let { x, y } = position;
    if (rect.bottom > window.innerHeight - margin) {
      y = window.innerHeight - rect.height - margin;
    }
    if (rect.right > window.innerWidth - margin) {
      x = window.innerWidth - rect.width - margin;
    }
    if (x !== position.x || y !== position.y) {
      setAdjustedPos({ x, y });
    }
  }, [position]);

  return (
    <div
      aria-label="Step options"
      className="fixed z-50 bg-surface-2 border border-border-strong rounded-lg shadow-lg py-1 min-w-[220px]"
      data-testid="condition-popover"
      // Keep typing in the popover from reaching the grid's shortcuts
      // (portals still bubble React events); Escape must reach the dismiss hook.
      onKeyDown={(e) => {
        if (e.key !== "Escape") e.stopPropagation();
      }}
      ref={popoverRef}
      role="dialog"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {sliceSection && (
        <div className="border-b border-border-subtle mb-1">{sliceSection}</div>
      )}
      <div className={`px-3 pt-1 pb-1 ${headerClass}`}>Plays</div>
      {TRIGGER_CONDITIONS.map((cond) => {
        const isActive = cond === currentCondition;
        return (
          <button
            className={`flex w-full items-center gap-2.5 text-left px-3 py-1 text-xs hover:bg-surface-3 focus:outline-none focus-visible:bg-surface-3 transition-colors ${isActive ? "text-accent-primary font-semibold" : "text-text-primary"}`}
            data-active={isActive || undefined}
            data-testid={`condition-option-${cond ?? "always"}`}
            key={cond ?? "always"}
            onClick={() => {
              onSelect(cond);
              onClose();
            }}
            type="button"
          >
            <span className="w-7 shrink-0 flex justify-start">
              {cond ? (
                <ConditionPips condition={cond} />
              ) : (
                <span className="text-[10px] font-semibold">All</span>
              )}
            </span>
            <span className="flex-1">{describeCondition(cond)}</span>
            {cond && (
              <span className="font-mono text-[10px] text-text-tertiary">
                {cond}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/** The step ruler: numbers, beat starts emphasised, and the running light. */
const StepRuler: React.FC<{ isSeqPlaying: boolean; playheadStep: number }> = ({
  isSeqPlaying,
  playheadStep,
}) => (
  <div
    aria-hidden
    className="flex items-end"
    data-testid="seq-step-ruler"
    style={{ gap: PAD_GAP, marginLeft: PADS_OFFSET }}
  >
    {Array.from({ length: 16 }, (_, step) => {
      const lit = isSeqPlaying && step === playheadStep;
      return (
        <span
          className="flex flex-col items-center gap-0.5 shrink-0"
          key={step}
          style={{ width: "var(--seq-pad)" }}
        >
          <span
            className={`text-[10px] leading-none tabular-nums ${step % 4 === 0 ? "font-bold text-text-secondary" : "text-text-tertiary"}`}
          >
            {step + 1}
          </span>
          <span
            className={`block h-[3px] w-1/2 rounded-full ${lit ? "bg-transport-play" : "bg-border-subtle"}`}
            data-lit={lit || undefined}
            data-testid={`seq-ruler-led-${step}`}
          />
        </span>
      );
    })}
  </div>
);

interface StepSequencerGridProps {
  currentSeqStep: number;
  /** Rows that fire on the current step (they flash). */
  firingVoices?: boolean[];
  focusedStep: FocusedStep;
  gridRef: React.RefObject<HTMLDivElement | null>;
  handleStepGridKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  isSeqPlaying: boolean;
  LED_GLOWS: string[];
  NUM_STEPS: number;
  NUM_VOICES: number;
  onConditionChange?: (
    voiceIdx: number,
    stepIdx: number,
    condition: TriggerCondition,
  ) => void;
  onMuteToggle?: (voiceNumber: number) => void;
  onSampleModeChange?: (voiceNumber: number, mode: SampleMode) => void;
  onSliceStepUpdate?: (
    voiceIdx: number,
    stepIdx: number,
    edit: (step: SliceStep) => SliceStep,
  ) => void;
  onSliceToggle?: (voiceNumber: number) => void;
  /** Replaces the default click (toggle) — used for slice-row selection. */
  onStepClick?: (voiceIdx: number, stepIdx: number) => void;
  onStepHover?: (step: FocusedStep | null) => void;
  onStepWheel?: (
    voiceIdx: number,
    stepIdx: number,
    delta: number,
    length: boolean,
  ) => void;
  onVolumeChange?: (voiceNumber: number, volume: number) => void;
  rolledSteps?: null | RolledSteps;
  ROW_COLORS: string[];
  safeStepPattern: number[][];
  sampleModes?: Record<number, SampleMode>;
  setFocusedStep: (step: FocusedStep) => void;
  /** Voices (by number) in slice mode. */
  sliceEnabled?: Record<number, boolean>;
  slicerDivision?: number;
  sliceSteps?: (null | SliceStep)[][];
  /** Voices (by number) that can't be sliced (no samples). */
  sliceUnavailable?: Record<number, boolean>;
  sliceViews?: { lengthSlices: number; startSlice: number }[][];
  stereoLinks?: StereoLinks;
  toggleStep: (voiceIdx: number, stepIdx: number) => void;
  triggerConditions?: (null | string)[][];
  voiceMutes?: Record<number, boolean>;
  voiceVolumes?: Record<number, number>;
}

const StepSequencerGrid: React.FC<StepSequencerGridProps> = ({
  currentSeqStep,
  firingVoices = [],
  focusedStep,
  gridRef,
  handleStepGridKeyDown,
  isSeqPlaying,
  LED_GLOWS,
  NUM_STEPS: _NUM_STEPS,
  NUM_VOICES,
  onConditionChange,
  onMuteToggle,
  onSampleModeChange,
  onSliceStepUpdate,
  onSliceToggle,
  onStepClick,
  onStepHover,
  onStepWheel,
  onVolumeChange,
  rolledSteps,
  ROW_COLORS,
  safeStepPattern,
  sampleModes = {},
  setFocusedStep,
  sliceEnabled = {},
  slicerDivision = 16,
  sliceSteps,
  sliceUnavailable = {},
  sliceViews,
  stereoLinks,
  toggleStep,
  triggerConditions,
  voiceMutes = {},
  voiceVolumes = {},
}) => {
  const [popover, setPopover] = React.useState<{
    stepIdx: number;
    voiceIdx: number;
    x: number;
    y: number;
  } | null>(null);
  // The focus ring shows only while the grid has keyboard focus
  const [hasFocus, setHasFocus] = React.useState(false);

  const handleStepClick = (voiceIdx: number, stepIdx: number) => {
    if (onStepClick) {
      onStepClick(voiceIdx, stepIdx);
      return;
    }
    setFocusedStep({ step: stepIdx, voice: voiceIdx });
    toggleStep(voiceIdx, stepIdx);
  };

  // Scroll wheel over a slice step nudges its slice (Shift: its length).
  // A native non-passive listener so the page doesn't scroll meanwhile.
  React.useEffect(() => {
    const el = gridRef.current;
    if (!el || !onStepWheel) return;
    const onWheel = (e: WheelEvent) => {
      const target = (e.target as HTMLElement | null)?.closest?.(
        "[data-slice-step]",
      ) as HTMLElement | null | undefined;
      const id = target?.dataset.sliceStep;
      if (!id) return;
      const delta = e.deltaY || e.deltaX;
      if (!delta) return;
      e.preventDefault();
      const [voiceIdx, stepIdx] = id.split(":").map(Number);
      onStepWheel(voiceIdx, stepIdx, delta < 0 ? 1 : -1, e.shiftKey);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gridRef, onStepWheel]);

  const stepSlice = (
    voiceIdx: number,
    stepIdx: number,
  ): StepSliceDisplay | undefined => {
    if (!sliceEnabled[voiceIdx + 1]) return undefined;
    const view = sliceViews?.[voiceIdx]?.[stepIdx];
    if (!view) return undefined;
    const cell = sliceSteps?.[voiceIdx]?.[stepIdx];
    return {
      flash:
        rolledSteps?.voiceIdx === voiceIdx &&
        rolledSteps.steps.includes(stepIdx),
      lengthSlices: view.lengthSlices,
      locked: cell?.locked ?? false,
      random: cell?.random ?? false,
      startSlice: view.startSlice,
    };
  };

  const handleStepContextMenu = (
    e: React.MouseEvent,
    voiceIdx: number,
    stepIdx: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    // The step being edited becomes the selected step, so the slice strip
    // and the popover always talk about the same step
    setFocusedStep({ step: stepIdx, voice: voiceIdx });
    setPopover({ stepIdx, voiceIdx, x: e.clientX, y: e.clientY });
  };

  const closePopover = React.useCallback(() => {
    setPopover(null);
    gridRef.current?.focus();
  }, [gridRef]);

  return (
    <div
      aria-label="Step sequencer grid"
      className="relative flex flex-col"
      data-testid="kit-step-sequencer-grid"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setHasFocus(false);
        }
      }}
      onFocus={() => setHasFocus(true)}
      onKeyDown={handleStepGridKeyDown}
      onMouseLeave={() => onStepHover?.(null)}
      ref={gridRef}
      role="grid"
      style={{ gap: ROW_GAP, outline: "none" }}
      tabIndex={0}
    >
      {/* Playhead: a lit column across the ruler and all rows */}
      {isSeqPlaying && (
        <div
          aria-hidden
          className="absolute -top-1 -bottom-1 rounded-md pointer-events-none"
          data-testid="seq-playhead-column"
          style={{
            background: "var(--seq-playhead-band)",
            left: `calc(${PADS_OFFSET - PAD_GAP / 2}px + ${stepOffset(currentSeqStep)})`,
            width: "var(--seq-pitch)",
            zIndex: 3,
          }}
        />
      )}

      {/* Header: step ruler and the row-settings column titles */}
      <div className="flex items-end">
        <StepRuler isSeqPlaying={isSeqPlaying} playheadStep={currentSeqStep} />
        <div
          aria-hidden
          className="flex items-end gap-2.5"
          style={{ marginLeft: SETTINGS_GAP }}
        >
          {onSliceToggle && (
            <span
              className={`${headerClass} text-center`}
              style={{ width: SLICE_COLUMN_WIDTH }}
            >
              Slice
            </span>
          )}
          <span
            className={`${headerClass} text-center`}
            style={{ width: MODE_COLUMN_WIDTH }}
          >
            Sample
          </span>
          <span className={headerClass} style={{ width: LEVEL_COLUMN_WIDTH }}>
            Level
          </span>
        </div>
      </div>

      {Array.from({ length: NUM_VOICES }, (_, index) => index).map(
        (voiceIdx) => {
          const voiceNumber = voiceIdx + 1;
          const isLinkedSecondary =
            stereoLinks?.linkedSecondaries.has(voiceNumber) ?? false;

          const volume = voiceVolumes[voiceNumber] ?? 100;
          const mode = sampleModes[voiceNumber] || "first";
          const isMuted = voiceMutes[voiceNumber] ?? false;
          const voiceLabel =
            stereoLinks?.primaryLabels[voiceNumber] ?? voiceNumber;
          const isFiring = firingVoices[voiceIdx] ?? false;

          return (
            <div
              aria-hidden={isLinkedSecondary || undefined}
              className="flex flex-row items-center overflow-hidden"
              data-testid={
                isLinkedSecondary ? undefined : `seq-row-${voiceIdx}`
              }
              key={`seq-row-voice-${voiceIdx}`}
              role={isLinkedSecondary ? undefined : "row"}
              style={
                isLinkedSecondary
                  ? { height: 0, marginTop: -ROW_GAP, opacity: 0 }
                  : { height: "var(--seq-pad-h)" }
              }
            >
              {/* Voice number chip: lit in the voice color, flashes on a hit */}
              <span
                className="relative flex items-center justify-center h-9 text-sm font-bold rounded-md shrink-0"
                data-testid={`seq-voice-label-${voiceIdx}`}
                style={{
                  background: `var(--voice-${voiceNumber})`,
                  color: `var(--voice-${voiceNumber}-ink)`,
                  marginRight: LABEL_GAP,
                  width: LABEL_WIDTH,
                }}
              >
                {voiceLabel}
                {isFiring && (
                  <span
                    className="absolute inset-0 rounded-md bg-white/35 motion-safe:animate-seq-fire"
                    data-testid={`seq-voice-fire-${voiceIdx}`}
                    // Restart the flash on every step this voice fires
                    key={currentSeqStep}
                  />
                )}
              </span>

              {/* Mute: a performance control, so it sits with the row label */}
              <button
                aria-label={`${isMuted ? "Unmute" : "Mute"} voice ${voiceNumber}`}
                aria-pressed={isMuted}
                className={`flex items-center justify-center h-[30px] rounded-md border text-xs font-bold shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary transition-colors ${isMuted ? "bg-accent-warning border-accent-warning text-[#1a1d23]" : "bg-surface-2 border-border-default text-text-tertiary hover:text-text-primary hover:bg-surface-3"}`}
                data-testid={`voice-mute-${voiceIdx}`}
                onClick={() => onMuteToggle?.(voiceNumber)}
                style={{ marginRight: MUTE_GAP, width: MUTE_WIDTH }}
                title={
                  isMuted
                    ? "Muted for this session. Click to unmute."
                    : "Mute this voice (for this session only)"
                }
                type="button"
              >
                M
              </button>

              {/* Pads */}
              <div
                className={`flex items-center transition-opacity${isMuted && !isLinkedSecondary ? " opacity-35" : ""}`}
                style={{ gap: PAD_GAP }}
              >
                {Array.from({ length: 16 }, (_, stepIdx) => {
                  const isOn = safeStepPattern[voiceIdx][stepIdx] > 0;
                  const isPlayhead = isSeqPlaying && currentSeqStep === stepIdx;
                  const condition = (triggerConditions?.[voiceIdx]?.[stepIdx] ??
                    null) as TriggerCondition;

                  return (
                    <StepButton
                      condition={condition}
                      isFiring={isPlayhead && isFiring}
                      isFocused={
                        hasFocus &&
                        focusedStep.voice === voiceIdx &&
                        focusedStep.step === stepIdx
                      }
                      isOn={isOn}
                      isPlayhead={isPlayhead}
                      key={`seq-step-voice-${voiceIdx}-step-${stepIdx}`}
                      ledGlow={isOn ? LED_GLOWS[voiceIdx] : ""}
                      onClick={() => handleStepClick(voiceIdx, stepIdx)}
                      onColor={
                        isOn ? ROW_COLORS[voiceIdx] : offPadClass(stepIdx)
                      }
                      onContextMenu={(e) =>
                        handleStepContextMenu(e, voiceIdx, stepIdx)
                      }
                      onMouseEnter={
                        onStepHover
                          ? () =>
                              onStepHover({ step: stepIdx, voice: voiceIdx })
                          : undefined
                      }
                      slice={stepSlice(voiceIdx, stepIdx)}
                      stepIdx={stepIdx}
                      voiceIdx={voiceIdx}
                      voiceNumber={voiceNumber}
                    />
                  );
                })}
              </div>

              {/* Saved voice settings */}
              <div
                className="flex items-center gap-2.5"
                style={{ marginLeft: SETTINGS_GAP }}
              >
                {onSliceToggle && (
                  <button
                    aria-label={`Slice mode for voice ${voiceNumber}`}
                    aria-pressed={sliceEnabled[voiceNumber] ?? false}
                    className={`flex items-center justify-center h-[30px] rounded-md border focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sliceEnabled[voiceNumber] ? "bg-surface-3 border-border-strong" : "bg-surface-2 border-border-default text-text-tertiary hover:text-text-primary hover:bg-surface-3"}`}
                    data-testid={`slice-toggle-${voiceIdx}`}
                    disabled={
                      !sliceEnabled[voiceNumber] &&
                      sliceUnavailable[voiceNumber]
                    }
                    onClick={() => onSliceToggle(voiceNumber)}
                    style={{
                      color: sliceEnabled[voiceNumber]
                        ? `var(--voice-${voiceNumber})`
                        : undefined,
                      width: SLICE_COLUMN_WIDTH,
                    }}
                    title={sliceToggleTitle(
                      sliceEnabled[voiceNumber] ?? false,
                      sliceUnavailable[voiceNumber] ?? false,
                    )}
                    type="button"
                  >
                    <ScissorsIcon size={15} weight="bold" />
                  </button>
                )}

                {/* Sample mode: which of the voice's samples each hit plays */}
                <div
                  aria-label={`Sample mode for voice ${voiceNumber}`}
                  className="flex h-[30px] rounded-md border border-border-default bg-surface-2 p-0.5"
                  data-testid={`sample-mode-${voiceIdx}`}
                  role="group"
                  style={{ width: MODE_COLUMN_WIDTH }}
                >
                  {SAMPLE_MODES.map((m) => (
                    <button
                      aria-pressed={m === mode}
                      className={`flex-1 rounded text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary transition-colors ${m === mode ? "bg-surface-4 text-text-primary" : "text-text-tertiary hover:text-text-primary"}`}
                      data-testid={`sample-mode-${voiceIdx}-${m}`}
                      key={m}
                      onClick={() => {
                        if (m !== mode) onSampleModeChange?.(voiceNumber, m);
                      }}
                      title={SAMPLE_MODE_TITLES[m]}
                      type="button"
                    >
                      {SAMPLE_MODE_LABELS[m]}
                    </button>
                  ))}
                </div>

                {/* Level */}
                <label
                  className="flex items-center gap-2"
                  style={{ width: LEVEL_COLUMN_WIDTH }}
                  title={`Volume for voice ${voiceNumber}: ${volume}`}
                >
                  <input
                    aria-label={`Volume for voice ${voiceNumber}`}
                    className="flex-1 min-w-0 h-1 cursor-pointer"
                    data-testid={`voice-volume-${voiceIdx}`}
                    max={100}
                    min={0}
                    onChange={(e) =>
                      onVolumeChange?.(
                        voiceNumber,
                        Number.parseInt(e.target.value, 10),
                      )
                    }
                    style={{ accentColor: `var(--voice-${voiceNumber})` }}
                    type="range"
                    value={volume}
                  />
                  <span className="w-7 text-right text-[11px] tabular-nums text-text-secondary">
                    {volume}
                  </span>
                </label>
              </div>
            </div>
          );
        },
      )}

      {/* Step options popover — portal to body to escape overflow:hidden + transform */}
      {popover &&
        ReactDOM.createPortal(
          <ConditionPopover
            currentCondition={
              (triggerConditions?.[popover.voiceIdx]?.[popover.stepIdx] ??
                null) as TriggerCondition
            }
            onClose={closePopover}
            onSelect={(condition) => {
              onConditionChange?.(popover.voiceIdx, popover.stepIdx, condition);
            }}
            position={{ x: popover.x, y: popover.y }}
            sliceSection={
              sliceEnabled[popover.voiceIdx + 1] && onSliceStepUpdate ? (
                <SliceStepEditor
                  division={slicerDivision}
                  onChange={(edit) =>
                    onSliceStepUpdate(popover.voiceIdx, popover.stepIdx, edit)
                  }
                  step={
                    sliceSteps?.[popover.voiceIdx]?.[popover.stepIdx] ??
                    sequentialSliceStep(popover.stepIdx, slicerDivision)
                  }
                />
              ) : undefined
            }
          />,
          document.body,
        )}
    </div>
  );
};

export default StepSequencerGrid;

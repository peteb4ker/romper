import type { SliceStep } from "@romper/shared/sliceTypes";

import {
  DiceFiveIcon,
  LockSimpleIcon,
  NumberCircleOneIcon,
  RepeatIcon,
  ScissorsIcon,
  ShuffleIcon,
  SpeakerSimpleHighIcon,
  SpeakerSimpleSlashIcon,
} from "@phosphor-icons/react";
import React from "react";
import ReactDOM from "react-dom";

import type { RolledSteps } from "./hooks/kit-management/useSlicerEditor";
import type { StereoLinks } from "./KitStepSequencer";

import { sequentialSliceStep } from "./hooks/shared/sliceConstants";
import {
  type FocusedStep,
  SAMPLE_MODE_LABELS,
  type SampleMode,
  TRIGGER_CONDITIONS,
  type TriggerCondition,
} from "./hooks/shared/stepPatternConstants";
import { usePopoverDismiss } from "./hooks/shared/usePopoverDismiss";
import SliceStepEditor from "./SliceStepEditor";

const SAMPLE_MODE_ICONS: Record<SampleMode, React.ReactNode> = {
  first: <NumberCircleOneIcon size={14} weight="bold" />,
  random: <ShuffleIcon size={14} weight="bold" />,
  "round-robin": <RepeatIcon size={14} weight="bold" />,
};

const SAMPLE_MODE_CYCLE: SampleMode[] = ["first", "random", "round-robin"];

// Voice background colors mapping
const VOICE_BG_COLORS: Record<number, string> = {
  0: "bg-voice-1/40",
  1: "bg-voice-2/40",
  2: "bg-voice-3/40",
  3: "bg-voice-4/40",
};

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

/** Slice number (or dice), length bar, lock mark and condition badge. */
const StepSliceContent: React.FC<{
  condition: TriggerCondition;
  slice: StepSliceDisplay;
  stepIdx: number;
  voiceIdx: number;
}> = ({ condition, slice, stepIdx, voiceIdx }) => (
  <span
    className="absolute inset-0 pointer-events-none select-none text-white/95"
    data-testid={`seq-slice-${voiceIdx}-${stepIdx}`}
    style={{ textShadow: "0 0 3px rgba(0,0,0,0.6)", zIndex: 1 }}
  >
    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">
      {slice.random ? (
        <DiceFiveIcon size={14} weight="bold" />
      ) : (
        slice.startSlice + 1
      )}
    </span>
    {slice.lengthSlices > 1 && !slice.random && (
      <span
        className="absolute bottom-0.5 left-0.5 h-0.5 rounded bg-white/90"
        style={{
          width: `calc(${Math.min(1, slice.lengthSlices / 8) * 100}% - 4px)`,
        }}
      />
    )}
    {slice.locked && (
      <LockSimpleIcon
        className="absolute top-0 right-0"
        size={8}
        weight="fill"
      />
    )}
    {condition && (
      <span
        className="absolute top-0 left-0.5 text-[7px] font-bold leading-none"
        data-testid={`seq-condition-${voiceIdx}-${stepIdx}`}
      >
        {condition}
      </span>
    )}
  </span>
);

const StepButton: React.FC<StepButtonProps> = ({
  condition,
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
  const getBoxShadow = () => {
    if (isPlayhead && isFocused) {
      return "0 0 0 2px #fff, 0 0 0 2.5px var(--color-accent-primary)";
    }
    if (isPlayhead) {
      return "0 0 0 2px #fff";
    }
    if (isFocused) {
      return "0 0 0 2.5px var(--color-accent-primary)";
    }
    return undefined;
  };

  const conditionSuffix = condition ? ` (${condition})` : "";
  const showSlice = slice && isOn;

  return (
    <button
      aria-label={`Toggle step ${stepIdx + 1} for voice ${voiceNumber}${conditionSuffix}${isOn ? sliceAriaSuffix(slice) : ""}`}
      aria-pressed={isOn}
      className={`relative w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 rounded-md border-2 mx-0.5 focus:outline-none transition-colors ${onColor} ${ledGlow}${slice?.flash ? " ring-2 ring-white" : ""}`}
      data-slice-step={slice ? `${voiceIdx}:${stepIdx}` : undefined}
      data-testid={`seq-step-${voiceIdx}-${stepIdx}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      role="gridcell"
      type="button"
    >
      {showSlice && (
        <StepSliceContent
          condition={condition}
          slice={slice}
          stepIdx={stepIdx}
          voiceIdx={voiceIdx}
        />
      )}
      {/* Trigger condition indicator */}
      {condition && isOn && !showSlice && (
        <span
          className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90 pointer-events-none select-none"
          data-testid={`seq-condition-${voiceIdx}-${stepIdx}`}
          style={{ textShadow: "0 0 3px rgba(0,0,0,0.6)", zIndex: 1 }}
        >
          {condition}
        </span>
      )}
      {condition && !isOn && (
        <span
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          data-testid={`seq-condition-${voiceIdx}-${stepIdx}`}
          style={{ zIndex: 1 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary/50" />
        </span>
      )}
      {(isPlayhead || isFocused) && (
        <span
          className="absolute inset-0 rounded-md pointer-events-none"
          data-testid={isFocused ? "seq-step-focus-ring" : undefined}
          style={{
            boxShadow: getBoxShadow(),
            zIndex: 2,
          }}
        />
      )}
    </button>
  );
};

// Condition popover for right-click
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
      className="fixed z-50 bg-surface-2 border border-border-strong rounded-lg shadow-lg py-1 min-w-[80px]"
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
        <>
          {sliceSection}
          <div className="px-3 pt-1 pb-0.5 border-t border-border-subtle text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
            Condition
          </div>
        </>
      )}
      {TRIGGER_CONDITIONS.map((cond) => {
        const isActive =
          cond === currentCondition ||
          (cond === null && currentCondition === null);
        const label = cond ?? "Always";
        return (
          <button
            className={`block w-full text-left px-3 py-1 text-xs hover:bg-surface-3 transition-colors ${isActive ? "text-accent-primary font-bold" : "text-text-primary"}`}
            data-testid={`condition-option-${cond ?? "always"}`}
            key={cond ?? "always"}
            onClick={() => {
              onSelect(cond);
              onClose();
            }}
            type="button"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

interface StepSequencerGridProps {
  currentSeqStep: number;
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

  const cycleSampleMode = (voiceIdx: number) => {
    const voiceNumber = voiceIdx + 1;
    const current = sampleModes[voiceNumber] || "first";
    const currentIndex = SAMPLE_MODE_CYCLE.indexOf(current);
    const nextMode =
      SAMPLE_MODE_CYCLE[(currentIndex + 1) % SAMPLE_MODE_CYCLE.length];
    onSampleModeChange?.(voiceNumber, nextMode);
  };

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
    setPopover({ stepIdx, voiceIdx, x: e.clientX, y: e.clientY });
  };

  // Fixed height: 4 rows * 32px (h-8) + 3 gaps * 8px (gap-2) = 152px
  const GRID_HEIGHT = 152;

  return (
    <div
      aria-label="Step sequencer grid"
      className="flex flex-col gap-2"
      data-testid="kit-step-sequencer-grid"
      onKeyDown={handleStepGridKeyDown}
      onMouseLeave={() => onStepHover?.(null)}
      ref={gridRef}
      role="grid"
      style={{ height: GRID_HEIGHT, outline: "none" }}
      tabIndex={0}
    >
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

          return (
            <div
              aria-hidden={isLinkedSecondary || undefined}
              className={`flex flex-row items-center transition-all duration-300 ease-in-out overflow-hidden${isMuted && !isLinkedSecondary ? " opacity-40" : ""}`}
              data-testid={
                isLinkedSecondary ? undefined : `seq-row-${voiceIdx}`
              }
              key={`seq-row-voice-${voiceIdx}`}
              role={isLinkedSecondary ? undefined : "row"}
              style={
                isLinkedSecondary
                  ? { height: 0, marginTop: -8, opacity: 0 }
                  : { height: 32 }
              }
            >
              {/* Voice label */}
              <span
                className={`flex items-center justify-center w-7 h-7 min-w-7 text-center text-xs font-bold rounded ${VOICE_BG_COLORS[voiceIdx] || "bg-surface-3"} text-text-primary border border-border-strong mr-1.5`}
                data-testid={`seq-voice-label-${voiceIdx}`}
              >
                {voiceLabel}
              </span>

              {/* Step buttons with beat-group dividers every 4 steps */}
              {Array.from({ length: 16 }, (_, stepIdx) => {
                const isOn = safeStepPattern[voiceIdx][stepIdx] > 0;
                const groupIdx = Math.floor(stepIdx / 4);
                const showDivider = stepIdx > 0 && stepIdx % 4 === 0;
                const condition = (triggerConditions?.[voiceIdx]?.[stepIdx] ??
                  null) as TriggerCondition;

                return (
                  <React.Fragment
                    key={`seq-step-voice-${voiceIdx}-step-${stepIdx}`}
                  >
                    {showDivider && (
                      <div
                        className="w-px h-5 bg-text-tertiary/30 mx-0.5 self-center"
                        data-testid={`beat-divider-${voiceIdx}-${groupIdx}`}
                      />
                    )}
                    <StepButton
                      condition={condition}
                      isFocused={
                        focusedStep.voice === voiceIdx &&
                        focusedStep.step === stepIdx
                      }
                      isOn={isOn}
                      isPlayhead={isSeqPlaying && currentSeqStep === stepIdx}
                      ledGlow={isOn ? LED_GLOWS[voiceIdx] : ""}
                      onClick={() => handleStepClick(voiceIdx, stepIdx)}
                      onColor={
                        isOn
                          ? ROW_COLORS[voiceIdx]
                          : "bg-surface-3 border-border-default"
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
                  </React.Fragment>
                );
              })}

              {/* Spacer between steps and voice controls */}
              <div className="w-3" />

              {/* Slice mode toggle */}
              {onSliceToggle && (
                <button
                  aria-label={`Slice mode for voice ${voiceNumber}`}
                  aria-pressed={sliceEnabled[voiceNumber] ?? false}
                  className={`flex items-center justify-center w-7 h-7 rounded border focus:outline-none focus:ring-1 focus:ring-accent-primary transition-colors mr-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${sliceEnabled[voiceNumber] ? "bg-surface-3 border-border-strong" : "bg-surface-2 border-border-default hover:bg-surface-3"}`}
                  data-testid={`slice-toggle-${voiceIdx}`}
                  disabled={
                    !sliceEnabled[voiceNumber] && sliceUnavailable[voiceNumber]
                  }
                  onClick={() => onSliceToggle(voiceNumber)}
                  style={
                    sliceEnabled[voiceNumber]
                      ? { color: `var(--voice-${voiceNumber})` }
                      : undefined
                  }
                  title={sliceToggleTitle(
                    sliceEnabled[voiceNumber] ?? false,
                    sliceUnavailable[voiceNumber] ?? false,
                  )}
                  type="button"
                >
                  <ScissorsIcon size={14} weight="bold" />
                </button>
              )}

              {/* Sample mode toggle */}
              <button
                aria-label={`Sample mode for voice ${voiceNumber}: ${mode}`}
                className="flex items-center justify-center w-7 h-7 rounded border border-border-default bg-surface-2 hover:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-accent-primary transition-colors mr-1.5"
                data-testid={`sample-mode-${voiceIdx}`}
                onClick={() => cycleSampleMode(voiceIdx)}
                title={`Sample mode: ${SAMPLE_MODE_LABELS[mode]}`}
                type="button"
              >
                {SAMPLE_MODE_ICONS[mode]}
              </button>

              {/* Mute toggle + volume slider */}
              <button
                aria-label={`${isMuted ? "Unmute" : "Mute"} voice ${voiceNumber}`}
                className="flex items-center justify-center w-5 h-5 rounded hover:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-accent-primary transition-colors mr-0.5 shrink-0"
                data-testid={`voice-mute-${voiceIdx}`}
                onClick={() => onMuteToggle?.(voiceNumber)}
                title={isMuted ? "Unmute" : "Mute"}
                type="button"
              >
                {isMuted ? (
                  <SpeakerSimpleSlashIcon
                    className="text-amber-500"
                    size={14}
                    weight="bold"
                  />
                ) : (
                  <SpeakerSimpleHighIcon
                    className="text-text-tertiary"
                    size={14}
                  />
                )}
              </button>
              <input
                aria-label={`Volume for voice ${voiceNumber}`}
                className="w-14 h-1 cursor-pointer"
                data-testid={`voice-volume-${voiceIdx}`}
                max={100}
                min={0}
                onChange={(e) =>
                  onVolumeChange?.(
                    voiceNumber,
                    Number.parseInt(e.target.value, 10),
                  )
                }
                style={{ accentColor: "var(--text-tertiary)" }}
                title={`Volume: ${volume}`}
                type="range"
                value={volume}
              />
            </div>
          );
        },
      )}

      {/* Condition popover — portal to body to escape overflow:hidden + transform */}
      {popover &&
        ReactDOM.createPortal(
          <ConditionPopover
            currentCondition={
              (triggerConditions?.[popover.voiceIdx]?.[popover.stepIdx] ??
                null) as TriggerCondition
            }
            onClose={() => setPopover(null)}
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

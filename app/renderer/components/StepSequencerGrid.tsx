import {
  NumberCircleOne,
  Repeat,
  Shuffle,
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
} from "@phosphor-icons/react";
import React from "react";
import ReactDOM from "react-dom";

import type { SampleMode } from "./hooks/shared/stepPatternConstants";
import type { StereoLinks } from "./KitStepSequencer";

import {
  type FocusedStep,
  SAMPLE_MODE_LABELS,
  TRIGGER_CONDITIONS,
  type TriggerCondition,
} from "./hooks/shared/stepPatternConstants";
import { usePopoverDismiss } from "./hooks/shared/usePopoverDismiss";

const SAMPLE_MODE_ICONS: Record<SampleMode, React.ReactNode> = {
  first: <NumberCircleOne size={14} weight="bold" />,
  random: <Shuffle size={14} weight="bold" />,
  "round-robin": <Repeat size={14} weight="bold" />,
};

const SAMPLE_MODE_CYCLE: SampleMode[] = ["first", "random", "round-robin"];

// Voice background colors mapping
const VOICE_BG_COLORS: Record<number, string> = {
  0: "bg-voice-1/40",
  1: "bg-voice-2/40",
  2: "bg-voice-3/40",
  3: "bg-voice-4/40",
};

interface StepButtonProps {
  condition: TriggerCondition;
  isFocused: boolean;
  isOn: boolean;
  isPlayhead: boolean;
  ledGlow: string;
  onClick: () => void;
  onColor: string;
  onContextMenu: (e: React.MouseEvent) => void;
  stepIdx: number;
  voiceIdx: number;
  voiceNumber: number;
}

const StepButton: React.FC<StepButtonProps> = ({
  condition,
  isFocused,
  isOn,
  isPlayhead,
  ledGlow,
  onClick,
  onColor,
  onContextMenu,
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

  return (
    <button
      aria-label={`Toggle step ${stepIdx + 1} for voice ${voiceNumber}${condition ? ` (${condition})` : ""}`}
      aria-pressed={isOn}
      className={`relative w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 rounded-md border-2 mx-0.5 focus:outline-none transition-colors ${onColor} ${ledGlow}`}
      data-testid={`seq-step-${voiceIdx}-${stepIdx}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="gridcell"
      type="button"
    >
      {/* Trigger condition indicator */}
      {condition && isOn && (
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
}

const ConditionPopover: React.FC<ConditionPopoverProps> = ({
  currentCondition,
  onClose,
  onSelect,
  position,
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
      className="fixed z-50 bg-surface-2 border border-border-strong rounded-lg shadow-lg py-1 min-w-[80px]"
      data-testid="condition-popover"
      ref={popoverRef}
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
    >
      {TRIGGER_CONDITIONS.map((cond) => {
        const isActive =
          cond === currentCondition ||
          (cond === null && currentCondition === null);
        const label = cond === null ? "Always" : cond;
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
  onVolumeChange?: (voiceNumber: number, volume: number) => void;
  ROW_COLORS: string[];
  safeStepPattern: number[][];
  sampleModes?: Record<number, SampleMode>;
  setFocusedStep: (step: FocusedStep) => void;
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
  onVolumeChange,
  ROW_COLORS,
  safeStepPattern,
  sampleModes = {},
  setFocusedStep,
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
    setFocusedStep({ step: stepIdx, voice: voiceIdx });
    toggleStep(voiceIdx, stepIdx);
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
                      stepIdx={stepIdx}
                      voiceIdx={voiceIdx}
                      voiceNumber={voiceNumber}
                    />
                  </React.Fragment>
                );
              })}

              {/* Spacer between steps and voice controls */}
              <div className="w-3" />

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
                  <SpeakerSimpleSlash
                    className="text-amber-500"
                    size={14}
                    weight="bold"
                  />
                ) : (
                  <SpeakerSimpleHigh className="text-text-tertiary" size={14} />
                )}
              </button>
              <input
                aria-label={`Volume for voice ${voiceNumber}`}
                className="w-14 h-1 cursor-pointer"
                data-testid={`voice-volume-${voiceIdx}`}
                max={100}
                min={0}
                onChange={(e) =>
                  onVolumeChange?.(voiceNumber, parseInt(e.target.value, 10))
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
          />,
          document.body,
        )}
    </div>
  );
};

export default StepSequencerGrid;

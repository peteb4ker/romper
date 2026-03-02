import {
  NumberCircleOne,
  Repeat,
  Shuffle,
  SpeakerSimpleHigh,
  SpeakerSimpleNone,
} from "@phosphor-icons/react";
import React from "react";

import type { SampleMode } from "./hooks/shared/stepPatternConstants";

import {
  type FocusedStep,
  SAMPLE_MODE_LABELS,
} from "./hooks/shared/stepPatternConstants";

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
  isFocused: boolean;
  isOn: boolean;
  isPlayhead: boolean;
  ledGlow: string;
  onClick: () => void;
  onColor: string;
  stepIdx: number;
  voiceIdx: number;
  voiceNumber: number;
}

const StepButton: React.FC<StepButtonProps> = ({
  isFocused,
  isOn,
  isPlayhead,
  ledGlow,
  onClick,
  onColor,
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
      aria-label={`Toggle step ${stepIdx + 1} for voice ${voiceNumber}`}
      aria-pressed={isOn}
      className={`relative w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 rounded-md border-2 mx-0.5 focus:outline-none transition-colors ${onColor} ${ledGlow}`}
      data-testid={`seq-step-${voiceIdx}-${stepIdx}`}
      onClick={onClick}
      role="gridcell"
      type="button"
    >
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

interface StepSequencerGridProps {
  currentSeqStep: number;
  focusedStep: FocusedStep;
  gridRef: React.RefObject<HTMLDivElement | null>;
  handleStepGridKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  isSeqPlaying: boolean;
  LED_GLOWS: string[];
  NUM_STEPS: number;
  NUM_VOICES: number;
  onSampleModeChange?: (voiceNumber: number, mode: SampleMode) => void;
  onVolumeChange?: (voiceNumber: number, volume: number) => void;
  ROW_COLORS: string[];
  safeStepPattern: number[][];
  sampleModes?: Record<number, SampleMode>;
  setFocusedStep: (step: FocusedStep) => void;
  toggleStep: (voiceIdx: number, stepIdx: number) => void;
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
  onSampleModeChange,
  onVolumeChange,
  ROW_COLORS,
  safeStepPattern,
  sampleModes = {},
  setFocusedStep,
  toggleStep,
  voiceVolumes = {},
}) => {
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

  return (
    <div
      aria-label="Step sequencer grid"
      className="flex flex-col gap-2"
      data-testid="kit-step-sequencer-grid"
      onKeyDown={handleStepGridKeyDown}
      ref={gridRef}
      role="grid"
      style={{ outline: "none" }}
      tabIndex={0}
    >
      {Array.from({ length: NUM_VOICES }, (_, index) => index).map(
        (voiceIdx) => {
          const voiceNumber = voiceIdx + 1;
          const volume = voiceVolumes[voiceNumber] ?? 100;
          const mode = sampleModes[voiceNumber] || "first";

          return (
            <div
              className="flex flex-row items-center"
              key={`seq-row-voice-${voiceIdx}`}
              role="row"
            >
              {/* Voice label */}
              <span
                className={`flex items-center justify-center w-7 h-7 min-w-7 text-center text-xs font-bold rounded ${VOICE_BG_COLORS[voiceIdx] || "bg-surface-3"} text-text-primary border border-border-strong mr-1.5`}
                data-testid={`seq-voice-label-${voiceIdx}`}
              >
                {voiceNumber}
              </span>

              {/* Step buttons with beat-group dividers every 4 steps */}
              {Array.from({ length: 16 }, (_, stepIdx) => {
                const isOn = safeStepPattern[voiceIdx][stepIdx] > 0;
                const groupIdx = Math.floor(stepIdx / 4);
                const showDivider = stepIdx > 0 && stepIdx % 4 === 0;

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

              {/* Volume icon + slider */}
              {volume === 0 ? (
                <SpeakerSimpleNone
                  className="text-text-tertiary mr-0.5 shrink-0"
                  size={14}
                />
              ) : (
                <SpeakerSimpleHigh
                  className="text-text-tertiary mr-0.5 shrink-0"
                  size={14}
                />
              )}
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
    </div>
  );
};

export default StepSequencerGrid;

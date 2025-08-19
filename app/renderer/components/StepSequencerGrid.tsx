import React from "react";

import type { FocusedStep } from "./hooks/shared/stepPatternConstants";

interface StepSequencerGridProps {
  currentSeqStep: number;
  focusedStep: FocusedStep;
  gridRef: React.RefObject<HTMLDivElement | null>;
  handleStepGridKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  isSeqPlaying: boolean;
  LED_GLOWS: string[];
  NUM_STEPS: number;
  NUM_VOICES: number;
  ROW_COLORS: string[];
  safeStepPattern: number[][];
  setFocusedStep: (step: FocusedStep) => void;
  toggleStep: (voiceIdx: number, stepIdx: number) => void;
}

const StepSequencerGrid: React.FC<StepSequencerGridProps> = ({
  currentSeqStep,
  focusedStep,
  gridRef,
  handleStepGridKeyDown,
  isSeqPlaying,
  LED_GLOWS,
  NUM_STEPS,
  NUM_VOICES,
  ROW_COLORS,
  safeStepPattern,
  setFocusedStep,
  toggleStep,
}) => {
  // Voice background colors mapping
  const VOICE_BG_COLORS = {
    0: "bg-blue-900/60",
    1: "bg-green-900/60",
    2: "bg-yellow-900/60",
    3: "bg-pink-900/60",
  } as const;

  return (
    <div
      aria-label="Step sequencer grid"
      className="grid grid-rows-4 gap-2 w-[600px] min-w-[600px] max-w-[600px]"
      data-testid="kit-step-sequencer-grid"
      onKeyDown={handleStepGridKeyDown}
      ref={gridRef}
      role="grid"
      style={{ minWidth: 0, outline: "none" }}
      tabIndex={0}
    >
      {Array.from({ length: NUM_VOICES }, (_, index) => index).map(
        (voiceNumber) => (
          <div
            className="flex flex-row items-center gap-1"
            key={`seq-row-voice-${voiceNumber}`}
            role="row"
            style={{ minWidth: 0 }}
          >
            <span
              className={`flex items-center justify-center w-8 text-center font-bold rounded w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 ${VOICE_BG_COLORS[voiceNumber as keyof typeof VOICE_BG_COLORS] || "bg-gray-900/60"} text-gray-200 border border-gray-900 dark:border-slate-900`}
              data-testid={`seq-voice-label-${voiceNumber}`}
            >
              {voiceNumber + 1}
            </span>
            {Array.from({ length: NUM_STEPS }).map((_, stepIdx) => {
              const isOn = safeStepPattern[voiceNumber][stepIdx] > 0;
              const isPlayhead = isSeqPlaying && currentSeqStep === stepIdx;
              const isFocused =
                focusedStep.voice === voiceNumber &&
                focusedStep.step === stepIdx;

              // Per-row color for 'on' steps
              const onColor = isOn
                ? ROW_COLORS[voiceNumber]
                : "bg-gray-300 dark:bg-slate-700 border-gray-400 dark:border-slate-600";

              // LED glow for 'on' steps
              const ledGlow = isOn ? LED_GLOWS[voiceNumber] : "";

              // Extract box shadow logic
              const getBoxShadow = () => {
                if (isPlayhead && isFocused) {
                  return "0 0 0 2px #fff, 0 0 0 2.5px #3b82f6";
                }
                if (isPlayhead) {
                  return "0 0 0 2px #fff";
                }
                if (isFocused) {
                  return "0 0 0 2.5px #60a5fa";
                }
                return undefined;
              };

              return (
                <button
                  aria-label={`Toggle step ${stepIdx + 1} for voice ${voiceNumber + 1}`}
                  aria-pressed={isOn}
                  className={`relative w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 rounded-md border-2 mx-0.5 focus:outline-none transition-colors ${onColor} ${ledGlow}`}
                  data-testid={`seq-step-${voiceNumber}-${stepIdx}`}
                  key={`seq-step-voice-${voiceNumber}-step-${stepIdx}`}
                  onClick={() => {
                    setFocusedStep({ step: stepIdx, voice: voiceNumber });
                    toggleStep(voiceNumber, stepIdx);
                  }}
                  role="gridcell"
                  type="button"
                >
                  {/* Highlight span for playhead/focus/selection */}
                  {(isPlayhead || isFocused) && (
                    <span
                      className={`absolute inset-0 rounded-md pointer-events-none`}
                      data-testid={
                        isFocused ? "seq-step-focus-ring" : undefined
                      }
                      style={{
                        boxShadow: getBoxShadow(),
                        zIndex: 2,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ),
      )}
    </div>
  );
};

export default StepSequencerGrid;

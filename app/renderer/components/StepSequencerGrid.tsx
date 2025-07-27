import React from "react";

import type { FocusedStep } from "./hooks/stepPatternConstants";

interface StepSequencerGridProps {
  safeStepPattern: number[][];
  focusedStep: FocusedStep;
  isSeqPlaying: boolean;
  currentSeqStep: number;
  ROW_COLORS: string[];
  LED_GLOWS: string[];
  NUM_VOICES: number;
  NUM_STEPS: number;
  setFocusedStep: (step: FocusedStep) => void;
  toggleStep: (voiceIdx: number, stepIdx: number) => void;
  handleStepGridKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
}

const StepSequencerGrid: React.FC<StepSequencerGridProps> = ({
  safeStepPattern,
  focusedStep,
  isSeqPlaying,
  currentSeqStep,
  ROW_COLORS,
  LED_GLOWS,
  NUM_VOICES,
  NUM_STEPS,
  setFocusedStep,
  toggleStep,
  handleStepGridKeyDown,
  gridRef,
}) => {
  return (
    <div
      className="grid grid-rows-4 gap-2 w-[600px] min-w-[600px] max-w-[600px]"
      data-testid="kit-step-sequencer-grid"
      tabIndex={0}
      ref={gridRef}
      onKeyDown={handleStepGridKeyDown}
      aria-label="Step sequencer grid"
      style={{ outline: "none", minWidth: 0 }}
    >
      {Array.from({ length: NUM_VOICES }).map((_, voiceIdx) => (
        <div
          key={`seq-row-${voiceIdx}`}
          className="flex flex-row items-center gap-1"
          style={{ minWidth: 0 }}
        >
          <span
            className={`flex items-center justify-center w-8 text-center font-bold rounded w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 ${["bg-blue-900/60", "bg-green-900/60", "bg-yellow-900/60", "bg-pink-900/60"][voiceIdx]} text-gray-200 border border-gray-900 dark:border-slate-900`}
            data-testid={`seq-voice-label-${voiceIdx}`}
          >
            {voiceIdx + 1}
          </span>
          {Array.from({ length: NUM_STEPS }).map((_, stepIdx) => {
            const isOn = safeStepPattern[voiceIdx][stepIdx] > 0;
            const isPlayhead = isSeqPlaying && currentSeqStep === stepIdx;
            const isFocused =
              focusedStep.voice === voiceIdx && focusedStep.step === stepIdx;

            // Per-row color for 'on' steps
            const onColor = isOn
              ? ROW_COLORS[voiceIdx]
              : "bg-gray-300 dark:bg-slate-700 border-gray-400 dark:border-slate-600";

            // LED glow for 'on' steps
            const ledGlow = isOn ? LED_GLOWS[voiceIdx] : "";

            return (
              <button
                key={`seq-step-${voiceIdx}-${stepIdx}`}
                type="button"
                className={`relative w-8 h-8 min-w-8 min-h-8 max-w-8 max-h-8 rounded-md border-2 mx-0.5 focus:outline-none transition-colors ${onColor} ${ledGlow}`}
                aria-label={`Toggle step ${stepIdx + 1} for voice ${voiceIdx + 1}`}
                data-testid={`seq-step-${voiceIdx}-${stepIdx}`}
                onClick={() => {
                  setFocusedStep({ voice: voiceIdx, step: stepIdx });
                  toggleStep(voiceIdx, stepIdx);
                }}
              >
                {/* Highlight span for playhead/focus/selection */}
                {(isPlayhead || isFocused) && (
                  <span
                    className={`absolute inset-0 rounded-md pointer-events-none`}
                    style={{
                      zIndex: 2,
                      boxShadow:
                        isPlayhead && isFocused
                          ? "0 0 0 2px #fff, 0 0 0 2.5px #3b82f6"
                          : isPlayhead
                            ? "0 0 0 2px #fff"
                            : isFocused
                              ? "0 0 0 2.5px #60a5fa"
                              : undefined,
                    }}
                    data-testid={isFocused ? "seq-step-focus-ring" : undefined}
                  />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default StepSequencerGrid;

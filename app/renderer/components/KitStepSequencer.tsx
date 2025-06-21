import React from "react";
import { FiPlay, FiSquare } from "react-icons/fi";

import { NUM_STEPS, NUM_VOICES } from "./hooks/useKitStepSequencer";
import { useStepSequencerFocus } from "./hooks/useStepSequencerFocus";

// @ts-ignore
const workerUrl = new URL("./kitStepSequencerWorker.ts", import.meta.url);

interface KitStepSequencerProps {
  samples: { [voice: number]: string[] };
  onPlaySample: (voice: number, sample: string) => void;
  stepPattern: boolean[][] | null;
  setStepPattern: (pattern: boolean[][]) => void;
  sequencerOpen: boolean;
  setSequencerOpen: (open: boolean) => void;
  gridRef?: React.RefObject<HTMLDivElement>;
}

const KitStepSequencer: React.FC<KitStepSequencerProps> = ({
  samples,
  onPlaySample,
  stepPattern,
  setStepPattern,
  sequencerOpen,
  setSequencerOpen,
  gridRef,
}) => {
  const { focusedStep, setFocusedStep, moveFocus } = useStepSequencerFocus(
    NUM_VOICES,
    NUM_STEPS,
  );
  // The sequencer drawer is hidden by default
  const gridRefInternal = React.useRef<HTMLDivElement>(null);
  const [isSeqPlaying, setIsSeqPlaying] = React.useState(false);
  const [currentSeqStep, setCurrentSeqStep] = React.useState<number>(0);

  // Memoize worker instance
  const workerRef = React.useRef<Worker | null>(null);
  const worker = React.useMemo(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(workerUrl, { type: "module" });
    }
    return workerRef.current;
  }, []);

  React.useEffect(() => {
    if (!worker) return;
    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === "STEP") {
        setCurrentSeqStep(e.data.payload.currentStep);
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [worker]);

  // Start/stop worker on play/stop
  React.useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    if (isSeqPlaying) {
      worker.postMessage({
        type: "START",
        payload: { numSteps: NUM_STEPS, stepDuration: 125 },
      });
    } else {
      worker.postMessage({ type: "STOP" });
    }
  }, [isSeqPlaying]);

  // Track last played step to avoid retriggering on same step
  const lastStepRef = React.useRef<number | null>(null);

  // Trigger sample playback for each active step on step advance
  React.useEffect(() => {
    if (!isSeqPlaying || !stepPattern) return;
    if (lastStepRef.current === currentSeqStep) return; // Only trigger on step change
    lastStepRef.current = currentSeqStep;
    for (let voiceIdx = 0; voiceIdx < NUM_VOICES; voiceIdx++) {
      const isStepActive = stepPattern[voiceIdx][currentSeqStep];
      const sample = samples[voiceIdx + 1]?.[0];
      if (isStepActive && sample) {
        onPlaySample(voiceIdx + 1, sample);
      }
    }
  }, [isSeqPlaying, currentSeqStep, stepPattern, samples, onPlaySample]);

  // Toggle step helper
  const toggleStep = React.useCallback(
    (voiceIdx: number, stepIdx: number) => {
      if (!stepPattern) return;
      const newPattern = stepPattern.map((row, v) =>
        v === voiceIdx ? row.map((on, s) => (s === stepIdx ? !on : on)) : row,
      );
      setStepPattern(newPattern);
    },
    [stepPattern, setStepPattern],
  );

  // Step sequencer keyboard navigation handler
  const handleStepGridKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!sequencerOpen) return;
      const { voice, step } = focusedStep;
      if (e.key === "ArrowRight") moveFocus("right");
      else if (e.key === "ArrowLeft") moveFocus("left");
      else if (e.key === "ArrowDown") moveFocus("down");
      else if (e.key === "ArrowUp") moveFocus("up");
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggleStep(voice, step);
        return;
      } else {
        return;
      }
      e.preventDefault();
    },
    [sequencerOpen, focusedStep, moveFocus, toggleStep],
  );

  const [localStepPattern, setLocalStepPattern] = React.useState<
    boolean[][] | null
  >(null);

  // Defensive: ensure stepPattern is always a valid 4x16 boolean array
  const safeStepPattern = React.useMemo(() => {
    if (
      !stepPattern ||
      !Array.isArray(stepPattern) ||
      stepPattern.length !== NUM_VOICES ||
      stepPattern.some((row) => !Array.isArray(row) || row.length !== NUM_STEPS)
    ) {
      return Array.from({ length: NUM_VOICES }, () =>
        Array(NUM_STEPS).fill(false),
      );
    }
    return stepPattern;
  }, [stepPattern]);

  // Focus sequencer grid when opened
  React.useEffect(() => {
    if (sequencerOpen) {
      // Use requestAnimationFrame to ensure DOM is ready
      const ref = gridRef || gridRefInternal;
      if (ref && ref.current) {
        requestAnimationFrame(() => {
          ref.current && ref.current.focus();
        });
      }
    }
  }, [sequencerOpen, gridRef]);

  // Per-row color and LED glow definitions (must be defined before use)
  const ROW_COLORS = [
    "bg-red-500 border-red-700", // Row 0
    "bg-green-500 border-green-700", // Row 1
    "bg-yellow-400 border-yellow-600", // Row 2
    "bg-purple-500 border-purple-700", // Row 3
  ];
  const LED_GLOWS = [
    "shadow-[0_0_12px_3px_rgba(239,68,68,0.7)]", // red
    "shadow-[0_0_12px_3px_rgba(34,197,94,0.7)]", // green
    "shadow-[0_0_12px_3px_rgba(234,179,8,0.7)]", // yellow
    "shadow-[0_0_12px_3px_rgba(168,85,247,0.7)]", // purple
  ];

  return (
    <div
      className="relative w-full flex flex-col items-center"
      style={{ zIndex: 19, minHeight: "33px" }}
    >
      {/* Drawer handle/edge */}
      <button
        className={`absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-36 h-6 border-b-0 rounded-t-sm bg-gray-300 dark:bg-slate-700 border border-gray-400 dark:border-slate-600 shadow-md hover:bg-gray-400 dark:hover:bg-slate-600 transition-colors focus:outline-none pointer-events-auto ${sequencerOpen ? "-top-4" : "top-2"}`}
        style={{
          cursor: "pointer",
          transition: "top 0.4s cubic-bezier(0.4,0,0.2,1)",
        }}
        aria-label={
          sequencerOpen ? "Hide step sequencer" : "Show step sequencer"
        }
        data-testid="kit-step-sequencer-handle"
        onClick={() => setSequencerOpen(!sequencerOpen)}
      >
        <span className="w-6 h-1 rounded bg-gray-500 dark:bg-gray-300 block" />
        <span className="ml-2 text-xs font-semibold">
          {sequencerOpen ? "Hide" : "Show"} Sequencer
        </span>
      </button>
      {/* Drawer body with animation */}
      <div
        className={`transition-all duration-500 ease-in-out rounded-t-md overflow-hidden w-full flex justify-center pointer-events-auto ${sequencerOpen ? "max-h-[400px] opacity-100 translate-y-0" : "max-h-0 opacity-0 translate-y-8 pointer-events-none"}`}
        style={{
          boxShadow: sequencerOpen
            ? "0 -4px 24px 0 rgba(0,0,0,0.18)"
            : undefined,
          background: "linear-gradient(180deg, #23272f 0%, #181a20 100%)",
          borderTop: "2px solid #8884",
          marginTop: sequencerOpen ? 8 : 0,
          position: "relative",
        }}
        data-testid="kit-step-sequencer-drawer"
      >
        <div
          className="mt-4 mb-4 w-full flex flex-col items-center"
          data-testid="kit-step-sequencer"
        >
          {/* Step sequencer controls and grid in a row */}
          <div className="flex flex-row items-start justify-center gap-4">
            {/* Play controls (left) */}
            <div
              className="flex flex-col items-center justify-start pt-2"
              data-testid="kit-step-sequencer-controls"
            >
              <button
                type="button"
                className="rounded p-2 border border-gray-400 dark:border-gray-600 bg-white dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                aria-label={isSeqPlaying ? "Stop sequencer" : "Play sequencer"}
                title={isSeqPlaying ? "Stop sequencer" : "Play sequencer"}
                onClick={() => setIsSeqPlaying((p) => !p)}
                data-testid={
                  isSeqPlaying ? "stop-step-sequencer" : "play-step-sequencer"
                }
              >
                {isSeqPlaying ? <FiSquare /> : <FiPlay />}
              </button>
              <span className="text-xs text-gray-300">120 BPM</span>
            </div>
            {/* Sequencer grid (right) */}
            <div
              className="grid grid-rows-4 gap-2 w-[600px] min-w-[600px] max-w-[600px]"
              data-testid="kit-step-sequencer-grid"
              tabIndex={sequencerOpen ? 0 : -1}
              ref={gridRef || gridRefInternal}
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
                    const isOn = safeStepPattern[voiceIdx][stepIdx];
                    const isPlayhead =
                      isSeqPlaying && currentSeqStep === stepIdx;
                    const isFocused =
                      focusedStep.voice === voiceIdx &&
                      focusedStep.step === stepIdx;
                    // Per-row color for 'on' steps
                    const onColor = isOn
                      ? ROW_COLORS[voiceIdx]
                      : "bg-gray-300 dark:bg-slate-700 border-gray-400 dark:border-slate-600";
                    // LED glow for 'on' steps
                    const ledGlow = isOn ? LED_GLOWS[voiceIdx] : "";
                    // Selection and playhead highlight logic
                    let highlightClass = "";
                    if (isPlayhead && isFocused) {
                      highlightClass =
                        "border-2 border-white outline outline-2 outline-blue-400";
                    } else if (isPlayhead) {
                      highlightClass = "border-2 border-white";
                    } else if (isFocused) {
                      highlightClass = "outline outline-2 outline-blue-400";
                    }
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
                                  ? "0 0 0 2px #fff, 0 0 0 2.5px #3b82f6" // white border, thinner blue for both
                                  : isPlayhead
                                    ? "0 0 0 2px #fff" // white border, no gap
                                    : isFocused
                                      ? "0 0 0 2.5px #60a5fa" // thinner blue for focus only
                                      : undefined,
                            }}
                            data-testid={
                              isFocused ? "seq-step-focus-ring" : undefined
                            }
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitStepSequencer;

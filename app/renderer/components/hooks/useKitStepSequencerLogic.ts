import React from "react";

export const NUM_VOICES = 4;
export const NUM_STEPS = 16;

interface UseKitStepSequencerLogicParams {
  samples: { [voice: number]: string[] };
  onPlaySample: (voice: number, sample: string) => void;
  stepPattern: number[][] | null;
  setStepPattern: (pattern: number[][]) => void;
  sequencerOpen: boolean;
  setSequencerOpen: (open: boolean) => void;
  gridRef?: React.RefObject<HTMLDivElement>;
}

interface FocusedStep {
  voice: number;
  step: number;
}

/**
 * Main business logic hook for KitStepSequencer component
 * Handles worker management, playback, pattern management, and keyboard navigation
 */
export function useKitStepSequencerLogic(
  params: UseKitStepSequencerLogicParams,
) {
  const {
    samples,
    onPlaySample,
    stepPattern,
    setStepPattern,
    sequencerOpen,
    gridRef,
  } = params;

  // Worker management
  const workerRef = React.useRef<Worker | null>(null);
  const workerUrl = React.useMemo(
    () => new URL("../kitStepSequencerWorker.ts", import.meta.url),
    [],
  );

  // Playback state
  const [isSeqPlaying, setIsSeqPlaying] = React.useState(false);
  const [currentSeqStep, setCurrentSeqStep] = React.useState<number>(0);

  // Focus management for keyboard navigation
  const [focusedStep, setFocusedStep] = React.useState<FocusedStep>({
    voice: 0,
    step: 0,
  });

  // Worker initialization and cleanup
  const worker = React.useMemo(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(workerUrl, { type: "module" });
    }
    return workerRef.current;
  }, [workerUrl]);

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

  // Worker playback control
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

  // Sample triggering on step advance
  const lastStepRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!isSeqPlaying || !stepPattern) return;
    if (lastStepRef.current === currentSeqStep) return; // Only trigger on step change

    lastStepRef.current = currentSeqStep;

    for (let voiceIdx = 0; voiceIdx < NUM_VOICES; voiceIdx++) {
      const isStepActive = stepPattern[voiceIdx][currentSeqStep] > 0; // Check if velocity > 0
      const sample = samples[voiceIdx + 1]?.[0];
      if (isStepActive && sample) {
        onPlaySample(voiceIdx + 1, sample);
      }
    }
  }, [isSeqPlaying, currentSeqStep, stepPattern, samples, onPlaySample]);

  // Step pattern management
  const safeStepPattern = React.useMemo(() => {
    if (
      !stepPattern ||
      !Array.isArray(stepPattern) ||
      stepPattern.length !== NUM_VOICES ||
      stepPattern.some((row) => !Array.isArray(row) || row.length !== NUM_STEPS)
    ) {
      return Array.from({ length: NUM_VOICES }, () => Array(NUM_STEPS).fill(0));
    }
    return stepPattern;
  }, [stepPattern]);

  // Step toggling
  const toggleStep = React.useCallback(
    (voiceIdx: number, stepIdx: number) => {
      if (!stepPattern) return;
      const newPattern = stepPattern.map((row, v) =>
        v === voiceIdx
          ? row.map((velocity, s) =>
              s === stepIdx ? (velocity > 0 ? 0 : 127) : velocity,
            )
          : row,
      );
      setStepPattern(newPattern);
    },
    [stepPattern, setStepPattern],
  );

  // Focus navigation
  const moveFocus = React.useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      setFocusedStep((prev) => {
        let newVoice = prev.voice;
        let newStep = prev.step;

        switch (direction) {
          case "up":
            newVoice = Math.max(0, prev.voice - 1);
            break;
          case "down":
            newVoice = Math.min(NUM_VOICES - 1, prev.voice + 1);
            break;
          case "left":
            newStep = Math.max(0, prev.step - 1);
            break;
          case "right":
            newStep = Math.min(NUM_STEPS - 1, prev.step + 1);
            break;
        }

        return { voice: newVoice, step: newStep };
      });
    },
    [],
  );

  // Keyboard navigation
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

  // Focus management when sequencer opens
  const gridRefInternal = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (sequencerOpen) {
      const ref = gridRef || gridRefInternal;
      if (ref && ref.current) {
        requestAnimationFrame(() => {
          ref.current && ref.current.focus();
        });
      }
    }
  }, [sequencerOpen, gridRef]);

  // UI styling constants
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

  return {
    // State
    isSeqPlaying,
    currentSeqStep,
    focusedStep,
    safeStepPattern,
    gridRefInternal,

    // Actions
    setIsSeqPlaying,
    setFocusedStep,
    toggleStep,
    handleStepGridKeyDown,

    // Constants
    ROW_COLORS,
    LED_GLOWS,
    NUM_VOICES,
    NUM_STEPS,
  };
}

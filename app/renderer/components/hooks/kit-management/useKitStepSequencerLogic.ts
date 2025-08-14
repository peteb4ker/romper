import React from "react";

import {
  ensureValidStepPattern,
  type FocusedStep,
  LED_GLOWS,
  NUM_STEPS,
  NUM_VOICES,
  ROW_COLORS,
} from "../shared/stepPatternConstants";

interface UseKitStepSequencerLogicParams {
  gridRef?: React.RefObject<HTMLDivElement>;
  kitName?: string; // Add kit name for secure playback
  onPlaySample: (voice: number, sample: string) => void;
  samples: { [voice: number]: string[] };
  sequencerOpen: boolean;
  setSequencerOpen: (open: boolean) => void;
  setStepPattern: (pattern: number[][]) => void;
  stepPattern: null | number[][];
}

/**
 * Main business logic hook for KitStepSequencer component
 * Handles worker management, playback, pattern management, and keyboard navigation
 */
export function useKitStepSequencerLogic(
  params: UseKitStepSequencerLogicParams,
) {
  const {
    gridRef,
    onPlaySample,
    samples,
    sequencerOpen,
    setStepPattern,
    stepPattern,
  } = params;

  // Worker management
  const workerRef = React.useRef<null | Worker>(null);

  // Create worker from inline source to avoid MIME type issues
  const workerBlob = React.useMemo(() => {
    const workerScript = `
      let isPlaying = false;
      let currentStep = 0;
      let numSteps = 16;
      let interval = null;
      let stepDuration = 125;

      self.onmessage = function (e) {
        if (!e.data || typeof e.data !== "object") {
          return;
        }

        const { payload = {}, type } = e.data;

        if (type === "START") {
          isPlaying = true;
          numSteps = payload.numSteps ?? 16;
          stepDuration = payload.stepDuration ?? 125;
          if (interval) clearInterval(interval);
          interval = setInterval(() => {
            if (!isPlaying) return;
            currentStep = (currentStep + 1) % numSteps;
            self.postMessage({ payload: { currentStep }, type: "STEP" });
          }, stepDuration);
        } else if (type === "STOP") {
          isPlaying = false;
          if (interval) clearInterval(interval);
          interval = null;
          currentStep = 0;
          self.postMessage({ payload: { currentStep }, type: "STEP" });
        } else if (type === "SET_STEP") {
          currentStep = payload.currentStep ?? 0;
        }
      };
    `;

    return new Blob([workerScript], { type: "application/javascript" });
  }, []);

  const workerUrl = React.useMemo(() => {
    return URL.createObjectURL(workerBlob);
  }, [workerBlob]);

  // Playback state
  const [isSeqPlaying, setIsSeqPlaying] = React.useState(false);
  const [currentSeqStep, setCurrentSeqStep] = React.useState<number>(0);

  // Focus management for keyboard navigation
  const [focusedStep, setFocusedStep] = React.useState<FocusedStep>({
    step: 0,
    voice: 0,
  });

  // Worker initialization and cleanup
  const worker = React.useMemo(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(workerUrl);
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
      URL.revokeObjectURL(workerUrl);
    };
  }, [worker, workerUrl]);

  // Worker playback control
  React.useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    if (isSeqPlaying) {
      worker.postMessage({
        payload: { numSteps: NUM_STEPS, stepDuration: 125 },
        type: "START",
      });
    } else {
      worker.postMessage({ type: "STOP" });
    }
  }, [isSeqPlaying]);

  // Sample triggering on step advance
  const lastStepRef = React.useRef<null | number>(null);

  React.useEffect(() => {
    if (!isSeqPlaying || !stepPattern) return;
    if (lastStepRef.current === currentSeqStep) return; // Only trigger on step change

    lastStepRef.current = currentSeqStep;

    // Use explicit voice numbers 1-4 to match the voice_number field architecture
    for (let voiceIdx = 0; voiceIdx < NUM_VOICES; voiceIdx++) {
      const voiceNumber = voiceIdx + 1; // Convert 0-based index to 1-based voice number
      const isStepActive = stepPattern[voiceIdx][currentSeqStep] > 0; // Check if velocity > 0
      const voiceSamples = samples[voiceNumber];
      const sample = voiceSamples?.[0]; // Use first sample from the voice

      // Debug logging to help diagnose issues
      if (isStepActive) {
        console.log(
          `[Sequencer] Step ${currentSeqStep} voice ${voiceNumber}: active=${isStepActive}, sample=${sample}, voiceSamples=`,
          voiceSamples,
        );
        if (sample) {
          onPlaySample(voiceNumber, sample);
        } else {
          console.log(
            `[Sequencer] No sample available for voice ${voiceNumber}`,
          );
        }
      }
    }
  }, [isSeqPlaying, currentSeqStep, stepPattern, samples, onPlaySample]);

  // Step pattern management
  const safeStepPattern = React.useMemo(() => {
    return ensureValidStepPattern(stepPattern);
  }, [stepPattern]);

  // Step toggling
  const toggleStep = React.useCallback(
    (voiceIdx: number, stepIdx: number) => {
      if (!stepPattern) return;
      const oldVelocity = stepPattern[voiceIdx][stepIdx];
      const newVelocity = oldVelocity > 0 ? 0 : 127;

      console.log(
        `[Sequencer] Toggling step voice ${voiceIdx + 1}, step ${stepIdx}: ${oldVelocity} -> ${newVelocity}`,
      );

      const newPattern = stepPattern.map((row, v) =>
        v === voiceIdx
          ? row.map((velocity, s) => (s === stepIdx ? newVelocity : velocity))
          : row,
      );

      console.log(
        `[Sequencer] New pattern for voice ${voiceIdx + 1}:`,
        newPattern[voiceIdx],
      );
      setStepPattern(newPattern);
    },
    [stepPattern, setStepPattern],
  );

  // Focus navigation
  const moveFocus = React.useCallback(
    (direction: "down" | "left" | "right" | "up") => {
      setFocusedStep((prev) => {
        let newVoice = prev.voice;
        let newStep = prev.step;

        switch (direction) {
          case "down":
            newVoice = Math.min(NUM_VOICES - 1, prev.voice + 1);
            break;
          case "left":
            newStep = Math.max(0, prev.step - 1);
            break;
          case "right":
            newStep = Math.min(NUM_STEPS - 1, prev.step + 1);
            break;
          case "up":
            newVoice = Math.max(0, prev.voice - 1);
            break;
        }

        return { step: newStep, voice: newVoice };
      });
    },
    [],
  );

  // Keyboard navigation
  const handleStepGridKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!sequencerOpen) return;

      const { step, voice } = focusedStep;

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
      if (ref?.current) {
        requestAnimationFrame(() => {
          ref.current?.focus();
        });
      }
    }
  }, [sequencerOpen, gridRef]);

  // UI styling constants are now imported from shared constants

  return {
    currentSeqStep,
    focusedStep,
    gridRefInternal,
    handleStepGridKeyDown,
    // State
    isSeqPlaying,

    LED_GLOWS,
    NUM_STEPS,
    NUM_VOICES,
    // Constants
    ROW_COLORS,

    safeStepPattern,
    setFocusedStep,
    // Actions
    setIsSeqPlaying,
    toggleStep,
  };
}

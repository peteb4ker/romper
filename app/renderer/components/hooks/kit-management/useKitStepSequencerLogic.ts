import React from "react";

import {
  ensureValidStepPattern,
  type FocusedStep,
  LED_GLOWS,
  NUM_STEPS,
  NUM_VOICES,
  ROW_COLORS,
  type SampleMode,
  shouldTrigger,
  type TriggerCondition,
} from "../shared/stepPatternConstants";

interface UseKitStepSequencerLogicParams {
  bpm?: number;
  gridRef?: React.RefObject<HTMLDivElement>;
  kitName?: string; // Add kit name for secure playback
  onPlaySample: (voice: number, sample: string, volume?: number) => void;
  sampleModes?: Record<number, SampleMode>;
  samples: { [voice: number]: string[] };
  sequencerOpen: boolean;
  setSequencerOpen: (open: boolean) => void;
  setStepPattern: (pattern: number[][]) => void;
  stepPattern: null | number[][];
  triggerConditions?: (null | string)[][];
  voiceVolumes?: Record<number, number>;
}

/**
 * Main business logic hook for KitStepSequencer component
 * Handles worker management, playback, pattern management, and keyboard navigation
 */
export function useKitStepSequencerLogic(
  params: UseKitStepSequencerLogicParams,
) {
  const {
    bpm = 120,
    gridRef,
    onPlaySample,
    sampleModes = {},
    samples,
    sequencerOpen,
    setStepPattern,
    stepPattern,
    triggerConditions,
    voiceVolumes = {},
  } = params;

  // Worker management
  const workerRef = React.useRef<null | Worker>(null);

  // Calculate step duration from BPM (assuming 16th notes)
  const stepDuration = React.useMemo(() => {
    return Math.round(60000 / (bpm * 4));
  }, [bpm]);

  // Create worker from inline source to avoid MIME type issues
  const workerBlob = React.useMemo(() => {
    const workerScript = `
      let isPlaying = false;
      let currentStep = 0;
      let cycleCount = 0;
      let numSteps = 16;
      let interval = null;
      let stepDuration = 125; // Default, will be overridden by START message

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
            const prevStep = currentStep;
            currentStep = (currentStep + 1) % numSteps;
            if (prevStep === numSteps - 1 && currentStep === 0) {
              cycleCount++;
            }
            self.postMessage({ payload: { currentStep, cycleCount }, type: "STEP" });
          }, stepDuration);
        } else if (type === "STOP") {
          isPlaying = false;
          if (interval) clearInterval(interval);
          interval = null;
          currentStep = 0;
          cycleCount = 0;
          self.postMessage({ payload: { currentStep, cycleCount }, type: "STEP" });
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
  const [cycleCount, setCycleCount] = React.useState<number>(0);

  // Focus management for keyboard navigation
  const [focusedStep, setFocusedStep] = React.useState<FocusedStep>({
    step: 0,
    voice: 0,
  });

  // Worker initialization and cleanup
  const worker = React.useMemo(() => {
    workerRef.current ??= new Worker(workerUrl);
    return workerRef.current;
  }, [workerUrl]);

  React.useEffect(() => {
    if (!worker) return;

    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === "STEP") {
        setCurrentSeqStep(e.data.payload.currentStep);
        setCycleCount(e.data.payload.cycleCount ?? 0);
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
        payload: { numSteps: NUM_STEPS, stepDuration },
        type: "START",
      });
    } else {
      worker.postMessage({ type: "STOP" });
    }
  }, [isSeqPlaying, stepDuration]);

  // Sample triggering on step advance
  const lastStepRef = React.useRef<null | number>(null);
  const roundRobinIndexRef = React.useRef<Record<number, number>>({});

  /**
   * Select a sample based on the voice's sample mode
   */
  const selectSample = React.useCallback(
    (voiceNumber: number, voiceSamples: string[]): string | undefined => {
      if (!voiceSamples || voiceSamples.length === 0) return undefined;

      const mode = sampleModes[voiceNumber] || "first";

      switch (mode) {
        case "random":
          return voiceSamples[Math.floor(Math.random() * voiceSamples.length)]; // NOSONAR - not cryptographic, used for musical randomization
        case "round-robin": {
          const currentIndex = roundRobinIndexRef.current[voiceNumber] ?? 0;
          const sample = voiceSamples[currentIndex % voiceSamples.length];
          roundRobinIndexRef.current[voiceNumber] =
            (currentIndex + 1) % voiceSamples.length;
          return sample;
        }
        case "first":
        default:
          return voiceSamples[0];
      }
    },
    [sampleModes],
  );

  React.useEffect(() => {
    if (!isSeqPlaying || !stepPattern) return;
    if (lastStepRef.current === currentSeqStep) return; // Only trigger on step change

    lastStepRef.current = currentSeqStep;

    // Use explicit voice numbers 1-4 to match the voice_number field architecture
    for (let voiceIdx = 0; voiceIdx < NUM_VOICES; voiceIdx++) {
      const voiceNumber = voiceIdx + 1; // Convert 0-based index to 1-based voice number
      const isStepActive = stepPattern[voiceIdx][currentSeqStep] > 0; // Check if velocity > 0
      const condition = (triggerConditions?.[voiceIdx]?.[currentSeqStep] ??
        null) as TriggerCondition;

      if (isStepActive && shouldTrigger(condition, cycleCount)) {
        const voiceSamples = samples[voiceNumber];
        const sample = selectSample(voiceNumber, voiceSamples);
        console.log(
          `[Sequencer] Step ${currentSeqStep} voice ${voiceNumber}: active=${isStepActive}, condition=${condition}, cycle=${cycleCount}, sample=${sample}`,
        );
        if (sample) {
          const vol = voiceVolumes[voiceNumber] ?? 100;
          onPlaySample(voiceNumber, sample, vol);
        } else {
          console.log(
            `[Sequencer] No sample available for voice ${voiceNumber}`,
          );
        }
      }
    }
  }, [
    isSeqPlaying,
    currentSeqStep,
    cycleCount,
    stepPattern,
    triggerConditions,
    samples,
    onPlaySample,
    selectSample,
    voiceVolumes,
  ]);

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
    cycleCount,
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

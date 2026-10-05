import type { SliceStep, VoiceSliceSettings } from "@romper/shared/sliceTypes";

import React from "react";

import type { StereoLinks } from "../../KitStepSequencer";
import type { PlayOptions } from "../../kitTypes";
import type { SequenceEditMeta } from "./useSequenceHistory";

import { createLogger } from "../../../utils/logger";
import { isModalDialogOpen } from "../../../utils/modalDialog";
import {
  resolveTriggeredSlice,
  sliceRegion,
  type SliceView,
} from "../shared/sliceConstants";
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

const log = createLogger("Sequencer");

/**
 * Sequencer triggers are scheduled this far ahead of each step's ideal time,
 * so React latency and audio output latency don't reach the audio: every
 * voice starts exactly on the grid, and consecutive slices of a loop join up
 * without gaps. Sound lags the on-screen playhead by this much.
 */
export const SCHEDULE_AHEAD_MS = 80;

interface UseKitStepSequencerLogicParams {
  bpm?: number;
  gridRef?: React.RefObject<HTMLDivElement>;
  kitName?: string; // Add kit name for secure playback
  /** Extra grid keys (slicer shortcuts); return true when handled. */
  onGridKeyDown?: (
    e: React.KeyboardEvent<HTMLDivElement>,
    focusedStep: FocusedStep,
  ) => boolean;
  onPlaySample: (
    voice: number,
    slot: number,
    volume?: number,
    options?: PlayOptions,
  ) => void;
  /** Called when a slice-mode step fires, with the slice it played. */
  onSliceTriggered?: (voiceNumber: number, view: SliceView) => void;
  sampleModes?: Record<number, SampleMode>;
  samples: { [voice: number]: string[] };
  sequencerOpen: boolean;
  setSequencerOpen: (open: boolean) => void;
  setStepPattern: (pattern: number[][], meta?: SequenceEditMeta) => void;
  slicerDivision?: number;
  sliceSettings?: Record<number, VoiceSliceSettings>;
  sliceSteps?: (null | SliceStep)[][];
  stepPattern: null | number[][];
  stereoLinks?: StereoLinks;
  triggerConditions?: (null | string)[][];
  voiceMutes?: Record<number, boolean>;
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
    kitName,
    onGridKeyDown,
    onPlaySample,
    onSliceTriggered,
    sampleModes = {},
    samples,
    sequencerOpen,
    setStepPattern,
    slicerDivision = 16,
    sliceSettings,
    sliceSteps,
    stepPattern,
    stereoLinks,
    triggerConditions,
    voiceMutes = {},
    voiceVolumes = {},
  } = params;

  // Worker management
  const workerRef = React.useRef<null | Worker>(null);

  // Calculate step duration from BPM (assuming 16th notes)
  const stepDuration = React.useMemo(() => {
    return 60000 / (bpm * 4);
  }, [bpm]);

  // Ideal time (performance.now() ms) of the step being triggered
  const stepTimeRef = React.useRef(0);

  // Create worker from inline source to avoid MIME type issues
  const workerBlob = React.useMemo(() => {
    const workerScript = `
      let isPlaying = false;
      let currentStep = 0;
      let cycleCount = 0;
      let numSteps = 16;
      let timer = null;
      let stepDuration = 125; // Default, will be overridden by START message
      let startTime = 0;
      let ticks = 0;

      // Drift-free clock: each step is timed from the start, not from the
      // previous timer firing, and carries its ideal (absolute) time.
      function scheduleNext() {
        const target = startTime + (ticks + 1) * stepDuration;
        timer = setTimeout(() => {
          if (!isPlaying) return;
          ticks++;
          const prevStep = currentStep;
          currentStep = (currentStep + 1) % numSteps;
          if (prevStep === numSteps - 1 && currentStep === 0) {
            cycleCount++;
          }
          self.postMessage({
            payload: { at: performance.timeOrigin + target, currentStep, cycleCount },
            type: "STEP",
          });
          scheduleNext();
        }, Math.max(0, target - performance.now()));
      }

      self.onmessage = function (e) {
        if (!e.data || typeof e.data !== "object") {
          return;
        }

        const { payload = {}, type } = e.data;

        if (type === "START") {
          isPlaying = true;
          numSteps = payload.numSteps ?? 16;
          stepDuration = payload.stepDuration ?? 125;
          if (timer) clearTimeout(timer);
          startTime = performance.now();
          ticks = 0;
          scheduleNext();
        } else if (type === "STOP") {
          isPlaying = false;
          if (timer) clearTimeout(timer);
          timer = null;
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
        const at = e.data.payload.at;
        stepTimeRef.current =
          typeof at === "number"
            ? at - performance.timeOrigin
            : performance.now();
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
      // The first step plays straight away; later steps come from the worker
      stepTimeRef.current = performance.now();
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

  // The editor isn't remounted when you step to another kit, so the next kit
  // starts stopped, from its first layer (#565)
  React.useEffect(() => {
    setIsSeqPlaying(false);
    roundRobinIndexRef.current = {};
  }, [kitName]);

  /**
   * Select a sample slot based on the voice's sample mode. Returns the slot,
   * not the file name: a voice can hold two files with the same name (RE-45).
   */
  const selectSample = React.useCallback(
    (voiceNumber: number, voiceSamples: string[]): number | undefined => {
      if (!voiceSamples || voiceSamples.length === 0) return undefined;

      const mode = sampleModes[voiceNumber] || "first";

      let slot: number;
      switch (mode) {
        case "random":
          slot = Math.floor(Math.random() * voiceSamples.length); // NOSONAR - not cryptographic, used for musical randomization
          break;
        case "round-robin": {
          const currentIndex = roundRobinIndexRef.current[voiceNumber] ?? 0;
          slot = currentIndex % voiceSamples.length;
          roundRobinIndexRef.current[voiceNumber] =
            (currentIndex + 1) % voiceSamples.length;
          break;
        }
        case "first":
        default:
          slot = 0;
      }
      return voiceSamples[slot] ? slot : undefined;
    },
    [sampleModes],
  );

  React.useEffect(() => {
    if (!isSeqPlaying || !stepPattern) return;
    if (lastStepRef.current === currentSeqStep) return; // Only trigger on step change

    lastStepRef.current = currentSeqStep;
    // Anchor to the step's ideal time (not now) so late messages don't add
    // jitter; playback clamps anything already past to "now"
    const startAt = stepTimeRef.current + SCHEDULE_AHEAD_MS;

    // Use explicit voice numbers 1-4 to match the voice_number field architecture
    for (let voiceIdx = 0; voiceIdx < NUM_VOICES; voiceIdx++) {
      const voiceNumber = voiceIdx + 1; // Convert 0-based index to 1-based voice number
      const due = isVoiceDue({
        cycleCount,
        step: currentSeqStep,
        stepPattern,
        stereoLinks,
        triggerConditions,
        voiceIdx,
        voiceMutes,
      });
      if (!due) continue;

      const slot = selectSample(voiceNumber, samples[voiceNumber]);
      log.debug(
        `Step ${currentSeqStep} voice ${voiceNumber}: cycle=${cycleCount}, slot=${slot}`,
      );
      if (slot === undefined) {
        log.debug(`No sample available for voice ${voiceNumber}`);
        continue;
      }

      const vol = voiceVolumes[voiceNumber] ?? 100;
      const slice = sliceSettings?.[voiceNumber];
      if (slice?.enabled) {
        // Slice mode: the slot is chosen above; now pick its slice
        const view = resolveTriggeredSlice(
          sliceSteps?.[voiceIdx]?.[currentSeqStep] ?? null,
          currentSeqStep,
          slicerDivision,
          slice,
        );
        onPlaySample(voiceNumber, slot, vol, {
          region: sliceRegion(view, slicerDivision),
          startAt,
        });
        onSliceTriggered?.(voiceNumber, view);
      } else {
        onPlaySample(voiceNumber, slot, vol, { startAt });
      }
    }
  }, [
    isSeqPlaying,
    currentSeqStep,
    cycleCount,
    stepPattern,
    stereoLinks,
    triggerConditions,
    samples,
    onPlaySample,
    onSliceTriggered,
    selectSample,
    sliceSettings,
    slicerDivision,
    sliceSteps,
    voiceMutes,
    voiceVolumes,
  ]);

  // Step pattern management
  const safeStepPattern = React.useMemo(() => {
    return ensureValidStepPattern(stepPattern);
  }, [stepPattern]);

  // Which rows fire on the current step (for the pads' and chips' flash):
  // on, unmuted, and their condition met this cycle
  const firingVoices = React.useMemo(
    () =>
      Array.from(
        { length: NUM_VOICES },
        (_, voiceIdx) =>
          isSeqPlaying &&
          isVoiceDue({
            cycleCount,
            step: currentSeqStep,
            stepPattern: safeStepPattern,
            stereoLinks,
            triggerConditions,
            voiceIdx,
            voiceMutes,
          }),
      ),
    [
      currentSeqStep,
      cycleCount,
      isSeqPlaying,
      safeStepPattern,
      stereoLinks,
      triggerConditions,
      voiceMutes,
    ],
  );

  // Step toggling
  const toggleStep = React.useCallback(
    (voiceIdx: number, stepIdx: number) => {
      if (!stepPattern) return;
      const oldVelocity = stepPattern[voiceIdx][stepIdx];
      const newVelocity = oldVelocity > 0 ? 0 : 127;

      log.debug(
        `Toggling step voice ${voiceIdx + 1}, step ${stepIdx}: ${oldVelocity} -> ${newVelocity}`,
      );

      const newPattern = stepPattern.map((row, v) =>
        v === voiceIdx
          ? row.map((velocity, s) => (s === stepIdx ? newVelocity : velocity))
          : row,
      );

      log.debug(`New pattern for voice ${voiceIdx + 1}:`, newPattern[voiceIdx]);
      setStepPattern(newPattern, {
        description: `Turn step ${stepIdx + 1} on voice ${voiceIdx + 1} ${newVelocity > 0 ? "on" : "off"}`,
        // A slice click can toggle a step and assign its slice: one undo
        mergeKey: `step:${voiceIdx}:${stepIdx}`,
      });
    },
    [stepPattern, setStepPattern],
  );

  // Focus navigation — skips stereo-linked secondary voices
  const moveFocus = React.useCallback(
    (direction: "down" | "left" | "right" | "up") => {
      setFocusedStep((prev) => {
        let newVoice = prev.voice;
        let newStep = prev.step;

        switch (direction) {
          case "down": {
            let candidate = prev.voice + 1;
            while (
              candidate < NUM_VOICES &&
              stereoLinks?.linkedSecondaries.has(candidate + 1)
            ) {
              candidate++;
            }
            newVoice = Math.min(NUM_VOICES - 1, candidate);
            break;
          }
          case "left":
            newStep = Math.max(0, prev.step - 1);
            break;
          case "right":
            newStep = Math.min(NUM_STEPS - 1, prev.step + 1);
            break;
          case "up": {
            let candidate = prev.voice - 1;
            while (
              candidate >= 0 &&
              stereoLinks?.linkedSecondaries.has(candidate + 1)
            ) {
              candidate--;
            }
            newVoice = Math.max(0, candidate);
            break;
          }
        }

        return { step: newStep, voice: newVoice };
      });
    },
    [stereoLinks],
  );

  // Keyboard navigation
  const handleStepGridKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!sequencerOpen) return;
      // Only the grid and its step pads take grid keys. The row controls
      // (mute, mode, level, ?) keep theirs, and portalled popovers bubble
      // through React to the grid but aren't part of it.
      if (!isGridKeyTarget(e.currentTarget, e.target)) return;

      const { step, voice } = focusedStep;

      if (onGridKeyDown?.(e, focusedStep)) {
        e.preventDefault();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowRight") moveFocus("right");
      else if (e.key === "ArrowLeft") moveFocus("left");
      else if (e.key === "ArrowDown") moveFocus("down");
      else if (e.key === "ArrowUp") moveFocus("up");
      else if (e.key === "Enter") toggleStep(voice, step);
      else if (e.key === " ") {
        // Space is the transport, as in every DAW. Stop it here so the
        // sequencer-wide Space handler doesn't toggle playback twice.
        e.stopPropagation();
        setIsSeqPlaying((playing) => !playing);
      } else {
        return;
      }
      e.preventDefault();
    },
    [sequencerOpen, focusedStep, moveFocus, toggleStep, onGridKeyDown],
  );

  // Space plays and stops while the sequencer is open, wherever focus is,
  // unless a control that uses Space itself has it.
  React.useEffect(() => {
    if (!sequencerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " " || e.defaultPrevented || isModalDialogOpen()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (usesSpaceItself(e.target)) return;
      e.preventDefault();
      setIsSeqPlaying((playing) => !playing);
    };
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [sequencerOpen]);

  // Focus management when sequencer opens
  const gridRefInternal = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (sequencerOpen) {
      const ref = gridRef || gridRefInternal;
      if (ref?.current) {
        requestAnimationFrame(() => {
          // Step options opened from the keyboard in the meantime keep focus
          // (frames come late in a hidden window)
          if (
            (document.activeElement as HTMLElement | null)?.closest?.(
              '[data-testid="condition-popover"]',
            )
          ) {
            return;
          }
          ref.current?.focus();
        });
      }
    }
  }, [sequencerOpen, gridRef]);

  // UI styling constants are now imported from shared constants

  return {
    currentSeqStep,
    cycleCount,
    firingVoices,
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

/** Whether a key event came from the grid itself or one of its pads. */
function isGridKeyTarget(
  container: EventTarget | null,
  target: EventTarget | null,
): boolean {
  const grid = container as HTMLElement | null;
  if (!grid?.contains) return true; // no DOM to check (tests): assume a pad
  if (target === grid) return true;
  const el = target as HTMLElement | null;
  return !!el && grid.contains(el) && el.getAttribute?.("role") === "gridcell";
}

/**
 * Whether a voice should fire on this step: not a stereo-linked secondary,
 * not muted, step on, and its A:B condition met this cycle.
 */
function isVoiceDue(args: {
  cycleCount: number;
  step: number;
  stepPattern: number[][];
  stereoLinks?: StereoLinks;
  triggerConditions?: (null | string)[][];
  voiceIdx: number;
  voiceMutes: Record<number, boolean>;
}): boolean {
  const { cycleCount, step, stepPattern, stereoLinks, voiceIdx } = args;
  const voiceNumber = voiceIdx + 1;
  // Secondary voices that are stereo-linked play through their primary
  if (stereoLinks?.linkedSecondaries.has(voiceNumber)) return false;
  if (args.voiceMutes[voiceNumber]) return false;
  if ((stepPattern[voiceIdx][step] ?? 0) <= 0) return false; // velocity > 0 = on
  const condition = (args.triggerConditions?.[voiceIdx]?.[step] ??
    null) as TriggerCondition;
  return shouldTrigger(condition, cycleCount);
}

/**
 * Controls where Space has its own meaning (typing, pressing a button,
 * ticking a box, opening a select). The grid and its step pads are not:
 * the grid's own handler turns Space into play/stop.
 */
function usesSpaceItself(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  const role = el.getAttribute?.("role");
  if (role === "grid" || role === "gridcell") return false;
  return (
    ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) ||
    el.isContentEditable === true
  );
}

// Slicer helpers for the step sequencer (see docs/developer/step-sequencer-slicer.md).
// Positions are stored in ticks (SLICE_TICKS per sample) and shown as slices
// of the kit-wide division, so changing the division never rewrites data.

import {
  normalizeSliceSteps,
  SLICE_TICKS,
  type SliceStep,
  type VoiceSliceSettings,
} from "@romper/shared/sliceTypes";

import { NUM_STEPS, NUM_VOICES } from "./stepPatternConstants";

/** A random number source in [0, 1). Injectable so tests are deterministic. */
export type Rng = () => number;

/** Region of a sample to play, as fractions of its total length. */
export interface SliceRegion {
  length: number;
  start: number;
}

/** A slice step expressed in slices of the current division. */
export interface SliceView {
  lengthSlices: number;
  startSlice: number;
}

const defaultRng: Rng = () => Math.random(); // NOSONAR - not cryptographic, used for musical randomization

export function createEmptySliceSteps(): (null | SliceStep)[][] {
  return Array.from({ length: NUM_VOICES }, () =>
    new Array<null | SliceStep>(NUM_STEPS).fill(null),
  );
}

export const ensureValidSliceSteps = normalizeSliceSteps;

export interface RollOptions {
  amount: number; // percent of eligible steps to change
  division: number;
  maxLength: number;
  varyLength: boolean;
}

/** Build a slice step from slice numbers, clamping the length to the sample end. */
export function makeSliceStep(
  startSlice: number,
  lengthSlices: number,
  division: number,
  flags: Partial<Pick<SliceStep, "locked" | "random">> = {},
): SliceStep {
  const start = clamp(Math.floor(startSlice), 0, division - 1);
  const length = clamp(Math.round(lengthSlices), 1, division - start);
  return {
    length: (length * SLICE_TICKS) / division,
    locked: flags.locked ?? false,
    random: flags.random ?? false,
    start: (start * SLICE_TICKS) / division,
  };
}

/** Change a step's length by `delta` slices. */
export function nudgeLengthSlices(
  step: SliceStep,
  delta: number,
  division: number,
): SliceStep {
  const { lengthSlices } = toSliceView(step, division);
  return setLengthSlices(step, lengthSlices + delta, division);
}

/** Move a step's start by `delta` slices, wrapping round the sample. */
export function nudgeStartSlice(
  step: SliceStep,
  delta: number,
  division: number,
): SliceStep {
  const { startSlice } = toSliceView(step, division);
  return setStartSlice(step, mod(startSlice + delta, division), division);
}

/** Pick a random slice (and, if asked, a random length). */
export function randomSliceView(
  division: number,
  lengthSlices: number,
  settings: Pick<VoiceSliceSettings, "maxLength" | "varyLength">,
  rng: Rng = defaultRng,
): SliceView {
  const startSlice = Math.floor(rng() * division);
  const length = settings.varyLength
    ? 1 + Math.floor(rng() * settings.maxLength)
    : lengthSlices;
  return {
    lengthSlices: clamp(length, 1, division - startSlice),
    startSlice,
  };
}

/**
 * Work out what a step plays when it fires: its stored slice, a fresh random
 * slice for live-random steps, or the sequential default when it has no data.
 */
export function resolveTriggeredSlice(
  step: null | SliceStep,
  stepIdx: number,
  division: number,
  settings: Pick<VoiceSliceSettings, "maxLength" | "varyLength">,
  rng: Rng = defaultRng,
): SliceView {
  const stored = toSliceView(
    step ?? sequentialSliceStep(stepIdx, division),
    division,
  );
  if (step?.random) {
    return randomSliceView(division, stored.lengthSlices, settings, rng);
  }
  return stored;
}

/**
 * Re-roll a voice's slices. Only active, unlocked, non-live-random steps are
 * eligible; `amount` percent of them (at least one) get a new random slice.
 */
export function rollSliceRow(
  row: (null | SliceStep)[],
  activeRow: boolean[],
  options: RollOptions,
  rng: Rng = defaultRng,
): { rolled: number[]; row: (null | SliceStep)[] } {
  const { amount, division } = options;
  const eligible = row
    .map((cell, stepIdx) => ({ cell, stepIdx }))
    .filter(
      ({ cell, stepIdx }) =>
        activeRow[stepIdx] && !cell?.locked && !cell?.random,
    )
    .map(({ stepIdx }) => stepIdx);

  if (eligible.length === 0) return { rolled: [], row };

  const count = Math.max(
    1,
    Math.min(eligible.length, Math.ceil((amount / 100) * eligible.length)),
  );

  // Partial Fisher-Yates shuffle to choose which eligible steps change
  const pool = [...eligible];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const rolled = pool.slice(0, count).sort((a, b) => a - b);

  const next = [...row];
  for (const stepIdx of rolled) {
    const current = row[stepIdx] ?? sequentialSliceStep(stepIdx, division);
    const { lengthSlices } = toSliceView(current, division);
    const view = randomSliceView(division, lengthSlices, options, rng);
    next[stepIdx] = makeSliceStep(
      view.startSlice,
      view.lengthSlices,
      division,
      current,
    );
  }
  return { rolled, row: next };
}

/**
 * The default for step n: slice n (wrapping), one slice long. Steps without
 * stored slice data play this, so a sliced loop at /16 plays back as the
 * original loop until you change it.
 */
export function sequentialSliceStep(
  stepIdx: number,
  division: number,
): SliceStep {
  return makeSliceStep(stepIdx % division, 1, division);
}

/** Change a step's length in slices (1 … slices left to the sample end). */
export function setLengthSlices(
  step: SliceStep,
  lengthSlices: number,
  division: number,
): SliceStep {
  const { startSlice } = toSliceView(step, division);
  return makeSliceStep(startSlice, lengthSlices, division, step);
}

/** Change a step's start slice, keeping its length where it fits. */
export function setStartSlice(
  step: SliceStep,
  startSlice: number,
  division: number,
): SliceStep {
  const { lengthSlices } = toSliceView(step, division);
  return makeSliceStep(startSlice, lengthSlices, division, step);
}

/** The part of the sample a slice view plays, clipped at the sample end. */
export function sliceRegion(view: SliceView, division: number): SliceRegion {
  const lengthSlices = Math.min(view.lengthSlices, division - view.startSlice);
  return {
    length: lengthSlices / division,
    start: view.startSlice / division,
  };
}

/** Express a stored step in slices of the given division. */
export function toSliceView(step: SliceStep, division: number): SliceView {
  const startSlice = clamp(
    Math.floor((step.start * division) / SLICE_TICKS),
    0,
    division - 1,
  );
  const lengthSlices = Math.max(
    1,
    Math.round((step.length * division) / SLICE_TICKS),
  );
  return { lengthSlices, startSlice };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

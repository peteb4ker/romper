// Shared types for the step sequencer slicer (see docs/developer/step-sequencer-slicer.md)

/**
 * Slice positions are stored in ticks of a fixed 384-per-sample grid.
 * 384 is the least common multiple of every offered division, so each
 * division's slice boundaries fall exactly on a tick and changing the
 * division never rewrites stored data.
 */
export const SLICE_TICKS = 384;

/**
 * Division options: the SLICER values in the Rample manual (Advanced
 * parameters: "/8, /16, /32, /64, /128, /12, /24, /48"), without EXP.
 */
export const SLICER_DIVISIONS = [8, 12, 16, 24, 32, 48, 64, 128] as const;
export type SlicerDivision = (typeof SLICER_DIVISIONS)[number];
export const DEFAULT_SLICER_DIVISION: SlicerDivision = 16;

/** Per-step slice data. */
export interface SliceStep {
  length: number; // ticks, 1 … SLICE_TICKS
  locked: boolean; // skipped by rolls
  random: boolean; // picks a new random slice every time the step fires
  start: number; // ticks, 0 … SLICE_TICKS - 1
}

/** Per-voice slicer settings. */
export interface VoiceSliceSettings {
  enabled: boolean;
  maxLength: number; // slices, 1 | 2 | 4 | 8
  rollAmount: number; // percent, 25 | 50 | 75 | 100
  varyLength: boolean;
}

export const ROLL_AMOUNTS = [25, 50, 75, 100] as const;
export const MAX_LENGTH_OPTIONS = [1, 2, 4, 8] as const;

export const DEFAULT_VOICE_SLICE_SETTINGS: VoiceSliceSettings = {
  enabled: false,
  maxLength: 2,
  rollAmount: 100,
  varyLength: false,
};

const SLICE_VOICES = 4;
const SLICE_STEPS = 16;

export function isSlicerDivision(value: unknown): value is SlicerDivision {
  return (SLICER_DIVISIONS as readonly unknown[]).includes(value);
}

/**
 * Coerce stored or received slice data into a valid 4 x 16 grid.
 * Invalid cells become null; out-of-range ticks are clamped.
 */
export function normalizeSliceSteps(value: unknown): (null | SliceStep)[][] {
  const rows = Array.isArray(value) ? value : [];
  return Array.from({ length: SLICE_VOICES }, (_, v) => {
    const row: unknown[] = Array.isArray(rows[v]) ? rows[v] : [];
    return Array.from({ length: SLICE_STEPS }, (_, s) =>
      normalizeSliceStep(row[s]),
    );
  });
}

function clampInt(value: unknown, min: number, max: number): null | number {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeSliceStep(cell: unknown): null | SliceStep {
  if (!cell || typeof cell !== "object") return null;
  const c = cell as Record<string, unknown>;
  const start = clampInt(c.start, 0, SLICE_TICKS - 1);
  const length = clampInt(c.length, 1, SLICE_TICKS);
  if (start === null || length === null) return null;
  return {
    length,
    locked: c.locked === true,
    random: c.random === true,
    start,
  };
}

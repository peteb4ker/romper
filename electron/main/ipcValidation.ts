import {
  KIT_BPM_MAX,
  KIT_BPM_MIN,
  SAMPLE_GAIN_DB_MAX,
  SAMPLE_GAIN_DB_MIN,
  SAMPLE_MODES,
  SLOTS_PER_VOICE,
  VOICE_COUNT,
  VOICE_VOLUME_MAX,
  VOICE_VOLUME_MIN,
} from "@romper/shared/kitSettingLimits.js";

/**
 * Runtime checks for values the renderer sends over IPC (RE-25). Each
 * returns an error message, or null when the value is fine. TypeScript
 * types don't reach across the bridge, so a NaN, a fraction, a string or an
 * out-of-range number would otherwise be written as is.
 */

/** A kit's tempo: a whole number from 30 to 180 BPM */
export function bpmError(bpm: unknown): null | string {
  return wholeNumberInRange(bpm, KIT_BPM_MIN, KIT_BPM_MAX)
    ? null
    : `Tempo must be a whole number from ${KIT_BPM_MIN} to ${KIT_BPM_MAX} BPM, not ${describe(bpm)}`;
}

/**
 * The first error among several checks, as a failed DbResult, or null
 * when they all pass.
 */
export function firstError(
  ...errors: (null | string)[]
): { error: string; success: false } | null {
  const error = errors.find((e) => e !== null);
  return error ? { error, success: false } : null;
}

/** A sample's gain trim: -24 to +12 dB */
export function gainError(gainDb: unknown): null | string {
  return typeof gainDb === "number" &&
    Number.isFinite(gainDb) &&
    gainDb >= SAMPLE_GAIN_DB_MIN &&
    gainDb <= SAMPLE_GAIN_DB_MAX
    ? null
    : `Gain must be from ${SAMPLE_GAIN_DB_MIN} to +${SAMPLE_GAIN_DB_MAX} dB, not ${describe(gainDb)}`;
}

/** A voice's sample mode: first, random or round-robin */
export function sampleModeError(mode: unknown): null | string {
  return (SAMPLE_MODES as readonly unknown[]).includes(mode)
    ? null
    : `Sample mode must be ${SAMPLE_MODES.join(", ")}, not ${describe(mode)}`;
}

/** A slot index: a whole number from 0 to 11 */
export function slotNumberError(slotNumber: unknown): null | string {
  return wholeNumberInRange(slotNumber, 0, SLOTS_PER_VOICE - 1)
    ? null
    : `Slot must be a whole number from 0 to ${SLOTS_PER_VOICE - 1}, not ${describe(slotNumber)}`;
}

/** A voice number: a whole number from 1 to 4 */
export function voiceNumberError(voiceNumber: unknown): null | string {
  return wholeNumberInRange(voiceNumber, 1, VOICE_COUNT)
    ? null
    : `Voice must be a whole number from 1 to ${VOICE_COUNT}, not ${describe(voiceNumber)}`;
}

/** A voice's volume: a whole number from 0 to 100 */
export function volumeError(volume: unknown): null | string {
  return wholeNumberInRange(volume, VOICE_VOLUME_MIN, VOICE_VOLUME_MAX)
    ? null
    : `Volume must be a whole number from ${VOICE_VOLUME_MIN} to ${VOICE_VOLUME_MAX}, not ${describe(volume)}`;
}

function describe(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  return value === null ? "null" : typeof value;
}

function wholeNumberInRange(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

// The kit file's fields the "On the Rample" section shows (#800), and how
// sure we are of what each means. The confirmation status comes from the
// key tables in docs/developer/rample-save-integration.md: a field stays
// "inferred" until its hardware check confirms it, and the section labels
// it as inferred until then.

import type { RampleDisplayValue } from "@romper/shared/rampleKitSaveView";
import type {
  RampleFirmwareGuess,
  RampleKitSave,
} from "@romper/shared/rampleSave";

import { RAMPLE_KIT_SAVE_KEYS } from "@romper/shared/rampleSave";

import { RAMPLE_SAVE_FIELD_LABELS, RAMPLE_SAVE_TEXT } from "./rampleSaveText";

/** What a field's label rests on */
export type RampleFieldMeaning = "confirmed" | "inferred";

export type RampleVoiceField = keyof typeof RAMPLE_SAVE_FIELD_LABELS;

/** A per-voice field: one value for each of the four voices. */
export interface RampleVoiceFieldInfo {
  /** The hardware check that would confirm its meaning */
  check: number;
  /** The key as the device writes it */
  deviceKey: string;
  field: RampleVoiceField;
  /** A knob position, probably 0-254 with 127 in the middle (check 3) */
  knob: boolean;
  label: string;
  meaning: RampleFieldMeaning;
}

/** A row of the per-voice table: a field and its four values. */
export interface RampleVoiceRow {
  info: RampleVoiceFieldInfo;
  /** One per voice, SP1-SP4; undefined where the file has none */
  values: (number | undefined)[];
}

export const RAMPLE_VOICES = [1, 2, 3, 4] as const;

const field = (
  name: RampleVoiceField,
  check: number,
  knob: boolean,
): RampleVoiceFieldInfo => ({
  check,
  deviceKey: RAMPLE_KIT_SAVE_KEYS[name],
  field: name,
  knob,
  label: RAMPLE_SAVE_FIELD_LABELS[name],
  meaning: "inferred",
});

/**
 * The per-voice fields: the knobs, then run mode, then the layer settings.
 * Every meaning is inferred so far.
 */
export const RAMPLE_VOICE_FIELDS: readonly RampleVoiceFieldInfo[] = [
  field("level", 3, true),
  field("pitch", 3, true),
  field("filter", 3, true),
  field("bitcrush", 3, true),
  field("freeze", 3, true),
  field("env", 3, true),
  field("start", 3, true),
  field("length", 3, true),
  field("loop", 4, true),
  field("layerModes", 12, false),
  field("selectedLayer", 12, false),
];

/** The kit-level fields: which check confirms each, and how sure we are. */
export const RAMPLE_KIT_FIELDS = {
  assignments: { check: 6, meaning: "inferred" },
  muteGroup: { check: 5, meaning: "inferred" },
} as const satisfies Record<
  "assignments" | "muteGroup",
  { check: number; meaning: RampleFieldMeaning }
>;

/** The highest knob value the device is thought to write (check 3) */
export const RAMPLE_KNOB_MAX = 254;
/** The knob's middle, probably (check 3) */
export const RAMPLE_KNOB_MIDDLE = 127;

/**
 * The release a firmware guess points to, for people: one release, or the
 * candidates in order ("2.00/3.00"); undefined when it points nowhere.
 */
export function firmwareRelease(
  guess: RampleFirmwareGuess | undefined,
): string | undefined {
  const candidates = guess?.candidates ?? [];
  return candidates.length > 0 ? candidates.join("/") : undefined;
}

/**
 * A value shown as the file has it: numbers, `true`, `false`, `null`,
 * quoted text, `[lists]` and `{maps}` in the file's order.
 */
export function formatRampleValue(value: RampleDisplayValue): string {
  if (value === null) return "null";
  if (Array.isArray(value))
    return `[${value.map(formatRampleValue).join(", ")}]`;
  if (typeof value === "object") {
    if ("opaque" in value) {
      return RAMPLE_SAVE_TEXT.opaqueValue(
        value.opaque.majorType,
        value.opaque.size,
      );
    }
    const entries = value.entries.map(
      ([key, item]) => `${key}: ${formatRampleValue(item)}`,
    );
    return `{${entries.join(", ")}}`;
  }
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

/** When a copy was taken, in the computer's language and time zone */
export function formatTakenAt(takenAt: string): string {
  return new Date(takenAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** The per-voice table's rows, one per field. */
export function voiceRows(values: RampleKitSave): RampleVoiceRow[] {
  return RAMPLE_VOICE_FIELDS.map((info) => {
    const list = values[info.field];
    return {
      info,
      values: RAMPLE_VOICES.map((voice) => list?.[voice - 1]),
    };
  });
}

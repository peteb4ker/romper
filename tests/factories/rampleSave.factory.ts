import type { RampleRawValue } from "@romper/shared/rampleSave";

import { encodeCbor } from "../../electron/main/rample/cbor";

// Synthetic `_save` files (#788), built to match the key sets and kinds of
// value a Rample on firmware 2.00 writes (docs/developer/
// rample-save-integration.md). Pete's real files aren't committed until
// decision D1; these stand in for them. Keys are in the device's order:
// plain byte order, which puts "assignments" before "env".

const four = (value: RampleRawValue): RampleRawValue[] => [
  value,
  value,
  value,
  value,
];

const assignment = (param: number, voice: number) =>
  new Map<string, RampleRawValue>([
    ["param", param],
    ["voice", voice],
  ]);

/** Bytes from a hex string, spaces ignored. */
export function hex(text: string): Uint8Array {
  const digits = text.replaceAll(/\s+/g, "");
  return Uint8Array.from(digits.match(/../g) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
}

/** global_assign.rpl: one `{param, voice}` per CV input. */
export function syntheticGlobalAssign(): RampleRawValue[] {
  return [0, 1, 2, 3].map((voice) => assignment(9, voice));
}

/** A kit file's map (`<kit>.rpl`), every knob in the middle unless overridden. */
export function syntheticKitSave(
  overrides: Record<string, RampleRawValue> = {},
): Map<string, RampleRawValue> {
  const map = new Map<string, RampleRawValue>([
    ["assignments", four(assignment(9, 0))],
    ["bitcrush", four(127)],
    ["env", four(127)],
    ["filter", [189, 127, 127, 127]],
    ["freeze", four(127)],
    ["layer_modes", four(1)],
    ["length", four(254)],
    ["level", [42, 127, 127, 127]],
    ["loop", [0, 127, 127, 127]],
    ["mute_group", four(four(false))],
    ["pitch", four(127)],
    ["selected_layer", [1, 0, 3, 2]],
    ["start", four(0)],
  ]);
  for (const [key, value] of Object.entries(overrides)) map.set(key, value);
  return map;
}

/** A synthetic `_save` folder's files, encoded. */
export function syntheticSaveFolder(): Record<string, Uint8Array> {
  return {
    "autosave_C1.rpl": new Uint8Array(0),
    "F7.rpl": encodeCbor(syntheticKitSave()),
    "global_assign.rpl": encodeCbor(syntheticGlobalAssign()),
    "L1.rpl": encodeCbor(
      syntheticKitSave({ filter: four(127), selected_layer: four(0) }),
    ),
    "settings.rpl": encodeCbor(syntheticSettings()),
  };
}

/** settings.rpl's map, as firmware 2.00 writes it. */
export function syntheticSettings(
  overrides: Record<string, RampleRawValue> = {},
): Map<string, RampleRawValue> {
  const map = new Map<string, RampleRawValue>([
    ["anti_clic", 1],
    ["assign", 0],
    ["autosave", 1],
    ["cv_in_range", 1],
    ["flip", 0],
    ["layerMode", 1],
    ["midi_channel_in", 8],
    ["midi_velocity", 0],
    ["note_sp1", 48],
    ["note_sp2", 49],
    ["note_sp3", 50],
    ["note_sp4", 51],
    ["pitch_tracking_chromatic", 0],
    ["receive_pitchbend", 0],
    ["receive_progchange", 1],
    ["slicer_quantize_postv200", 2],
    ["vu_meters", 1],
  ]);
  for (const [key, value] of Object.entries(overrides)) map.set(key, value);
  return map;
}

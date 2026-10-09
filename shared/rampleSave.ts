// What the Rample keeps in the `_save` folder at the card root, decoded
// (#788). Each non-empty file is one CBOR item (RFC 8949); the reader is
// electron/main/rample/. Most meanings are inferred, not confirmed on
// hardware, so the values here are the device's raw numbers. See
// docs/developer/rample-save-integration.md for the keys, what they
// probably mean, and the hardware checks that will confirm them.
//
// Every field is optional: a key the file doesn't have is undefined, never
// a default. Keys Romper doesn't know are kept in the decoded item (`raw`)
// and listed, so a later stage can write the file back unchanged.

/** `autosave_<kit>.rpl`: empty; its name records the last kit (inferred) */
export interface RampleAutosaveFile extends RampleSaveFileCommon {
  kind: "autosave";
  kitName: string;
}

/** A CV assignment: `{param, voice}` in a kit file or `global_assign.rpl`. */
export interface RampleCvAssignment {
  /** `param`: what the CV input controls (9 seen; meanings unconfirmed) */
  param?: number;
  /** `voice`: which voice it controls (0-3 seen; "all" unconfirmed) */
  voice?: number;
}

/** The device settings (`_save/settings.rpl`, written by SAVE SETTINGS). */
export interface RampleDeviceSettings {
  /** `anti_clic` */
  antiClic?: number;
  /** `assign`: ASSIGN = KIT or GLOBAL */
  assign?: number;
  /** `autosave` */
  autosave?: number;
  /** `cv_in_range` */
  cvInRange?: number;
  /** `flip` */
  flip?: number;
  /** `layerMode`: the LAYER setting (camelCase on the device) */
  layerMode?: number;
  /** `midi_channel_in`: counted from 0 or 1, unconfirmed */
  midiChannelIn?: number;
  /** `midi_velocity` */
  midiVelocity?: number;
  /** `note_sp1` */
  noteSp1?: number;
  /** `note_sp2` */
  noteSp2?: number;
  /** `note_sp3` */
  noteSp3?: number;
  /** `note_sp4` */
  noteSp4?: number;
  /** `pitch_tracking_chromatic` */
  pitchTrackingChromatic?: number;
  /** `receive_pitchbend` */
  receivePitchbend?: number;
  /** `receive_progchange` */
  receiveProgchange?: number;
  /** `slicer_quantize_postv200`: SLICER, an index into its list */
  slicerQuantizePostV200?: number;
  /** `vu_meters` */
  vuMeters?: number;
}

export interface RampleFirmwareEvidence {
  key: string;
  present: boolean;
  says: string;
}

/**
 * Which firmware a file's keys point to. Always an inference: no file in
 * `_save` records a firmware or format version.
 */
export interface RampleFirmwareGuess {
  /** The lowest release the keys point to ("2.00"), if any */
  atLeast?: string;
  /** The release the keys say the file predates ("3.00"), if any */
  before?: string;
  /** The known releases in that range, oldest first; empty when unknown */
  candidates: string[];
  /** The keys the guess used, and what each one's presence or absence says */
  evidence: RampleFirmwareEvidence[];
  /** For a file with no marker of its own: the folder's guess */
  folder?: RampleFirmwareGuess;
  readonly inferred: true;
  /** For people: "2.00 (inferred: …)", or "unknown firmware" */
  label: string;
}

/** `global_assign.rpl`: the CV assignments used when ASSIGN = GLOBAL */
export interface RampleGlobalAssignFile extends RampleSaveFileCommon {
  kind: "globalAssign";
  values: RampleCvAssignment[];
}

/**
 * A kit's saved settings (`_save/<kit>.rpl`, written by STORE). Arrays hold
 * one value per voice, SP1-SP4. Knobs probably run 0-254 with 127 in the
 * middle (inferred).
 */
export interface RampleKitSave {
  /** `assignments`: the kit's CV assignments (ASSIGN = KIT), CV1-CV4 */
  assignments?: RampleCvAssignment[];
  /** `bitcrush`: the Bits knob */
  bitcrush?: number[];
  /** `env`: the envelope knob */
  env?: number[];
  /** `filter`: the filter knob */
  filter?: number[];
  /** `freeze`: the Freeze knob */
  freeze?: number[];
  /** `layer_modes`: each voice's layer mode */
  layerModes?: number[];
  /** `length`: sample length; 254 is full length (inferred) */
  length?: number[];
  /** `level`: Levels/Drive; 127 is probably unity */
  level?: number[];
  /** `loop`: run mode, as a knob value */
  loop?: number[];
  /** `mute_group`: 4 rows of 4; which way round is unconfirmed */
  muteGroup?: boolean[][];
  /** `pitch`: the pitch knob; 127 is no transposition (inferred) */
  pitch?: number[];
  /** `selected_layer`: the layer MANUAL mode plays, from 0 */
  selectedLayer?: number[];
  /** `start`: start point; 0 is the start of the sample */
  start?: number[];
}

/** `<kit>.rpl` */
export interface RampleKitSaveFile extends RampleSaveFileCommon {
  kind: "kit";
  kitName: string;
  values: RampleKitSave;
}

/**
 * A CBOR item outside the subset the Rample writes (a float, a byte string,
 * a tag, a simple value other than true, false and null, an integer too big
 * for a JavaScript number, or a map with a key that isn't text). It's kept
 * whole, with its original bytes, so the file still re-encodes exactly.
 */
export interface RampleOpaqueItem {
  /** The item's bytes, head included, exactly as the file had them */
  readonly bytes: Uint8Array;
  /** The item's CBOR major type (0-7) */
  readonly majorType: number;
  readonly opaque: true;
}

/**
 * A decoded CBOR item. Maps decode to `Map`, never to plain objects, so
 * their keys stay in the file's order (JavaScript moves integer-like keys
 * of an object to the front).
 */
export type RampleRawValue =
  | boolean
  | Map<string, RampleRawValue>
  | null
  | number
  | RampleOpaqueItem
  | RampleRawValue[]
  | string;

/** When a copy of `_save` was taken (#786, stage 2) */
export type RampleSaveBackupReason = "setup" | "write";

/**
 * A copy of the card's `_save` folder in the store (#786, stage 2):
 * copied, the card had no `_save`, or it failed (setup or the write
 * carried on).
 */
export type RampleSaveBackupResult =
  | {
      /** The card stopped responding (the watchdog gave up) */
      cardNotResponding: boolean;
      error: string;
      status: "failed";
    }
  | {
      /** The copy's folder in the store */
      backupPath: string;
      /** The files copied, by name */
      files: string[];
      /** Older copies removed to keep the newest (see retention) */
      removedBackups: string[];
      /** Why retention couldn't remove older copies; the copy is fine */
      retentionError?: string;
      /** Entries in `_save` that weren't copied, and why */
      skipped: RampleSaveBackupSkip[];
      status: "copied";
    }
  | { status: "missing" };

/** An entry in `_save` a copy left out */
export interface RampleSaveBackupSkip {
  name: string;
  reason: string;
}

export type RampleSaveFile =
  | RampleAutosaveFile
  | RampleGlobalAssignFile
  | RampleKitSaveFile
  | RampleSettingsFile
  | RampleUnknownSaveFile;

/** What every file in the folder reports, whatever its kind. */
export interface RampleSaveFileCommon {
  fileName: string;
  /** The folder's guess for settings.rpl; "unknown" with the folder's for the rest */
  firmware: RampleFirmwareGuess;
  /** Keys a file of this kind has on the firmware seen so far, but this one hasn't */
  missingKeys: string[];
  /** Values of the wrong shape, and other things that don't fit the kind */
  problems: string[];
  /** The decoded item, every key in the file's order; undefined when unreadable or empty */
  raw?: RampleRawValue;
  /** True when encoding `raw` gives back the file's bytes exactly */
  reencodesExactly?: boolean;
  size: number;
  /** Keys Romper doesn't know, as paths (`zz_test`, `assignments[1].extra`) */
  unknownKeys: string[];
  /** Set when the file isn't a CBOR item Romper can decode */
  unreadable?: RampleSaveUnreadable;
}

export type RampleSaveFileKind = RampleSaveFile["kind"];

/** A `_save` folder, read. */
export interface RampleSaveFolder {
  /** Every entry, sorted by name */
  files: RampleSaveFile[];
  /** From `settings.rpl`'s keys; "unknown firmware" without one */
  firmware: RampleFirmwareGuess;
}

/** Why a file couldn't be decoded. */
export interface RampleSaveUnreadable {
  message: string;
  /** The byte offset the problem was found at, when there is one */
  offset?: number;
}

/** `settings.rpl` */
export interface RampleSettingsFile extends RampleSaveFileCommon {
  kind: "settings";
  values: RampleDeviceSettings;
}

/** Anything else in the folder, listed and left alone */
export interface RampleUnknownSaveFile extends RampleSaveFileCommon {
  kind: "unknown";
}

/** The kit file keys, by field, as the device spells them. */
export const RAMPLE_KIT_SAVE_KEYS = {
  assignments: "assignments",
  bitcrush: "bitcrush",
  env: "env",
  filter: "filter",
  freeze: "freeze",
  layerModes: "layer_modes",
  length: "length",
  level: "level",
  loop: "loop",
  muteGroup: "mute_group",
  pitch: "pitch",
  selectedLayer: "selected_layer",
  start: "start",
} as const satisfies Record<keyof RampleKitSave, string>;

/** The settings.rpl keys, by field, as the device spells them. */
export const RAMPLE_DEVICE_SETTINGS_KEYS = {
  antiClic: "anti_clic",
  assign: "assign",
  autosave: "autosave",
  cvInRange: "cv_in_range",
  flip: "flip",
  layerMode: "layerMode",
  midiChannelIn: "midi_channel_in",
  midiVelocity: "midi_velocity",
  noteSp1: "note_sp1",
  noteSp2: "note_sp2",
  noteSp3: "note_sp3",
  noteSp4: "note_sp4",
  pitchTrackingChromatic: "pitch_tracking_chromatic",
  receivePitchbend: "receive_pitchbend",
  receiveProgchange: "receive_progchange",
  slicerQuantizePostV200: "slicer_quantize_postv200",
  vuMeters: "vu_meters",
} as const satisfies Record<keyof RampleDeviceSettings, string>;

/** The keys of a `{param, voice}` CV assignment. */
export const RAMPLE_CV_ASSIGNMENT_KEYS = {
  param: "param",
  voice: "voice",
} as const satisfies Record<keyof RampleCvAssignment, string>;

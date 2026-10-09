// Every string the kit editor's "On the Rample" section shows (#800), in one
// place, so its wording can be reviewed and signed off together. Product
// wording is Pete's (CLAUDE.md, "Product decisions are mine").
//
// The values the section shows are the device's raw numbers. What most of
// them mean is inferred, not confirmed on hardware
// (docs/developer/rample-save-integration.md), so no string here may state
// an inferred meaning as fact.

export const RAMPLE_SAVE_TEXT = {
  /** Under "CV assignments" */
  cvAssignmentsNote:
    "Used when ASSIGN is set to KIT. What the numbers mean hasn't been checked on a Rample yet.",
  cvAssignmentsTitle: "CV assignments",
  /** A CV input's row in the CV assignments table, counted from 1 */
  cvInput: (input: number) => `CV${input}`,
  /** The firmware line: always an inference, and said to be one */
  firmware: (release: string) => `Firmware: ${release} (inferred)`,
  /** The firmware line's tooltip */
  firmwareTooltip:
    "No saved file records a firmware version. Romper infers it from the keys in the card's settings.rpl.",
  /** The firmware line when nothing points to a release */
  firmwareUnknown: "Firmware: unknown",
  /** Read after an inferred field's name, for screen readers */
  inferredSuffix: "(inferred)",
  /** A field whose meaning is inferred: its label's tooltip */
  inferredTooltip: (check: number) =>
    `Inferred meaning, not yet checked on a Rample (hardware check ${check})`,
  /** Main couldn't read the store's copy at all */
  loadError: (error: string) =>
    `Couldn't read the Rample's saved settings: ${error}`,
  /** While the kit's file is being read */
  loading: "Reading the saved settings…",
  /** The middle mark on a knob value's gauge: its tooltip */
  middleTooltip: "The line marks 127, probably the middle of the knob",
  /** Keys a kit file usually has but this one hasn't */
  missingKeys: (keys: string) => `Not in the file: ${keys}`,
  /** A value the file doesn't have */
  missingValue: "—",
  missingValueTooltip: "Not in the file",
  /** A mute-group cell, for screen readers */
  muteCell: (row: number, column: number, value: boolean) =>
    `Row ${row}, column ${column}: ${value ? "true" : "false"}`,
  /** Under "Mute groups" */
  muteGroupsNote:
    "Rows and columns are voices 1–4. Which way round they go hasn't been checked on a Rample yet.",
  muteGroupsTitle: "Mute groups",
  /** The store has no copy of the card's _save folder yet */
  noCopy:
    "Romper hasn't copied the Rample's saved settings from the card yet. It copies them when you set up from a card and before each write.",
  /** The latest copy has no file for the kit */
  noFile: (kitName: string) =>
    `The card had no saved settings for ${kitName} when Romper last copied them. The Rample saves a kit's settings when you STORE it on the device.`,
  /** An item outside what the Rample is known to write */
  opaqueValue: (majorType: number, size: number) =>
    `(CBOR item of type ${majorType}, ${size} bytes)`,
  /** Under "Other values" */
  otherValuesNote: "Values Romper doesn't know yet, as the file has them.",
  otherValuesTitle: "Other values",
  /** Next to a known key whose value isn't the shape the device writes */
  otherValueUnexpected: "unexpected shape",
  /** Under the section title, when the kit's file was read */
  rawValuesNote:
    "Raw values, as the Rample stores them. Knobs probably run from 0 to 254, with 127 in the middle. Names with a dotted underline are Romper's best guess at what each value is.",
  /** Where the values came from */
  readFrom: (takenAt: string) => `Read from the card on ${takenAt}`,
  /** Where the values came from, when the copy's date isn't known */
  readFromUndated: "Read from the card",
  /** The section's title, and its toggle's name */
  title: "On the Rample",
  /** Why main couldn't say, when it gave no reason */
  unknownError: "unknown error",
  /** The kit's file couldn't be decoded */
  unreadable: (kitName: string) =>
    `Romper couldn't read the Rample's saved settings for ${kitName}.`,
  /** The reader's reason, under the unreadable message */
  unreadableDetail: (fileName: string, reason: string) =>
    `${fileName}: ${reason}`,
  /** A voice's column, counted from 1 */
  voice: (voice: number) => `Voice ${voice}`,
  /** The per-voice table's caption, for screen readers */
  voiceTableCaption: "Saved settings per voice",
} as const;

/** Each per-voice field's label, as the kit editor shows it. */
export const RAMPLE_SAVE_FIELD_LABELS = {
  bitcrush: "Bits",
  env: "Envelope",
  filter: "Filter",
  freeze: "Freeze",
  layerModes: "Layer mode",
  length: "Length",
  level: "Level",
  loop: "Run mode",
  pitch: "Pitch",
  selectedLayer: "Selected layer",
  start: "Start",
} as const;

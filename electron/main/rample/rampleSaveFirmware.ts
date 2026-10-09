// Which firmware wrote a `_save` folder, inferred from the keys in its
// settings.rpl (#788). No file records a version, so this is always a
// guess, labeled as one, with the keys it used. See
// docs/developer/rample-save-integration.md, "Firmware versions".

import type {
  RampleFirmwareEvidence,
  RampleFirmwareGuess,
} from "@romper/shared/rampleSave.js";

import { RAMPLE_DEVICE_SETTINGS_KEYS } from "@romper/shared/rampleSave.js";

/** The releases the firmware matrix lists, oldest first. */
export const RAMPLE_FIRMWARE_RELEASES = [
  "1.1",
  "1.2",
  "1.3",
  "1.4",
  "1.50",
  "2.00",
  "3.00",
] as const;

type Release = (typeof RAMPLE_FIRMWARE_RELEASES)[number];

/**
 * settings.rpl keys that first appeared in a release (from the changelog),
 * so their presence means that release or later.
 */
const ADDED_IN: readonly { key: string; release: Release; what: string }[] = [
  { key: "anti_clic", release: "1.1", what: "ANTICLIC" },
  { key: "autosave", release: "1.2", what: "AUTOSAVE" },
  { key: "layerMode", release: "1.3", what: "the LAYER default" },
  { key: "assign", release: "1.3", what: "ASSIGN = KIT or GLOBAL" },
  { key: "flip", release: "1.50", what: "FLIP" },
  {
    key: "slicer_quantize_postv200",
    release: "2.00",
    what: "the SLICER list 2.00 rewrote",
  },
];

const SLICER_2_00 = "slicer_quantize_postv200";

/** Every settings.rpl key a firmware before 3.00 is known to write. */
const KNOWN_SETTINGS_KEYS: ReadonlySet<string> = new Set(
  Object.values(RAMPLE_DEVICE_SETTINGS_KEYS),
);

/**
 * The likely firmware behind a settings.rpl with these keys:
 *
 * - the newest release whose key is present is the lowest it can be;
 * - no `slicer_quantize_postv200` means before 2.00;
 * - with it, and no key a known firmware doesn't write, before 3.00: 3.00
 *   saves its compressor and tape settings with the device settings, under
 *   names nobody has seen yet. Keys nobody knows leave 3.00 open.
 *
 * A key set with none of the known keys is "unknown firmware", never the
 * nearest match.
 */
export function guessFirmwareFromSettingsKeys(
  keys: Iterable<string>,
): RampleFirmwareGuess {
  const present = new Set(keys);
  const known = [...present].filter((key) => KNOWN_SETTINGS_KEYS.has(key));
  if (known.length === 0) {
    return unknownFirmware("no settings key a known firmware writes");
  }
  const unknownKeys = [...present].filter(
    (key) => !KNOWN_SETTINGS_KEYS.has(key),
  );

  const evidence: RampleFirmwareEvidence[] = [];
  let atLeast: Release | undefined;
  for (const { key, release, what } of ADDED_IN) {
    if (!present.has(key)) continue;
    evidence.push({
      key,
      present: true,
      says: `${release} or later (${what})`,
    });
    if (!atLeast || releaseIndex(release) > releaseIndex(atLeast)) {
      atLeast = release;
    }
  }

  let before: Release | undefined;
  if (present.has(SLICER_2_00)) {
    if (unknownKeys.length === 0) {
      before = "3.00";
      evidence.push({
        key: "(compressor and tape keys)",
        present: false,
        says: "before 3.00, which saves them with the device settings",
      });
    }
  } else {
    before = "2.00";
    evidence.push({
      key: SLICER_2_00,
      present: false,
      says: "before 2.00, which saves SLICER under this key",
    });
  }
  for (const key of unknownKeys) {
    evidence.push({
      key,
      present: true,
      says: "no known firmware writes it (3.00's new keys would look like this)",
    });
  }

  const candidates = RAMPLE_FIRMWARE_RELEASES.filter(
    (release) =>
      (!atLeast || releaseIndex(release) >= releaseIndex(atLeast)) &&
      (!before || releaseIndex(release) < releaseIndex(before)),
  );
  return {
    ...(atLeast ? { atLeast } : {}),
    ...(before ? { before } : {}),
    candidates,
    evidence,
    inferred: true,
    label: firmwareLabel(candidates, atLeast, before),
  };
}

/** The guess when nothing points anywhere. */
export function unknownFirmware(
  reason: string,
  folder?: RampleFirmwareGuess,
): RampleFirmwareGuess {
  const label = folder
    ? `unknown (${reason}); the folder looks like ${folder.label}`
    : `unknown firmware (${reason})`;
  return {
    candidates: [],
    evidence: [],
    ...(folder ? { folder } : {}),
    inferred: true,
    label,
  };
}

function firmwareLabel(
  candidates: readonly string[],
  atLeast: string | undefined,
  before: string | undefined,
): string {
  const range = [
    atLeast ? `${atLeast} or later` : undefined,
    before ? `before ${before}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
  const likely = candidates.length === 1 ? candidates[0] : candidates.join("/");
  return `${likely} (inferred from settings.rpl's keys: ${range})`;
}

function releaseIndex(release: Release): number {
  return RAMPLE_FIRMWARE_RELEASES.indexOf(release);
}

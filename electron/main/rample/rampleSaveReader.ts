// Reads the Rample's `_save` folder (#788), read-only: nothing here writes
// to a card or to `_save`. Each file is recognized by its name, decoded
// with the in-house CBOR codec and checked against the keys the device is
// known to write. It's tolerant: a missing key is undefined, an unknown key
// is kept (in `raw`) and listed, and a value of the wrong shape is reported,
// not thrown. A file that can't be decoded is reported as unreadable, with
// the reason, never read as defaults. See
// docs/developer/rample-save-integration.md, stage 1b.

import type {
  RampleCvAssignment,
  RampleDeviceSettings,
  RampleFirmwareGuess,
  RampleKitSave,
  RampleRawValue,
  RampleSaveFile,
  RampleSaveFileCommon,
  RampleSaveFolder,
} from "@romper/shared/rampleSave.js";

import { kitNameOfCardFolder } from "@romper/shared/rampleCardLayout.js";
import {
  RAMPLE_CV_ASSIGNMENT_KEYS,
  RAMPLE_DEVICE_SETTINGS_KEYS,
  RAMPLE_KIT_SAVE_KEYS,
} from "@romper/shared/rampleSave.js";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  CborDecodeError,
  decodeCbor,
  DEFAULT_CBOR_LIMITS,
  encodeCbor,
  isOpaqueItem,
} from "./cbor.js";
import {
  guessFirmwareFromSettingsKeys,
  unknownFirmware,
} from "./rampleSaveFirmware.js";

/** What a file's name says it is. */
export type RampleSaveFileName =
  | { kind: "autosave"; kitName: string }
  | { kind: "globalAssign" }
  | { kind: "kit"; kitName: string }
  | { kind: "settings" }
  | { kind: "unknown" };

/** A folder entry: its bytes when it's a regular file small enough to read */
interface FolderEntry {
  bytes?: Uint8Array;
  name: string;
  size: number;
  /** Why a regular file wasn't read */
  tooBig?: string;
}

/** How a map's known keys are read: field, the device's key, and its shape */
interface KeySpec<T> {
  field: keyof T;
  key: string;
  shape: Shape;
}

type Shape = "assignments" | "muteGroup" | "uint" | "voices";

const VOICES = 4;
const AUTOSAVE_NAME = /^autosave_(.+)\.rpl$/i;
const KIT_FILE_NAME = /^(.+)\.rpl$/i;

const KIT_SPEC = specOf<RampleKitSave>(RAMPLE_KIT_SAVE_KEYS, {
  assignments: "assignments",
  muteGroup: "muteGroup",
});
const SETTINGS_SPEC = specOf<RampleDeviceSettings>(
  RAMPLE_DEVICE_SETTINGS_KEYS,
  {},
  "uint",
);
const CV_ASSIGNMENT_SPEC = specOf<RampleCvAssignment>(
  RAMPLE_CV_ASSIGNMENT_KEYS,
  {},
  "uint",
);

interface Report {
  missingKeys: string[];
  problems: string[];
  unknownKeys: string[];
}

/** What a file in `_save` is, from its name, compared ignoring case. */
export function classifyRampleSaveFileName(
  fileName: string,
): RampleSaveFileName {
  const lower = fileName.toLowerCase();
  if (lower === "settings.rpl") return { kind: "settings" };
  if (lower === "global_assign.rpl") return { kind: "globalAssign" };
  const autosave = AUTOSAVE_NAME.exec(fileName);
  const autosaveKit = autosave && kitNameOfCardFolder(autosave[1]);
  if (autosaveKit) return { kind: "autosave", kitName: autosaveKit };
  const kit = KIT_FILE_NAME.exec(fileName);
  const kitName = kit && kitNameOfCardFolder(kit[1]);
  if (kitName) return { kind: "kit", kitName };
  return { kind: "unknown" };
}

/**
 * Decode one file from `_save`. `folderFirmware` is the folder's guess,
 * which a file without a firmware marker of its own (every file but
 * settings.rpl) reports beside its own "unknown".
 */
export function readRampleSaveFile(
  fileName: string,
  bytes: Uint8Array,
  folderFirmware?: RampleFirmwareGuess,
): RampleSaveFile {
  const name = classifyRampleSaveFileName(fileName);
  const common: RampleSaveFileCommon = {
    fileName,
    firmware: unknownFirmware(noMarkerReason(name.kind), folderFirmware),
    missingKeys: [],
    problems: [],
    size: bytes.length,
    unknownKeys: [],
  };

  // Only an autosave file is empty; anything else empty is unreadable,
  // except a file Romper doesn't know, which is only listed
  if (
    bytes.length === 0 &&
    (name.kind === "autosave" || name.kind === "unknown")
  ) {
    return withEmptyValues(name, common);
  }

  let raw: RampleRawValue;
  try {
    raw = decodeCbor(bytes);
  } catch (error) {
    if (!(error instanceof CborDecodeError)) throw error;
    return withEmptyValues(name, {
      ...common,
      unreadable: { message: error.message, offset: error.offset },
    });
  }
  const decoded = {
    ...common,
    raw,
    reencodesExactly: sameBytes(encodeCbor(raw), bytes),
  };

  switch (name.kind) {
    case "autosave":
      decoded.problems.push("An autosave file is expected to be empty");
      return { ...decoded, ...name };
    case "globalAssign":
      return {
        ...decoded,
        kind: "globalAssign",
        values: readAssignments(raw, "", decoded),
      };
    case "kit": {
      const values = readMap(raw, KIT_SPEC, "", decoded);
      flagForeignFile(decoded, "kit", KIT_SPEC.length);
      return { ...decoded, ...name, values };
    }
    case "settings": {
      const values = readMap(raw, SETTINGS_SPEC, "", decoded);
      flagForeignFile(decoded, "settings", SETTINGS_SPEC.length);
      return {
        ...decoded,
        firmware:
          raw instanceof Map
            ? guessFirmwareFromSettingsKeys(raw.keys())
            : unknownFirmware("settings.rpl isn't a map of settings"),
        kind: "settings",
        values,
      };
    }
    default:
      return { ...decoded, kind: "unknown" };
  }
}

/**
 * Read every file in a `_save` folder, sorted by name. Only regular files
 * are read, each only if it's within the decoder's size limit; folders,
 * links and anything else are listed as unknown. Nothing is written.
 */
export async function readRampleSaveFolder(
  folderPath: string,
): Promise<RampleSaveFolder> {
  const entries = await fs.promises.readdir(folderPath, {
    withFileTypes: true,
  });
  entries.sort((a, b) => compareBytes(a.name, b.name));

  // A handful of files of a few hundred bytes each, so read together
  const contents = await Promise.all(
    entries.map((entry) => readEntry(folderPath, entry)),
  );

  const settings = contents.find(
    ({ bytes, name }) =>
      bytes && classifyRampleSaveFileName(name).kind === "settings",
  );
  const settingsFile =
    settings?.bytes && readRampleSaveFile(settings.name, settings.bytes);
  const firmware = settingsFile
    ? settingsFile.firmware
    : unknownFirmware("no settings.rpl");

  const files = contents.map((entry): RampleSaveFile => {
    if (entry.bytes) {
      return readRampleSaveFile(entry.name, entry.bytes, firmware);
    }
    const common: RampleSaveFileCommon = {
      fileName: entry.name,
      firmware: unknownFirmware(noMarkerReason("unknown"), firmware),
      missingKeys: [],
      problems: [],
      size: entry.size,
      unknownKeys: [],
    };
    if (entry.tooBig) {
      return withEmptyValues(classifyRampleSaveFileName(entry.name), {
        ...common,
        unreadable: { message: entry.tooBig },
      });
    }
    common.problems.push("Not a regular file; not read");
    return { ...common, kind: "unknown" };
  });
  return { files, firmware };
}

/** Byte order, as the device orders keys; not `localeCompare` */
function compareBytes(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function describeValue(value: RampleRawValue | undefined): string {
  if (value === undefined) return "nothing";
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (value instanceof Map) return "a map";
  if (isOpaqueItem(value))
    return `an item of CBOR major type ${value.majorType}`;
  return `${typeof value} ${JSON.stringify(value)}`;
}

/** A file whose keys are all unknown is probably another kind of file */
function flagForeignFile(
  file: { missingKeys: string[]; problems: string[]; unknownKeys: string[] },
  kind: string,
  expected: number,
): void {
  if (file.missingKeys.length === expected && file.unknownKeys.length > 0) {
    file.problems.push(
      `None of a ${kind} file's keys: it may be another kind of file`,
    );
  }
}

function isUint(value: RampleRawValue | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function noMarkerReason(kind: RampleSaveFile["kind"]): string {
  switch (kind) {
    case "autosave":
      return "autosave files have no firmware marker";
    case "globalAssign":
      return "global_assign.rpl has no firmware marker";
    case "kit":
      return "kit files have no firmware marker";
    case "settings":
      return "settings.rpl couldn't be read";
    default:
      return "not a file the Rample is known to write";
  }
}

/** A `{param, voice}` list: global_assign.rpl, or a kit's `assignments` */
function readAssignments(
  value: RampleRawValue | undefined,
  at: string,
  report: Report,
): RampleCvAssignment[] {
  if (!Array.isArray(value)) {
    report.problems.push(
      `${at || "The file"}: expected a list of CV assignments, found ${describeValue(value)}`,
    );
    return [];
  }
  return value.map((item, i) =>
    readMap(item, CV_ASSIGNMENT_SPEC, `${at}[${i}]`, report),
  );
}

async function readEntry(
  folderPath: string,
  entry: fs.Dirent,
): Promise<FolderEntry> {
  const name = entry.name;
  if (!entry.isFile()) return { name, size: 0 };
  const filePath = path.join(folderPath, name);
  const { size } = await fs.promises.stat(filePath);
  if (size > DEFAULT_CBOR_LIMITS.maxBytes) {
    return {
      name,
      size,
      tooBig: `The file is ${size} bytes, more than the ${DEFAULT_CBOR_LIMITS.maxBytes} a save file can be; not read`,
    };
  }
  const bytes = new Uint8Array(await fs.promises.readFile(filePath));
  return { bytes, name, size };
}

/**
 * The known keys of a map, by field. Unknown keys go to `unknownKeys`,
 * missing ones to `missingKeys`, wrong shapes to `problems`, all as paths.
 */
function readMap<T>(
  value: RampleRawValue | undefined,
  spec: readonly KeySpec<T>[],
  at: string,
  report: Report,
): T {
  const values: Partial<Record<keyof T, unknown>> = {};
  if (!(value instanceof Map)) {
    report.problems.push(
      `${at || "The file"}: expected a map, found ${describeValue(value)}`,
    );
    return values as T;
  }
  const prefix = at ? `${at}.` : "";
  const byKey = new Map(spec.map((keySpec) => [keySpec.key, keySpec]));
  // In the file's order, so what's reported reads like the file
  for (const [key, item] of value) {
    const keySpec = byKey.get(key);
    if (!keySpec) {
      report.unknownKeys.push(`${prefix}${key}`);
      continue;
    }
    const read = readShape(item, keySpec.shape, `${prefix}${key}`, report);
    if (read !== undefined) values[keySpec.field] = read;
  }
  for (const { key } of spec) {
    if (!value.has(key)) report.missingKeys.push(`${prefix}${key}`);
  }
  return values as T;
}

function readShape(
  value: RampleRawValue | undefined,
  shape: Shape,
  at: string,
  report: Report,
): unknown {
  switch (shape) {
    case "assignments":
      return readAssignments(value, at, report);
    case "muteGroup": {
      const rows = readVoiceList(value, at, report, (row) =>
        Array.isArray(row) && row.every((cell) => typeof cell === "boolean")
          ? (row as boolean[])
          : undefined,
      );
      for (const [i, row] of (rows ?? []).entries()) {
        if (row.length !== VOICES) {
          report.problems.push(
            `${at}[${i}]: expected ${VOICES} items, found ${row.length}`,
          );
        }
      }
      return rows;
    }
    case "uint":
      if (isUint(value)) return value;
      report.problems.push(
        `${at}: expected an unsigned integer, found ${describeValue(value)}`,
      );
      return undefined;
    default: // voices
      return readVoiceList(value, at, report, (item) =>
        isUint(item) ? item : undefined,
      );
  }
}

/**
 * A per-voice list. Each item is read by `readItem`; a list with an item
 * it can't read is reported and left out. A length other than 4 is
 * reported, and the list kept.
 */
function readVoiceList<T>(
  value: RampleRawValue | undefined,
  at: string,
  report: Report,
  readItem: (item: RampleRawValue) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value)) {
    report.problems.push(
      `${at}: expected a list, found ${describeValue(value)}`,
    );
    return undefined;
  }
  const items: T[] = [];
  for (const [i, item] of value.entries()) {
    const read = readItem(item);
    if (read === undefined) {
      report.problems.push(`${at}[${i}]: unexpected ${describeValue(item)}`);
      return undefined;
    }
    items.push(read);
  }
  if (items.length !== VOICES) {
    report.problems.push(
      `${at}: expected ${VOICES} items, found ${items.length}`,
    );
  }
  return items;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

function specOf<T>(
  keys: Record<keyof T, string>,
  shapes: Partial<Record<keyof T, Shape>>,
  fallback: Shape = "voices",
): KeySpec<T>[] {
  return (Object.keys(keys) as (keyof T)[]).map((field) => ({
    field,
    key: keys[field],
    shape: shapes[field] ?? fallback,
  }));
}

function withEmptyValues(
  name: RampleSaveFileName,
  common: RampleSaveFileCommon,
): RampleSaveFile {
  switch (name.kind) {
    case "globalAssign":
      return { ...common, kind: "globalAssign", values: [] };
    case "kit":
      return { ...common, ...name, values: {} };
    case "settings":
      return {
        ...common,
        firmware: unknownFirmware("settings.rpl couldn't be read"),
        kind: "settings",
        values: {},
      };
    default:
      return { ...common, ...name };
  }
}

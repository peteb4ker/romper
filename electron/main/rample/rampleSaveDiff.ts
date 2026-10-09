// Printing a decoded `_save` folder, and the differences between two
// copies of one (#788). Used by `npm run rample:save`, which makes each
// hardware check in docs/developer/rample-save-integration.md a one-line
// compare.

import type {
  RampleRawValue,
  RampleSaveFile,
  RampleSaveFolder,
} from "@romper/shared/rampleSave.js";

import { isOpaqueItem } from "./cbor.js";

/** One value that differs: `before` or `after` is missing when the other copy lacks it */
export interface RampleSaveChange {
  after?: string;
  before?: string;
  path: string;
}

/** How one file differs between two copies of a folder. */
export interface RampleSaveFileDiff {
  changes: RampleSaveChange[];
  fileName: string;
  status: "added" | "changed" | "removed";
}

/** The files that differ between two copies of a `_save` folder. */
export function diffRampleSaveFolders(
  before: RampleSaveFolder,
  after: RampleSaveFolder,
): RampleSaveFileDiff[] {
  const beforeFiles = byName(before.files);
  const afterFiles = byName(after.files);
  const names = [...new Set([...afterFiles.keys(), ...beforeFiles.keys()])];
  names.sort(compareBytes);

  const diffs: RampleSaveFileDiff[] = [];
  for (const name of names) {
    const a = beforeFiles.get(name);
    const b = afterFiles.get(name);
    if (!a || !b) {
      const file = (a ?? b) as RampleSaveFile;
      diffs.push({
        changes: [],
        fileName: file.fileName,
        status: a ? "removed" : "added",
      });
      continue;
    }
    const changes = [...diffRawValues(a.raw, b.raw), ...diffUnreadable(a, b)];
    if (changes.length > 0) {
      diffs.push({ changes, fileName: b.fileName, status: "changed" });
    }
  }
  return diffs;
}

/** The values that differ between two decoded items, as paths (`level[0]`). */
export function diffRawValues(
  before: RampleRawValue | undefined,
  after: RampleRawValue | undefined,
  at = "",
): RampleSaveChange[] {
  if (sameValue(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const changes: RampleSaveChange[] = [];
    for (let i = 0; i < Math.max(before.length, after.length); i++) {
      changes.push(...diffRawValues(before[i], after[i], `${at}[${i}]`));
    }
    return changes;
  }
  if (before instanceof Map && after instanceof Map) {
    const changes: RampleSaveChange[] = [];
    const prefix = at ? `${at}.` : "";
    // The first copy's keys in its order, then keys only the second has
    const keys = [...before.keys()];
    for (const key of after.keys()) {
      if (!before.has(key)) keys.push(key);
    }
    for (const key of keys) {
      changes.push(
        ...diffRawValues(before.get(key), after.get(key), `${prefix}${key}`),
      );
    }
    if (changes.length === 0) {
      // Same keys and values, in another order: that changes the bytes
      changes.push({
        after: [...after.keys()].join(", "),
        before: [...before.keys()].join(", "),
        path: `${at || "(top)"} key order`,
      });
    }
    return changes;
  }
  return [
    {
      ...(after === undefined ? {} : { after: formatRawValue(after) }),
      ...(before === undefined ? {} : { before: formatRawValue(before) }),
      path: at || "(top)",
    },
  ];
}

/** A diff for people, one line per change. */
export function formatRampleSaveDiff(
  before: RampleSaveFolder,
  after: RampleSaveFolder,
): string[] {
  const lines = [
    `Firmware before: ${before.firmware.label}`,
    `Firmware after: ${after.firmware.label}`,
    "",
  ];
  const diffs = diffRampleSaveFolders(before, after);
  if (diffs.length === 0) {
    lines.push("No differences.");
    return lines;
  }
  for (const diff of diffs) {
    if (diff.status === "changed") {
      lines.push(`${diff.fileName}: changed`);
      for (const change of diff.changes) {
        lines.push(
          `  ${change.path}: ${change.before ?? "(none)"} -> ${change.after ?? "(none)"}`,
        );
      }
    } else {
      lines.push(
        `${diff.fileName}: only in the ${diff.status === "added" ? "second" : "first"} folder`,
      );
    }
  }
  return lines;
}

/** A decoded folder for people: each file's keys in order, and what didn't fit. */
export function formatRampleSaveFolder(folder: RampleSaveFolder): string[] {
  const lines = [`Firmware: ${folder.firmware.label}`];
  for (const evidence of folder.firmware.evidence) {
    lines.push(
      `  ${evidence.key} ${evidence.present ? "present" : "absent"}: ${evidence.says}`,
    );
  }
  for (const file of folder.files) {
    lines.push("", `${file.fileName}: ${fileSummary(file)}`);
    if (file.raw instanceof Map) {
      for (const [key, value] of file.raw) {
        lines.push(`  ${key}: ${formatRawValue(value)}`);
      }
    } else if (file.raw !== undefined) {
      lines.push(`  ${formatRawValue(file.raw)}`);
    }
    const notes: [string, string[]][] = [
      ["unknown keys", file.unknownKeys],
      ["missing keys", file.missingKeys],
      ["problems", file.problems],
    ];
    for (const [label, items] of notes) {
      if (items.length > 0) lines.push(`  (${label}: ${items.join("; ")})`);
    }
    if (file.kind !== "settings") {
      lines.push(`  (firmware: ${file.firmware.label})`);
    }
  }
  return lines;
}

/** A value on one line: `[127, 127]`, `{param: 9, voice: 0}`, `"text"` */
export function formatRawValue(value: RampleRawValue): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatRawValue(item)).join(", ")}]`;
  }
  if (value instanceof Map) {
    const entries = [...value].map(
      ([key, item]) => `${key}: ${formatRawValue(item)}`,
    );
    return `{${entries.join(", ")}}`;
  }
  if (isOpaqueItem(value)) {
    const hex = [...value.bytes]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(" ");
    return `<CBOR major type ${value.majorType}: ${hex}>`;
  }
  return JSON.stringify(value);
}

/** Files by name, ignoring case as FAT32 does */
function byName(files: readonly RampleSaveFile[]): Map<string, RampleSaveFile> {
  return new Map(files.map((file) => [file.fileName.toLowerCase(), file]));
}

function compareBytes(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function diffUnreadable(
  a: RampleSaveFile,
  b: RampleSaveFile,
): RampleSaveChange[] {
  const before = a.unreadable?.message;
  const after = b.unreadable?.message;
  if (before === after) return [];
  return [
    {
      after: after ?? "readable",
      before: before ?? "readable",
      path: "(unreadable)",
    },
  ];
}

function fileSummary(file: RampleSaveFile): string {
  const kind = {
    autosave: "kitName" in file ? `autosave of kit ${file.kitName}` : "",
    globalAssign: "GLOBAL CV assignments",
    kit: "kitName" in file ? `saved settings of kit ${file.kitName}` : "",
    settings: "device settings",
    unknown: "not a file the Rample is known to write",
  }[file.kind];
  const parts = [kind, `${file.size} bytes`];
  if (file.unreadable) parts.push(`unreadable: ${file.unreadable.message}`);
  if (file.reencodesExactly !== undefined) {
    parts.push(
      file.reencodesExactly
        ? "re-encodes byte for byte"
        : "does NOT re-encode byte for byte",
    );
  }
  return parts.join(", ");
}

function sameValue(
  a: RampleRawValue | undefined,
  b: RampleRawValue | undefined,
): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  }
  if (a instanceof Map && b instanceof Map) {
    const aKeys = [...a.keys()];
    const bKeys = [...b.keys()];
    return (
      aKeys.length === bKeys.length &&
      aKeys.every(
        (key, i) => key === bKeys[i] && sameValue(a.get(key), b.get(key)),
      )
    );
  }
  if (isOpaqueItem(a) && isOpaqueItem(b)) {
    return (
      a.bytes.length === b.bytes.length &&
      a.bytes.every((byte, i) => byte === b.bytes[i])
    );
  }
  return false;
}

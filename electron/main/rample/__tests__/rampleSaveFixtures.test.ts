// @vitest-environment node

import type {
  RampleGlobalAssignFile,
  RampleKitSaveFile,
  RampleSaveFile,
  RampleSettingsFile,
} from "@romper/shared/rampleSave";

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  syntheticGlobalAssign,
  syntheticSettings,
} from "../../../../tests/factories/rampleSave.factory";
import { decodeCbor, encodeCbor } from "../cbor";
import { readRampleSaveFolder } from "../rampleSaveReader";

// Pete's real `_save` files (decision D1, #786), copied unchanged from his
// Rample's card. The firmware is inferred (2.00) until hardware check 1
// confirms it; see the folder's README.
const FW_2_00_INFERRED = path.resolve(
  __dirname,
  "../../../../tests/fixtures/rample-save/fw-2.00-inferred",
);

const NON_EMPTY = [
  "F7.rpl",
  "L1.rpl",
  "L4.rpl",
  "global_assign.rpl",
  "settings.rpl",
];

const fixture = (name: string) =>
  new Uint8Array(fs.readFileSync(path.join(FW_2_00_INFERRED, name)));

const byName = (files: RampleSaveFile[], name: string) =>
  files.find((file) => file.fileName === name);

const four = <T>(value: T): T[] => [value, value, value, value];

describe("[Q-08] the reader on a real Rample's _save files (#786)", () => {
  it("decodes all six files, with nothing unknown, missing or wrong", async () => {
    const { files } = await readRampleSaveFolder(FW_2_00_INFERRED);

    expect(files.map((file) => [file.fileName, file.kind])).toEqual([
      ["F7.rpl", "kit"],
      ["L1.rpl", "kit"],
      ["L4.rpl", "kit"],
      ["autosave_C1.rpl", "autosave"],
      ["global_assign.rpl", "globalAssign"],
      ["settings.rpl", "settings"],
    ]);
    for (const file of files) {
      expect(file.unreadable, file.fileName).toBeUndefined();
      expect(file.problems, file.fileName).toEqual([]);
      expect(file.unknownKeys, file.fileName).toEqual([]);
      expect(file.missingKeys, file.fileName).toEqual([]);
    }
  });

  it("guesses firmware 2.00 from settings.rpl, as an inference", async () => {
    const { files, firmware } = await readRampleSaveFolder(FW_2_00_INFERRED);

    expect(firmware.inferred).toBe(true);
    expect(firmware.atLeast).toBe("2.00");
    expect(firmware.before).toBe("3.00");
    expect(firmware.candidates).toEqual(["2.00"]);
    // A kit file has no marker of its own; it reports the folder's guess
    const kit = byName(files, "L1.rpl");
    expect(kit?.firmware.candidates).toEqual([]);
    expect(kit?.firmware.folder).toEqual(firmware);
  });

  it.each(NON_EMPTY)("re-encodes %s byte for byte", (name) => {
    const bytes = fixture(name);

    expect(bytes.length).toBeGreaterThan(0);
    expect(encodeCbor(decodeCbor(bytes))).toEqual(bytes);
  });

  it("says each non-empty file re-encodes exactly", async () => {
    const { files } = await readRampleSaveFolder(FW_2_00_INFERRED);

    expect(
      files
        .filter((file) => file.size > 0)
        .map((file) => [file.fileName, file.reencodesExactly]),
    ).toEqual(NON_EMPTY.map((name) => [name, true]));
    expect(byName(files, "autosave_C1.rpl")?.size).toBe(0);
  });

  it("holds the values the roadmap's key tables cite", async () => {
    const { files } = await readRampleSaveFolder(FW_2_00_INFERRED);
    const kit = (name: string) =>
      (byName(files, name) as RampleKitSaveFile).values;

    expect(kit("L1.rpl").level).toEqual([42, 127, 127, 127]);
    expect(kit("L1.rpl").loop).toEqual([0, 127, 127, 127]);
    expect(kit("L4.rpl").level).toEqual(four(127));
    expect(kit("F7.rpl").filter).toEqual([189, 127, 127, 127]);
    expect(kit("F7.rpl").selectedLayer).toEqual([1, 0, 3, 2]);
    expect(kit("F7.rpl").muteGroup).toEqual(four(four(false)));
    // A 127 written as 0 takes one byte fewer: no fixed offsets
    expect(fixture("L1.rpl").length).toBe(fixture("L4.rpl").length - 1);

    const settings = byName(files, "settings.rpl") as RampleSettingsFile;
    expect(settings.values.slicerQuantizePostV200).toBe(2);
    expect(settings.values.layerMode).toBe(1);
    const global = byName(files, "global_assign.rpl") as RampleGlobalAssignFile;
    expect(global.values).toEqual(
      [0, 1, 2, 3].map((voice) => ({ param: 9, voice })),
    );
  });

  it("matches the synthetic fixtures the other tests build", () => {
    expect(encodeCbor(syntheticSettings())).toEqual(fixture("settings.rpl"));
    expect(encodeCbor(syntheticGlobalAssign())).toEqual(
      fixture("global_assign.rpl"),
    );
  });
});

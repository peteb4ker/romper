// @vitest-environment node

import type {
  RampleKitSaveFile,
  RampleRawValue,
  RampleSaveFile,
  RampleSettingsFile,
} from "@romper/shared/rampleSave";

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  syntheticGlobalAssign,
  syntheticKitSave,
  syntheticSaveFolder,
  syntheticSettings,
} from "../../../../tests/factories/rampleSave.factory";
import { encodeCbor } from "../cbor";
import {
  classifyRampleSaveFileName,
  readRampleSaveFile,
  readRampleSaveFolder,
} from "../rampleSaveReader";

const readKit = (map: Map<string, RampleRawValue>, name = "L1.rpl") =>
  readRampleSaveFile(name, encodeCbor(map)) as RampleKitSaveFile;

const four = <T>(value: T): T[] => [value, value, value, value];

describe("[Q-08] reading the Rample's _save files (#788)", () => {
  describe("recognizing files by name", () => {
    it.each([
      ["settings.rpl", { kind: "settings" }],
      ["SETTINGS.RPL", { kind: "settings" }],
      ["global_assign.rpl", { kind: "globalAssign" }],
      ["autosave_C1.rpl", { kind: "autosave", kitName: "C1" }],
      ["autosave_c1.rpl", { kind: "autosave", kitName: "C1" }],
      ["L1.rpl", { kind: "kit", kitName: "L1" }],
      ["l1.RPL", { kind: "kit", kitName: "L1" }],
      ["Z99.rpl", { kind: "kit", kitName: "Z99" }],
      ["A100.rpl", { kind: "unknown" }],
      ["autosave_X.rpl", { kind: "unknown" }],
      ["._L1.rpl", { kind: "unknown" }],
      ["L1.rpl.bak", { kind: "unknown" }],
      ["notes.txt", { kind: "unknown" }],
    ])("%s", (fileName, expected) => {
      expect(classifyRampleSaveFileName(fileName)).toEqual(expected);
    });
  });

  describe("a kit file", () => {
    it("decodes every known key into typed values", () => {
      const file = readKit(syntheticKitSave());

      expect(file.kind).toBe("kit");
      expect(file.kitName).toBe("L1");
      expect(file.values).toEqual({
        assignments: four({ param: 9, voice: 0 }),
        bitcrush: four(127),
        env: four(127),
        filter: [189, 127, 127, 127],
        freeze: four(127),
        layerModes: four(1),
        length: four(254),
        level: [42, 127, 127, 127],
        loop: [0, 127, 127, 127],
        muteGroup: four(four(false)),
        pitch: four(127),
        selectedLayer: [1, 0, 3, 2],
        start: four(0),
      });
      expect(file.unknownKeys).toEqual([]);
      expect(file.missingKeys).toEqual([]);
      expect(file.problems).toEqual([]);
      expect(file.unreadable).toBeUndefined();
      expect(file.reencodesExactly).toBe(true);
    });

    it("keeps unknown keys in order, with their values, and lists them", () => {
      const map = syntheticKitSave();
      map.set("zz_test", 1);
      const assignments = map.get("assignments") as Map<
        string,
        RampleRawValue
      >[];
      assignments[1] = new Map<string, RampleRawValue>([
        ["extra", "x"],
        ["param", 9],
        ["voice", 0],
      ]);

      const file = readKit(map);

      expect(file.unknownKeys).toEqual(["assignments[1].extra", "zz_test"]);
      const raw = file.raw as Map<string, RampleRawValue>;
      expect([...raw.keys()].at(-1)).toBe("zz_test");
      expect(raw.get("zz_test")).toBe(1);
      expect(file.values.assignments?.[1]).toEqual({ param: 9, voice: 0 });
      expect(file.reencodesExactly).toBe(true);
    });

    it("reports a missing key as missing, never as a default", () => {
      const map = syntheticKitSave();
      map.delete("filter");
      const assignments = map.get("assignments") as Map<
        string,
        RampleRawValue
      >[];
      assignments[2] = new Map<string, RampleRawValue>([["param", 9]]);

      const file = readKit(map);

      expect(file.values.filter).toBeUndefined();
      expect("filter" in file.values).toBe(false);
      expect(file.values.assignments?.[2]).toEqual({ param: 9 });
      expect(file.missingKeys).toEqual(["assignments[2].voice", "filter"]);
      expect(file.problems).toEqual([]);
    });

    it("reads true in a mute group and values above 255", () => {
      const file = readKit(
        syntheticKitSave({
          level: [300, 127, 127, 127],
          mute_group: [
            [false, true, false, false],
            ...new Array<boolean[]>(3).fill(four(false)),
          ],
        }),
      );

      expect(file.values.level).toEqual([300, 127, 127, 127]);
      expect(file.values.muteGroup?.[0]).toEqual([false, true, false, false]);
      expect(file.problems).toEqual([]);
      expect(file.reencodesExactly).toBe(true);
    });

    it("reports values of the wrong shape, and keeps them in raw", () => {
      const file = readKit(
        syntheticKitSave({
          env: [127, 127, 127, 127, 127],
          filter: "open",
          level: [127, "loud", 127, 127],
          loop: 3,
          mute_group: [four(false), four(false), four(false), [false, 1]],
          selected_layer: [0, -1, 0, 0],
        }),
      );

      expect(file.values.filter).toBeUndefined();
      expect(file.values.level).toBeUndefined();
      expect(file.values.loop).toBeUndefined();
      expect(file.values.muteGroup).toBeUndefined();
      expect(file.values.selectedLayer).toBeUndefined();
      // A list of the wrong length is kept, and reported
      expect(file.values.env).toHaveLength(5);
      expect(file.problems).toEqual([
        "env: expected 4 items, found 5",
        'filter: expected a list, found string "open"',
        'level[1]: unexpected string "loud"',
        "loop: expected a list, found number 3",
        "mute_group[3]: unexpected an array of 2",
        "selected_layer[1]: unexpected number -1",
      ]);
      expect((file.raw as Map<string, RampleRawValue>).get("filter")).toBe(
        "open",
      );
      expect(file.reencodesExactly).toBe(true);
    });

    it("reports a short mute group row", () => {
      const file = readKit(
        syntheticKitSave({
          mute_group: [four(false), four(false), four(false), [false]],
        }),
      );
      expect(file.values.muteGroup?.[3]).toEqual([false]);
      expect(file.problems).toEqual([
        "mute_group[3]: expected 4 items, found 1",
      ]);
    });

    it("keeps an item outside the subset, and still re-encodes exactly", () => {
      const float = {
        bytes: Uint8Array.of(0xf9, 0x3c, 0x00),
        majorType: 7,
        opaque: true as const,
      };
      const file = readKit(syntheticKitSave({ pitch: [float, 127, 127, 127] }));

      expect(file.values.pitch).toBeUndefined();
      expect(file.problems).toEqual([
        "pitch[0]: unexpected an item of CBOR major type 7",
      ]);
      expect(file.reencodesExactly).toBe(true);
    });

    it("says when a kit name holds another kind of file", () => {
      const file = readKit(syntheticSettings(), "L1.rpl");

      expect(file.missingKeys).toHaveLength(13);
      expect(file.unknownKeys).toHaveLength(17);
      expect(file.problems).toEqual([
        "None of a kit file's keys: it may be another kind of file",
      ]);

      const list = readRampleSaveFile("L1.rpl", encodeCbor([1, 2]));
      expect(list.problems).toEqual([
        "The file: expected a map, found an array of 2",
      ]);
    });

    it("says it can't tell a kit file's firmware on its own", () => {
      const file = readKit(syntheticKitSave());
      expect(file.firmware.label).toMatch(
        /^unknown firmware \(kit files have no firmware marker\)/,
      );
      expect(file.firmware.candidates).toEqual([]);
    });

    it("notices a file that wouldn't re-encode the same", () => {
      // {start: [0, 0, 0, 127 written in three bytes]}
      const bytes = Uint8Array.of(
        0xa1,
        0x65,
        ...new TextEncoder().encode("start"),
        0x84,
        0x00,
        0x00,
        0x00,
        0x19,
        0x00,
        0x7f,
      );
      const file = readRampleSaveFile("A0.rpl", bytes) as RampleKitSaveFile;

      expect(file.values.start).toEqual([0, 0, 0, 127]);
      expect(file.reencodesExactly).toBe(false);
    });
  });

  describe("settings.rpl", () => {
    it("decodes the device settings and guesses the firmware from them", () => {
      const file = readRampleSaveFile(
        "settings.rpl",
        encodeCbor(syntheticSettings()),
      ) as RampleSettingsFile;

      expect(file.values).toEqual({
        antiClic: 1,
        assign: 0,
        autosave: 1,
        cvInRange: 1,
        flip: 0,
        layerMode: 1,
        midiChannelIn: 8,
        midiVelocity: 0,
        noteSp1: 48,
        noteSp2: 49,
        noteSp3: 50,
        noteSp4: 51,
        pitchTrackingChromatic: 0,
        receivePitchbend: 0,
        receiveProgchange: 1,
        slicerQuantizePostV200: 2,
        vuMeters: 1,
      });
      expect(file.firmware.candidates).toEqual(["2.00"]);
      expect(file.firmware.inferred).toBe(true);
      expect(file.reencodesExactly).toBe(true);
    });

    it("keeps an unknown setting and reports a wrong-shaped one", () => {
      const file = readRampleSaveFile(
        "settings.rpl",
        encodeCbor(syntheticSettings({ compressor: 3, flip: [0] })),
      ) as RampleSettingsFile;

      expect(file.unknownKeys).toEqual(["compressor"]);
      expect(file.values.flip).toBeUndefined();
      expect(file.problems).toEqual([
        "flip: expected an unsigned integer, found an array of 1",
      ]);
      expect(file.firmware.candidates).toEqual(["2.00", "3.00"]);
    });

    it("has unknown firmware when it isn't a map", () => {
      const file = readRampleSaveFile("settings.rpl", encodeCbor([1]));
      expect(file.firmware.label).toMatch(/^unknown firmware/);
    });
  });

  describe("global_assign.rpl and autosave files", () => {
    it("decodes the GLOBAL CV assignments", () => {
      const file = readRampleSaveFile(
        "global_assign.rpl",
        encodeCbor(syntheticGlobalAssign()),
      );
      expect(file.kind === "globalAssign" && file.values).toEqual([
        { param: 9, voice: 0 },
        { param: 9, voice: 1 },
        { param: 9, voice: 2 },
        { param: 9, voice: 3 },
      ]);
      expect(file.problems).toEqual([]);
      expect(file.reencodesExactly).toBe(true);

      const map = readRampleSaveFile(
        "global_assign.rpl",
        encodeCbor(new Map()),
      );
      expect(map.problems).toEqual([
        "The file: expected a list of CV assignments, found a map",
      ]);
    });

    it("takes an empty autosave file, and its kit from the name", () => {
      const file = readRampleSaveFile("autosave_C1.rpl", new Uint8Array(0));
      expect(file).toMatchObject({
        kind: "autosave",
        kitName: "C1",
        problems: [],
        size: 0,
      });
      expect(file.raw).toBeUndefined();
      expect(file.unreadable).toBeUndefined();
    });

    it("reports an autosave file that isn't empty", () => {
      const file = readRampleSaveFile("autosave_C1.rpl", encodeCbor(1));
      expect(file.problems).toEqual([
        "An autosave file is expected to be empty",
      ]);
      expect(file.raw).toBe(1);
    });
  });

  describe("files it can't decode", () => {
    it.each([
      [
        "a truncated kit file",
        "L1.rpl",
        encodeCbor(syntheticKitSave()).subarray(0, 100),
      ],
      ["trailing bytes", "settings.rpl", Uint8Array.of(0xa0, 0x00)],
      ["an empty kit file", "L1.rpl", new Uint8Array(0)],
      ["an indefinite length", "global_assign.rpl", Uint8Array.of(0x9f, 0xff)],
      [
        "text that isn't CBOR",
        "F7.rpl",
        new TextEncoder().encode('{"level": 1}'),
      ],
    ])(
      "reports %s as unreadable, never as defaults",
      (_name, fileName, bytes) => {
        const file = readRampleSaveFile(fileName, bytes);

        expect(file.unreadable?.message).toBeTruthy();
        expect(file.unreadable?.offset).toBeGreaterThanOrEqual(0);
        expect(file.raw).toBeUndefined();
        if ("values" in file) {
          expect(file.values).toEqual(file.kind === "globalAssign" ? [] : {});
        }
      },
    );

    it("decodes an unknown file when it can, and lists it either way", () => {
      expect(
        readRampleSaveFile("new.rpl", encodeCbor(new Map([["a", 1]]))),
      ).toMatchObject({
        kind: "unknown",
        reencodesExactly: true,
      });
      const appleDouble = readRampleSaveFile(
        "._L1.rpl",
        Uint8Array.of(0x00, 0x05),
      );
      expect(appleDouble.kind).toBe("unknown");
      expect(appleDouble.unreadable).toBeDefined();
      expect(
        readRampleSaveFile(".hidden", new Uint8Array(0)).unreadable,
      ).toBeUndefined();
    });
  });

  describe("a whole folder", () => {
    let folder: string;

    beforeEach(() => {
      folder = fs.mkdtempSync(path.join(os.tmpdir(), "romper-rample-save-"));
    });

    afterEach(() => {
      fs.rmSync(folder, { force: true, recursive: true });
    });

    const writeFolder = (files: Record<string, Uint8Array>) => {
      for (const [name, bytes] of Object.entries(files)) {
        fs.writeFileSync(path.join(folder, name), bytes);
      }
    };

    const snapshot = () =>
      fs
        .readdirSync(folder)
        .sort()
        .map((name) => {
          const stat = fs.lstatSync(path.join(folder, name));
          return [name, stat.mtimeMs, stat.size];
        });

    it("reads every file, sorted, with the folder's firmware guess, and writes nothing", async () => {
      writeFolder(syntheticSaveFolder());
      fs.mkdirSync(path.join(folder, "sub"));
      writeFolder({ "notes.txt": new TextEncoder().encode("hello") });
      const before = snapshot();

      const read = await readRampleSaveFolder(folder);

      expect(
        read.files.map((file: RampleSaveFile) => [file.fileName, file.kind]),
      ).toEqual([
        ["F7.rpl", "kit"],
        ["L1.rpl", "kit"],
        ["autosave_C1.rpl", "autosave"],
        ["global_assign.rpl", "globalAssign"],
        ["notes.txt", "unknown"],
        ["settings.rpl", "settings"],
        ["sub", "unknown"],
      ]);
      expect(read.firmware.candidates).toEqual(["2.00"]);
      const kit = read.files[0];
      expect(kit.firmware.folder).toEqual(read.firmware);
      expect(kit.firmware.label).toContain("the folder looks like 2.00");
      expect(read.files.at(-1)?.problems).toEqual([
        "Not a regular file; not read",
      ]);
      expect(
        read.files
          .filter((file) => file.raw !== undefined && file.kind !== "unknown")
          .every((file) => file.reencodesExactly),
      ).toBe(true);
      expect(snapshot()).toEqual(before);
    });

    it("has unknown firmware without settings.rpl", async () => {
      writeFolder({ "L1.rpl": encodeCbor(syntheticKitSave()) });

      const read = await readRampleSaveFolder(folder);

      expect(read.firmware.label).toBe("unknown firmware (no settings.rpl)");
      expect(read.files[0].firmware.label).toContain(
        "the folder looks like unknown firmware",
      );
    });

    it("doesn't read a file too big to be a save file", async () => {
      writeFolder({ "L1.rpl": new Uint8Array(64 * 1024 + 1) });

      const read = await readRampleSaveFolder(folder);

      expect(read.files[0].kind).toBe("kit");
      expect(read.files[0].unreadable?.message).toMatch(
        /65537 bytes, more than the 65536/,
      );
    });

    it.skipIf(process.platform === "win32")(
      "lists a link without following it",
      async () => {
        const outside = path.join(
          folder,
          "..",
          `${path.basename(folder)}-target`,
        );
        fs.writeFileSync(outside, encodeCbor(syntheticSettings()));
        try {
          fs.symlinkSync(outside, path.join(folder, "settings.rpl"));

          const read = await readRampleSaveFolder(folder);

          expect(read.files[0]).toMatchObject({
            kind: "unknown",
            problems: ["Not a regular file; not read"],
          });
          expect(read.firmware.label).toBe(
            "unknown firmware (no settings.rpl)",
          );
        } finally {
          fs.rmSync(outside, { force: true });
        }
      },
    );
  });
});

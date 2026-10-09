// @vitest-environment node

import type { RampleRawValue } from "@romper/shared/rampleSave";

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  hex,
  syntheticKitSave,
  syntheticSaveFolder,
} from "../../../../tests/factories/rampleSave.factory";
import { decodeCbor, encodeCbor } from "../cbor";
import {
  findLatestRampleSaveCopy,
  RAMPLE_SAVE_COPIES_FOLDER,
  readKitRampleSave,
  takenAtFromFolderName,
  toRampleDisplayValue,
  valueAtKeyPath,
} from "../rampleKitSaveView";

// Named as stage 2 names its copies
const COPY = "2026-10-09T04-12-58-000Z-setup";

describe("[UC-08] [Q-08] the kit editor's view of a kit's saved Rample settings (#800)", () => {
  let store: string;
  let copies: string;

  beforeEach(() => {
    store = fs.mkdtempSync(path.join(os.tmpdir(), "romper-rample-view-"));
    copies = path.join(store, ".romperdb", RAMPLE_SAVE_COPIES_FOLDER);
  });

  afterEach(() => {
    fs.rmSync(store, { force: true, recursive: true });
  });

  function writeCopy(name: string, files: Record<string, Uint8Array>) {
    const dir = path.join(copies, name);
    fs.mkdirSync(dir, { recursive: true });
    for (const [fileName, bytes] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, fileName), bytes);
    }
  }

  describe("finding the latest copy", () => {
    it("is none when the store has no copies", async () => {
      expect(
        await findLatestRampleSaveCopy(path.join(store, ".romperdb")),
      ).toBeNull();
      fs.mkdirSync(copies, { recursive: true });
      expect(
        await findLatestRampleSaveCopy(path.join(store, ".romperdb")),
      ).toBeNull();
    });

    it("is the last folder by name, with when it was taken", async () => {
      writeCopy("2026-10-01T09-00-00-000Z-setup", {});
      writeCopy(COPY, {});
      writeCopy("2026-10-05T09-00-00-000Z-write", {});
      fs.writeFileSync(path.join(copies, "zz-not-a-folder"), "");
      fs.mkdirSync(path.join(copies, ".partial"));

      const latest = await findLatestRampleSaveCopy(
        path.join(store, ".romperdb"),
      );

      expect(latest).toEqual({
        folderName: COPY,
        path: path.join(copies, COPY),
        takenAt: "2026-10-09T04:12:58.000Z",
      });
    });

    it("falls back to the folder's time when its name has no date", async () => {
      writeCopy("setup", {});
      const latest = await findLatestRampleSaveCopy(
        path.join(store, ".romperdb"),
      );
      expect(latest?.folderName).toBe("setup");
      expect(Number.isNaN(Date.parse(latest?.takenAt ?? ""))).toBe(false);
    });
  });

  describe("when a copy was taken, from its folder name", () => {
    it.each([
      ["2026-10-09T04-12-58-123Z-setup", "2026-10-09T04:12:58.123Z"],
      ["2026-10-09T04-12-58-123Z-write-2", "2026-10-09T04:12:58.123Z"],
      ["2026-10-09T04-12-58Z", "2026-10-09T04:12:58.000Z"],
    ])("%s", (name, expected) => {
      expect(takenAtFromFolderName(name)).toBe(expected);
    });

    it.each(["setup", "2026-13-45T99-99-99Z", "2026-10-09T04-12-58", ""])(
      "has no time for %j",
      (name) => {
        expect(takenAtFromFolderName(name)).toBeUndefined();
      },
    );
  });

  describe("reading a kit's file", () => {
    it("says there's no copy when the store has none", async () => {
      expect(await readKitRampleSave(store, "L1")).toEqual({
        data: { kitName: "L1", status: "noCopy" },
        success: true,
      });
    });

    it("decodes the kit's file to raw values, with the folder's firmware guess", async () => {
      writeCopy(COPY, syntheticSaveFolder());

      const result = await readKitRampleSave(store, "L1");

      expect(result.success).toBe(true);
      const view = result.data;
      if (view?.status !== "found") throw new Error(`found: ${view?.status}`);
      expect(view.kitName).toBe("L1");
      expect(view.fileName).toBe("L1.rpl");
      expect(view.copy).toEqual({
        folderName: COPY,
        takenAt: "2026-10-09T04:12:58.000Z",
      });
      expect(view.values.level).toEqual([42, 127, 127, 127]);
      expect(view.values.filter).toEqual([127, 127, 127, 127]);
      expect(view.values.selectedLayer).toEqual([0, 0, 0, 0]);
      expect(view.values.muteGroup?.[0]).toEqual([false, false, false, false]);
      expect(view.values.assignments?.[0]).toEqual({ param: 9, voice: 0 });
      expect(view.missingKeys).toEqual([]);
      expect(view.otherValues).toEqual([]);
      expect(view.firmware?.candidates).toEqual(["2.00"]);
      expect(view.firmware?.inferred).toBe(true);
      // Plain data: it crosses IPC unchanged
      expect(structuredClone(view)).toEqual(view);
      expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    });

    it("matches the kit name ignoring case, as the device's file names are", async () => {
      writeCopy(COPY, { "l4.RPL": encodeCbor(syntheticKitSave()) });
      const result = await readKitRampleSave(store, "L4");
      expect(result.data?.status).toBe("found");
    });

    it("says the kit has no file, not defaults, when the copy has none for it", async () => {
      writeCopy(COPY, syntheticSaveFolder());
      const result = await readKitRampleSave(store, "A0");
      expect(result.data).toMatchObject({
        copy: { folderName: COPY },
        kitName: "A0",
        status: "noFile",
      });
      expect(result.data).not.toHaveProperty("values");
    });

    it("reads only the latest copy", async () => {
      writeCopy("2026-10-01T09-00-00-000Z-setup", syntheticSaveFolder());
      writeCopy(COPY, {});
      const result = await readKitRampleSave(store, "L1");
      expect(result.data?.status).toBe("noFile");
    });

    it("lists missing keys, and shows unknown keys and odd shapes with their values", async () => {
      const map = syntheticKitSave({
        level: [1, 2, "loud", 4],
        zz_test: 1,
      });
      map.delete("filter");
      (map.get("assignments") as Map<string, RampleRawValue>[])[1] = new Map<
        string,
        RampleRawValue
      >([
        ["extra", [true, null]],
        ["param", 9],
        ["voice", 1],
      ]);
      writeCopy(COPY, { "L1.rpl": encodeCbor(map) });

      const view = (await readKitRampleSave(store, "L1")).data;
      if (view?.status !== "found") throw new Error(`found: ${view?.status}`);

      expect(view.missingKeys).toEqual(["filter"]);
      expect(view.values.filter).toBeUndefined();
      expect(view.values.level).toBeUndefined();
      expect(view.otherValues).toEqual([
        {
          key: "assignments[1].extra",
          unexpectedShape: false,
          value: [true, null],
        },
        { key: "zz_test", unexpectedShape: false, value: 1 },
        { key: "level", unexpectedShape: true, value: [1, 2, "loud", 4] },
      ]);
    });

    it("says a file it can't decode is unreadable, with the reader's reason", async () => {
      writeCopy(COPY, { "L1.rpl": hex("a1 63 65 6e") });
      const view = (await readKitRampleSave(store, "L1")).data;
      expect(view).toMatchObject({
        fileName: "L1.rpl",
        status: "unreadable",
      });
      expect(view?.status === "unreadable" && view.reason).toMatch(/\S/);
    });

    it("says a file that decodes to something other than a map is unreadable", async () => {
      writeCopy(COPY, { "L1.rpl": encodeCbor([1, 2, 3]) });
      const view = (await readKitRampleSave(store, "L1")).data;
      expect(view?.status).toBe("unreadable");
    });

    it.each(["", "../settings", "L1.rpl", "AA", 7])(
      "[Q-03] refuses %j as a kit name",
      async (kitName) => {
        const result = await readKitRampleSave(store, kitName as string);
        expect(result.success).toBe(false);
      },
    );
  });

  describe("values shown as they are", () => {
    it("turns maps into entries in the file's order, and keeps nested values", () => {
      // Built with set(), not a literal, so lint's sorting can't reorder it
      const raw = new Map<string, RampleRawValue>();
      raw.set("b", 1);
      raw.set("a", [false, "x", null]);
      expect(toRampleDisplayValue(raw)).toEqual({
        entries: [
          ["b", 1],
          ["a", [false, "x", null]],
        ],
      });
    });

    it("describes an item outside the subset by its type and size, not its bytes", () => {
      // A half-precision float, 1.0
      const opaque = decodeCbor(hex("f9 3c 00"));
      expect(toRampleDisplayValue(opaque)).toEqual({
        opaque: { majorType: 7, size: 3 },
      });
    });

    it("finds a value by the reader's key path", () => {
      const raw = new Map<string, RampleRawValue>([
        ["assignments", [new Map([["param", 9]]), new Map([["extra", 5]])]],
      ]);
      expect(valueAtKeyPath(raw, "assignments[1].extra")).toBe(5);
      expect(valueAtKeyPath(raw, "assignments[2].extra")).toBeUndefined();
      expect(valueAtKeyPath(raw, "nothing")).toBeUndefined();
      expect(valueAtKeyPath(5, "a")).toBeUndefined();
    });
  });
});

// @vitest-environment node
/* eslint-disable perfectionist/sort-maps -- Map order is the file's key order, which these tests set on purpose */
import type { RampleRawValue } from "@romper/shared/rampleSave";

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  syntheticKitSave,
  syntheticSaveFolder,
} from "../../../../tests/factories/rampleSave.factory";
import { encodeCbor } from "../cbor";
import { runRampleSaveCli } from "../rampleSaveCli";
import {
  diffRampleSaveFolders,
  diffRawValues,
  formatRampleSaveDiff,
  formatRampleSaveFolder,
  formatRawValue,
} from "../rampleSaveDiff";
import { readRampleSaveFolder } from "../rampleSaveReader";

const opaque = (...bytes: number[]) => ({
  bytes: Uint8Array.from(bytes),
  majorType: 7,
  opaque: true as const,
});

describe("[Q-08] comparing copies of the _save folder (#788)", () => {
  describe("diffRawValues", () => {
    it("names each changed value by its path", () => {
      expect(
        diffRawValues(
          syntheticKitSave(),
          syntheticKitSave({ level: [127, 127, 127, 127] }),
        ),
      ).toEqual([{ after: "127", before: "42", path: "level[0]" }]);
    });

    it("lists keys and items only one side has", () => {
      const before = new Map<string, RampleRawValue>([
        ["a", [1, 2]],
        ["gone", true],
      ]);
      const after = new Map<string, RampleRawValue>([
        ["a", [1, 2, 3]],
        ["new", "x"],
      ]);

      expect(diffRawValues(before, after)).toEqual([
        { after: "3", path: "a[2]" },
        { before: "true", path: "gone" },
        { after: '"x"', path: "new" },
      ]);
    });

    it("notices a change of key order, which changes the bytes", () => {
      const before = new Map<string, RampleRawValue>([
        ["a", 1],
        ["b", 2],
      ]);
      const after = new Map<string, RampleRawValue>([
        ["b", 2],
        ["a", 1],
      ]);

      expect(diffRawValues(before, after)).toEqual([
        { after: "b, a", before: "a, b", path: "(top) key order" },
      ]);
    });

    it("compares opaque items by their bytes, and values of different types", () => {
      expect(diffRawValues(opaque(0xf7), opaque(0xf7))).toEqual([]);
      expect(diffRawValues(opaque(0xf7), opaque(0xf6))).toHaveLength(1);
      expect(diffRawValues([1], 1)).toEqual([
        { after: "1", before: "[1]", path: "(top)" },
      ]);
      expect(diffRawValues(undefined, undefined)).toEqual([]);
    });
  });

  it("formats values on one line", () => {
    expect(
      formatRawValue(
        new Map<string, RampleRawValue>([
          ["param", 9],
          ["list", [true, null, "x"]],
          ["odd", opaque(0xf9, 0x3c, 0x00)],
        ]),
      ),
    ).toBe(
      '{param: 9, list: [true, null, "x"], odd: <CBOR major type 7: f9 3c 00>}',
    );
  });

  describe("folders", () => {
    let root: string;

    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), "romper-rample-diff-"));
    });

    afterEach(() => {
      fs.rmSync(root, { force: true, recursive: true });
    });

    const folder = (name: string, files: Record<string, Uint8Array>) => {
      const dir = path.join(root, name);
      fs.mkdirSync(dir);
      for (const [file, bytes] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, file), bytes);
      }
      return dir;
    };

    const baseline = () => syntheticSaveFolder();

    const changed = () => {
      const files = syntheticSaveFolder();
      // Voice 1 level turned up on L1; autosave moved from C1 to A0;
      // global_assign.rpl damaged
      files["L1.rpl"] = encodeCbor(
        syntheticKitSave({
          filter: [127, 127, 127, 127],
          level: [127, 127, 127, 127],
          selected_layer: [0, 0, 0, 0],
        }),
      );
      delete files["autosave_C1.rpl"];
      files["autosave_A0.rpl"] = new Uint8Array(0);
      files["global_assign.rpl"] = Uint8Array.of(0x84);
      return files;
    };

    it("lists added, removed and changed files", async () => {
      const before = await readRampleSaveFolder(
        folder("00-baseline", baseline()),
      );
      const after = await readRampleSaveFolder(folder("03-scaling", changed()));

      expect(diffRampleSaveFolders(before, after)).toEqual([
        { changes: [], fileName: "autosave_A0.rpl", status: "added" },
        { changes: [], fileName: "autosave_C1.rpl", status: "removed" },
        {
          changes: [
            { before: expect.stringMatching(/^\[\{param/), path: "(top)" },
            {
              after: expect.stringMatching(/declares 4 items/),
              before: "readable",
              path: "(unreadable)",
            },
          ],
          fileName: "global_assign.rpl",
          status: "changed",
        },
        {
          changes: [{ after: "127", before: "42", path: "level[0]" }],
          fileName: "L1.rpl",
          status: "changed",
        },
      ]);
      expect(diffRampleSaveFolders(before, before)).toEqual([]);
    });

    it("prints a diff, and says when there's none", async () => {
      const before = await readRampleSaveFolder(folder("a", baseline()));
      const after = await readRampleSaveFolder(folder("b", changed()));

      const lines = formatRampleSaveDiff(before, after);
      expect(lines).toContain("L1.rpl: changed");
      expect(lines).toContain("  level[0]: 42 -> 127");
      expect(lines).toContain("autosave_A0.rpl: only in the second folder");
      expect(lines).toContain("autosave_C1.rpl: only in the first folder");
      expect(formatRampleSaveDiff(before, before).at(-1)).toBe(
        "No differences.",
      );
    });

    it("prints a folder: firmware, each file's keys in order, and what didn't fit", async () => {
      const files = baseline();
      files["F7.rpl"] = encodeCbor(
        syntheticKitSave({ filter: "x", zz_test: 1 }),
      );
      files["notes.txt"] = new TextEncoder().encode("hello");
      const read = await readRampleSaveFolder(folder("one", files));

      const lines = formatRampleSaveFolder(read);

      expect(lines[0]).toMatch(/^Firmware: 2\.00 \(inferred/);
      expect(lines).toContainEqual(
        expect.stringMatching(
          /^F7\.rpl: saved settings of kit F7, \d+ bytes, re-encodes byte for byte$/,
        ),
      );
      expect(lines).toContain("  level: [42, 127, 127, 127]");
      expect(lines).toContain("  (unknown keys: zz_test)");
      expect(lines).toContain(
        '  (problems: filter: expected a list, found string "x")',
      );
      expect(lines).toContain("autosave_C1.rpl: autosave of kit C1, 0 bytes");
      expect(lines).toContain(
        "global_assign.rpl: GLOBAL CV assignments, 61 bytes, re-encodes byte for byte",
      );
      expect(lines).toContain(
        "  [{param: 9, voice: 0}, {param: 9, voice: 1}, {param: 9, voice: 2}, {param: 9, voice: 3}]",
      );
      expect(lines.find((line) => line.startsWith("notes.txt:"))).toMatch(
        /not a file the Rample is known to write, 5 bytes, unreadable/,
      );
      // settings.rpl carries the folder's guess; the rest say theirs is unknown
      expect(
        lines.filter((line) => line.startsWith("  (firmware: unknown")),
      ).toHaveLength(5);
    });

    it("says when a re-encode wouldn't match", async () => {
      // {start: [127 written in three bytes]}
      const bytes = Uint8Array.of(
        0xa1,
        0x65,
        ...new TextEncoder().encode("start"),
        0x81,
        0x19,
        0x00,
        0x7f,
      );
      const read = await readRampleSaveFolder(
        folder("long", { "A0.rpl": bytes }),
      );

      expect(formatRampleSaveFolder(read)).toContain(
        "A0.rpl: saved settings of kit A0, 11 bytes, does NOT re-encode byte for byte",
      );
    });

    describe("npm run rample:save", () => {
      const run = async (args: string[]) => {
        const lines: string[] = [];
        const code = await runRampleSaveCli(args, (line) => lines.push(line));
        return { code, lines };
      };

      it("prints one folder, decoded", async () => {
        const dir = folder("one", baseline());

        const { code, lines } = await run([dir]);

        expect(code).toBe(0);
        expect(lines[0]).toBe(`_save folder: ${dir}`);
        expect(lines).toContain("  level: [42, 127, 127, 127]");
      });

      it("prints the differences between two folders", async () => {
        const a = folder("a", baseline());
        const b = folder("b", changed());

        const { code, lines } = await run([a, b]);

        expect(code).toBe(0);
        expect(lines[0]).toBe(`Comparing ${a} -> ${b}`);
        expect(lines).toContain("  level[0]: 42 -> 127");
      });

      it("explains its usage, and refuses what isn't a folder", async () => {
        expect((await run([])).code).toBe(2);
        expect((await run(["a", "b", "c"])).code).toBe(2);
        const help = await run(["--help"]);
        expect(help.code).toBe(0);
        expect(help.lines[0]).toMatch(/^Usage: npm run rample:save/);

        const file = path.join(root, "file.rpl");
        fs.writeFileSync(file, "x");
        const missing = await run([file]);
        expect(missing).toEqual({ code: 1, lines: [`Not a folder: ${file}`] });
        expect((await run([path.join(root, "nowhere")])).code).toBe(1);
      });
    });
  });
});

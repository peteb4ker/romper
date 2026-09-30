import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearRampleContent,
  getSdCardDialogDefaultPath,
  validateSdCardTarget,
} from "../sdCardSafety";

const isWindows = process.platform === "win32";
const isCaseInsensitive =
  process.platform === "darwin" || process.platform === "win32";

describe("sdCardSafety", () => {
  let root: string;
  let store: string;
  let card: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "romper-sdcard-safety-"));
    store = path.join(root, "local-store");
    card = path.join(root, "sd-card");
    fs.mkdirSync(path.join(store, ".romperdb"), { recursive: true });
    fs.mkdirSync(card, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { force: true, recursive: true });
  });

  describe("validateSdCardTarget", () => {
    it("accepts a separate SD card folder", () => {
      expect(validateSdCardTarget(card, [store])).toEqual({ ok: true });
    });

    it("accepts a separate folder that does not exist yet", () => {
      expect(
        validateSdCardTarget(path.join(root, "not-yet-created"), [store]),
      ).toEqual({ ok: true });
    });

    it("ignores empty protected paths", () => {
      expect(validateSdCardTarget(card, ["", store])).toEqual({ ok: true });
    });

    it("rejects an empty or relative path", () => {
      expect(validateSdCardTarget("", [store]).ok).toBe(false);
      expect(validateSdCardTarget("relative/card", [store]).ok).toBe(false);
    });

    it("rejects the filesystem root", () => {
      const result = validateSdCardTarget(path.parse(os.homedir()).root, [
        store,
      ]);
      expect(result.ok).toBe(false);
    });

    it("rejects the home folder", () => {
      const result = validateSdCardTarget(os.homedir(), [store]);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/home folder/);
    });

    it("rejects a folder above the home folder", () => {
      const result = validateSdCardTarget(path.dirname(os.homedir()), [store]);
      expect(result.ok).toBe(false);
    });

    it("rejects the local store itself", () => {
      const result = validateSdCardTarget(store, [store]);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/overlaps the local store/);
    });

    it("rejects a folder inside the local store", () => {
      const inside = path.join(store, "A0");
      fs.mkdirSync(inside);
      expect(validateSdCardTarget(inside, [store]).ok).toBe(false);
    });

    it("rejects a folder that contains the local store", () => {
      expect(validateSdCardTarget(root, [store]).ok).toBe(false);
    });

    it("checks every protected store, not just the first", () => {
      const other = path.join(root, "other-store");
      fs.mkdirSync(other);
      expect(validateSdCardTarget(other, [store, other]).ok).toBe(false);
    });

    it("does not treat a sibling with a shared name prefix as inside the store", () => {
      const sibling = `${store}-backup`;
      fs.mkdirSync(sibling);
      expect(validateSdCardTarget(sibling, [store])).toEqual({ ok: true });
    });

    it.skipIf(isWindows)(
      "rejects a symlink that points at the local store",
      () => {
        const link = path.join(root, "card-link");
        fs.symlinkSync(store, link);
        expect(validateSdCardTarget(link, [store]).ok).toBe(false);
      },
    );

    it.skipIf(!isCaseInsensitive)(
      "compares paths case-insensitively where the filesystem does",
      () => {
        expect(validateSdCardTarget(store.toUpperCase(), [store]).ok).toBe(
          false,
        );
      },
    );
  });

  describe("clearRampleContent", () => {
    const touch = (name: string) =>
      fs.writeFileSync(path.join(card, name), "x");
    const mkdir = (name: string) => {
      fs.mkdirSync(path.join(card, name));
      fs.writeFileSync(path.join(card, name, "1kick.wav"), "x");
    };

    it("removes kit folders and bank RTF files, and nothing else", () => {
      for (const kit of ["A0", "B12", "Z99", "c5"]) mkdir(kit);
      touch("A - Artist.rtf");
      touch("Z - Another Artist.RTF");
      // Things that must survive
      for (const keep of ["Documents", "A100", "AB1", "Samples"]) mkdir(keep);
      touch("notes.txt");
      touch("readme.rtf");
      touch("A - not a bank.txt");

      const { removed } = clearRampleContent(card);

      expect(removed.sort()).toEqual(
        [
          "A - Artist.rtf",
          "A0",
          "B12",
          "Z - Another Artist.RTF",
          "Z99",
          "c5",
        ].sort(),
      );
    });

    it("keeps everything that is not Rample content", () => {
      mkdir("A0");
      mkdir("Documents");
      touch("notes.txt");
      touch("readme.rtf");

      clearRampleContent(card);

      expect(fs.readdirSync(card).sort()).toEqual(
        ["Documents", "notes.txt", "readme.rtf"].sort(),
      );
      expect(fs.existsSync(path.join(card, "Documents", "1kick.wav"))).toBe(
        true,
      );
    });

    it.skipIf(isWindows)(
      "never follows or removes a symlink, even one named like a kit",
      () => {
        const outside = path.join(root, "outside");
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, "precious.wav"), "x");
        fs.symlinkSync(outside, path.join(card, "C3"));

        const { removed } = clearRampleContent(card);

        expect(removed).toEqual([]);
        expect(fs.existsSync(path.join(outside, "precious.wav"))).toBe(true);
        expect(fs.lstatSync(path.join(card, "C3")).isSymbolicLink()).toBe(true);
      },
    );

    it("keeps a file that is merely named like a kit", () => {
      touch("D7");

      expect(clearRampleContent(card)).toEqual({ removed: [] });
      expect(fs.existsSync(path.join(card, "D7"))).toBe(true);
    });

    it("returns an empty list for an empty card", () => {
      expect(clearRampleContent(card)).toEqual({ removed: [] });
    });

    it("throws when the path does not exist", () => {
      expect(() => clearRampleContent(path.join(root, "missing"))).toThrow(
        /does not exist/,
      );
    });

    it("throws when the path is a file", () => {
      touch("file.txt");
      expect(() => clearRampleContent(path.join(card, "file.txt"))).toThrow(
        /not a folder/,
      );
    });
  });

  describe("getSdCardDialogDefaultPath", () => {
    it("opens at /Volumes on macOS", () => {
      if (process.platform !== "darwin") return;
      expect(getSdCardDialogDefaultPath()).toBe("/Volumes");
    });

    it("always returns an existing folder", () => {
      const result = getSdCardDialogDefaultPath();
      expect(fs.statSync(result).isDirectory()).toBe(true);
    });
  });
});

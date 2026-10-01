import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  findStaleCardEntries,
  getSdCardDialogDefaultPath,
  removeCardEntries,
  validateSdCardTarget,
} from "../sdCardSafety";

const isWindows = process.platform === "win32";
const isCaseInsensitive =
  process.platform === "darwin" || process.platform === "win32";

describe("[UC-34] sdCardSafety", () => {
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

  describe("findStaleCardEntries", () => {
    const write = (relative: string) => {
      fs.mkdirSync(path.dirname(path.join(card, relative)), {
        recursive: true,
      });
      fs.writeFileSync(path.join(card, relative), "x");
    };
    const contents = (
      kits: Record<string, string[]>,
      bankFiles: string[] = [],
    ) => ({ bankFiles, kits: new Map(Object.entries(kits)) });

    it("lists kit folders the store doesn't have", () => {
      write("A0/1-01 kick.wav");
      write("B3/1-01 old.wav");

      expect(
        findStaleCardEntries(card, contents({ A0: ["1-01 kick.wav"] })),
      ).toEqual(["B3"]);
    });

    it("lists files and folders inside a kit that the store doesn't have", () => {
      write("A0/1-01 kick.wav");
      write("A0/1-02 removed.wav");
      write("A0/2/old layout.wav");
      write("A0/.DS_Store");

      expect(
        findStaleCardEntries(card, contents({ A0: ["1-01 kick.wav"] })),
      ).toEqual([
        path.join("A0", ".DS_Store"),
        path.join("A0", "1-02 removed.wav"),
        path.join("A0", "2"),
      ]);
    });

    it("lists bank name files for banks without a name", () => {
      write("A - ALWIS.rtf");
      write("B - OLD NAME.rtf");

      expect(
        findStaleCardEntries(card, contents({}, ["A - ALWIS.rtf"])),
      ).toEqual(["B - OLD NAME.rtf"]);
    });

    it("compares names ignoring case, as FAT32 does", () => {
      write("a0/1-01 KICK.wav");
      write("A - alwis.RTF");

      expect(
        findStaleCardEntries(
          card,
          contents({ A0: ["1-01 kick.wav"] }, ["A - ALWIS.rtf"]),
        ),
      ).toEqual([]);
    });

    it("leaves everything that isn't Rample content", () => {
      write("_save/A0.rpl");
      write("Documents/1kick.wav");
      write("A100/1kick.wav");
      write("notes.txt");
      write("readme.rtf");
      write("D7");

      expect(findStaleCardEntries(card, contents({}))).toEqual([]);
    });

    it.skipIf(isWindows)("never follows a symlink named like a kit", () => {
      const outside = path.join(root, "outside");
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(outside, "precious.wav"), "x");
      fs.symlinkSync(outside, path.join(card, "C3"));

      expect(findStaleCardEntries(card, contents({}))).toEqual([]);
    });

    it("returns nothing for a card that doesn't exist", () => {
      expect(
        findStaleCardEntries(path.join(root, "missing"), contents({})),
      ).toEqual([]);
    });
  });

  describe("removeCardEntries", () => {
    it("removes the listed files and folders, and nothing else", () => {
      fs.mkdirSync(path.join(card, "A0", "2"), { recursive: true });
      fs.writeFileSync(path.join(card, "A0", "2", "old.wav"), "x");
      fs.writeFileSync(path.join(card, "A0", "1-01 kick.wav"), "x");
      fs.mkdirSync(path.join(card, "B3"));
      fs.writeFileSync(path.join(card, "B - OLD.rtf"), "x");

      removeCardEntries(card, [path.join("A0", "2"), "B3", "B - OLD.rtf"]);

      expect(fs.readdirSync(card)).toEqual(["A0"]);
      expect(fs.readdirSync(path.join(card, "A0"))).toEqual(["1-01 kick.wav"]);
    });

    it.skipIf(isWindows)(
      "removes a symlink inside a kit without touching its target",
      () => {
        const outside = path.join(root, "outside");
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, "precious.wav"), "x");
        fs.mkdirSync(path.join(card, "A0"));
        fs.symlinkSync(outside, path.join(card, "A0", "linked"));

        removeCardEntries(card, [path.join("A0", "linked")]);

        expect(fs.existsSync(path.join(card, "A0", "linked"))).toBe(false);
        expect(fs.existsSync(path.join(outside, "precious.wav"))).toBe(true);
      },
    );
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

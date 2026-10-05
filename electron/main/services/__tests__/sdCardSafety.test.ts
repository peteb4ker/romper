import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CARD_OPERATION_TIMEOUT_MS,
  CardNotRespondingError,
  cardWatchdogSettings,
} from "../cardWatchdog";
import {
  findStaleCardEntries,
  getSdCardDialogDefaultPath,
  removeAppleDoubleCompanion,
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

    it("lists kit folders the store doesn't have", async () => {
      write("A0/1-01 kick.wav");
      write("B3/1-01 old.wav");

      expect(
        await findStaleCardEntries(card, contents({ A0: ["1-01 kick.wav"] })),
      ).toEqual(["B3"]);
    });

    it("[UC-34] lists macOS's ._ files in kit folders, and leaves its root folders alone (#653)", async () => {
      write("A0/1-01 kick.wav");
      write("A0/._1-01 kick.wav");
      write("._A0");
      write(".fseventsd/fseventsd-uuid");
      write(".Spotlight-V100/Store-V2/x");
      write(".Trashes/501/x");
      write("._.Trashes");

      expect(
        await findStaleCardEntries(card, contents({ A0: ["1-01 kick.wav"] })),
      ).toEqual([path.join("A0", "._1-01 kick.wav")]);
    });

    it("[UC-34] keeps a quarantined kit's folder and everything in it (#537)", async () => {
      write("A0/1-01 kick.wav");
      write("A0/2-01 old snare.wav");
      write("B3/1-01 old.wav");

      expect(
        await findStaleCardEntries(card, {
          ...contents({}),
          keepKits: ["a0"],
        }),
      ).toEqual(["B3"]);
    });

    it("lists files and folders inside a kit that the store doesn't have", async () => {
      write("A0/1-01 kick.wav");
      write("A0/1-02 removed.wav");
      write("A0/2/old layout.wav");
      write("A0/.DS_Store");

      expect(
        await findStaleCardEntries(card, contents({ A0: ["1-01 kick.wav"] })),
      ).toEqual([
        path.join("A0", ".DS_Store"),
        path.join("A0", "1-02 removed.wav"),
        path.join("A0", "2"),
      ]);
    });

    it("lists bank name files for banks without a name", async () => {
      write("A - ALWIS.rtf");
      write("B - OLD NAME.rtf");

      expect(
        await findStaleCardEntries(card, contents({}, ["A - ALWIS.rtf"])),
      ).toEqual(["B - OLD NAME.rtf"]);
    });

    it("compares names ignoring case, as FAT32 does", async () => {
      write("a0/1-01 KICK.wav");
      write("A - alwis.RTF");

      expect(
        await findStaleCardEntries(
          card,
          contents({ A0: ["1-01 kick.wav"] }, ["A - ALWIS.rtf"]),
        ),
      ).toEqual([]);
    });

    it("leaves everything that isn't Rample content", async () => {
      write("_save/A0.rpl");
      write("Documents/1kick.wav");
      write("A100/1kick.wav");
      write("notes.txt");
      write("readme.rtf");
      write("D7");

      expect(await findStaleCardEntries(card, contents({}))).toEqual([]);
    });

    it.skipIf(isWindows)(
      "never follows a symlink named like a kit",
      async () => {
        const outside = path.join(root, "outside");
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, "precious.wav"), "x");
        fs.symlinkSync(outside, path.join(card, "C3"));

        expect(await findStaleCardEntries(card, contents({}))).toEqual([]);
      },
    );

    it("returns nothing for a card that doesn't exist", async () => {
      expect(
        await findStaleCardEntries(path.join(root, "missing"), contents({})),
      ).toEqual([]);
    });
  });

  describe("removeCardEntries", () => {
    it("removes the listed files and folders, and nothing else", async () => {
      fs.mkdirSync(path.join(card, "A0", "2"), { recursive: true });
      fs.writeFileSync(path.join(card, "A0", "2", "old.wav"), "x");
      fs.writeFileSync(path.join(card, "A0", "1-01 kick.wav"), "x");
      fs.mkdirSync(path.join(card, "B3"));
      fs.writeFileSync(path.join(card, "B - OLD.rtf"), "x");

      const removed = await removeCardEntries(card, [
        path.join("A0", "2"),
        "B3",
        "B - OLD.rtf",
      ]);

      expect(removed).toBe(3);
      expect(fs.readdirSync(card)).toEqual(["A0"]);
      expect(fs.readdirSync(path.join(card, "A0"))).toEqual(["1-01 kick.wav"]);
    });

    it.skipIf(isWindows)(
      "removes a symlink inside a kit without touching its target",
      async () => {
        const outside = path.join(root, "outside");
        fs.mkdirSync(outside);
        fs.writeFileSync(path.join(outside, "precious.wav"), "x");
        fs.mkdirSync(path.join(card, "A0"));
        fs.symlinkSync(outside, path.join(card, "A0", "linked"));

        await removeCardEntries(card, [path.join("A0", "linked")]);

        expect(fs.existsSync(path.join(card, "A0", "linked"))).toBe(false);
        expect(fs.existsSync(path.join(outside, "precious.wav"))).toBe(true);
      },
    );

    it.runIf(process.platform === "darwin")(
      "[UC-34] removes the ._ file macOS made beside a written file (#653)",
      async () => {
        fs.mkdirSync(path.join(card, "A0"));
        fs.writeFileSync(path.join(card, "A0", "1-01 kick.wav"), "x");
        fs.writeFileSync(path.join(card, "A0", "._1-01 kick.wav"), "x");

        await removeAppleDoubleCompanion(
          path.join(card, "A0", "1-01 kick.wav"),
        );
        // And there's nothing to do when there's no ._ file
        await removeAppleDoubleCompanion(
          path.join(card, "A0", "1-01 kick.wav"),
        );

        expect(fs.readdirSync(path.join(card, "A0"))).toEqual([
          "1-01 kick.wav",
        ]);
      },
    );

    it.skipIf(process.platform === "darwin")(
      "leaves ._ files alone where macOS doesn't make them",
      async () => {
        fs.mkdirSync(path.join(card, "A0"));
        fs.writeFileSync(path.join(card, "A0", "._1-01 kick.wav"), "x");

        await removeAppleDoubleCompanion(
          path.join(card, "A0", "1-01 kick.wav"),
        );

        expect(fs.readdirSync(path.join(card, "A0"))).toEqual([
          "._1-01 kick.wav",
        ]);
      },
    );

    it("reports each removal and stops between entries when told to (#653)", async () => {
      for (const kit of ["B1", "B2", "B3"]) fs.mkdirSync(path.join(card, kit));
      const reported: string[] = [];

      const removed = await removeCardEntries(card, ["B1", "B2", "B3"], {
        onRemoved: (count, total) => reported.push(`${count}/${total}`),
        shouldStop: () => reported.length === 2,
      });

      expect(removed).toBe(2);
      expect(reported).toEqual(["1/3", "2/3"]);
      expect(fs.readdirSync(card)).toEqual(["B3"]);
    });

    it("says the card stopped responding when a removal never finishes (#653)", async () => {
      fs.mkdirSync(path.join(card, "B1"));
      const rm = vi
        .spyOn(fs.promises, "rm")
        .mockReturnValue(new Promise<void>(() => undefined));
      cardWatchdogSettings.timeoutMs = 20;
      try {
        await expect(removeCardEntries(card, ["B1", "B2"])).rejects.toThrow(
          CardNotRespondingError,
        );
        // It gave up on the first entry and didn't start the next
        expect(rm).toHaveBeenCalledTimes(1);
      } finally {
        cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
        rm.mockRestore();
      }
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

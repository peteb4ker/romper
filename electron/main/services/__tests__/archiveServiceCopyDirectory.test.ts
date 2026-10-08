import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real fs, with the synchronous calls a copy could make spied on, so a test
// can check the copy made none of them (#724)
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    copyFileSync: vi.fn(actual.copyFileSync),
    lstatSync: vi.fn(actual.lstatSync),
    mkdirSync: vi.fn(actual.mkdirSync),
    readdirSync: vi.fn(actual.readdirSync),
    statSync: vi.fn(actual.statSync),
  };
});

import { ArchiveService } from "../archiveService";
import {
  CARD_NOT_RESPONDING_SETUP_MESSAGE,
  CARD_OPERATION_TIMEOUT_MS,
  cardWatchdogSettings,
} from "../cardWatchdog";

// Real-filesystem tests for copyDirectory's symlink handling. These do not mock
// node:fs (unlike archiveService.test.ts), so they exercise the actual copy.
describe("ArchiveService.copyDirectory symlink handling", () => {
  let tmpRoot: string;
  const service = new ArchiveService();

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "romper-copydir-"));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { force: true, recursive: true });
  });

  it("copies regular files and nested directories", async () => {
    const src = path.join(tmpRoot, "src");
    fs.mkdirSync(path.join(src, "nested"), { recursive: true });
    fs.writeFileSync(path.join(src, "a.wav"), "a");
    fs.writeFileSync(path.join(src, "nested", "b.wav"), "b");

    const dest = path.join(tmpRoot, "dest");
    const result = await service.copyDirectory(src, dest);

    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(dest, "a.wav"), "utf-8")).toBe("a");
    expect(fs.readFileSync(path.join(dest, "nested", "b.wav"), "utf-8")).toBe(
      "b",
    );
  });

  it("skips symlinks instead of following them", async () => {
    // A sensitive file outside the source tree.
    const secret = path.join(tmpRoot, "secret.txt");
    fs.writeFileSync(secret, "top secret");

    const src = path.join(tmpRoot, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, "real.wav"), "real");
    // A planted symlink pointing at the sensitive file.
    fs.symlinkSync(secret, path.join(src, "link.txt"));

    const dest = path.join(tmpRoot, "dest");
    const result = await service.copyDirectory(src, dest);

    expect(result.success).toBe(true);
    // The real file is copied...
    expect(fs.readFileSync(path.join(dest, "real.wav"), "utf-8")).toBe("real");
    // ...but the symlink is not, so the secret content never lands in dest.
    expect(fs.existsSync(path.join(dest, "link.txt"))).toBe(false);
  });

  it("skips a symlinked subdirectory", async () => {
    const outsideDir = path.join(tmpRoot, "outside");
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, "leak.txt"), "leak");

    const src = path.join(tmpRoot, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.symlinkSync(outsideDir, path.join(src, "linkdir"));

    const dest = path.join(tmpRoot, "dest");
    const result = await service.copyDirectory(src, dest);

    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(dest, "linkdir"))).toBe(false);
  });

  // #724: setup copies each kit from the card with copyDirectory. On a card
  // whose driver stopped responding (#653) a synchronous copy blocked the
  // main process; now each operation is asynchronous and the card
  // watchdog gives up on one that never finishes.
  describe("[UC-01] [Q-01] a card that stops responding (#724)", () => {
    afterEach(() => {
      cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
      vi.restoreAllMocks();
    });

    function cardKit() {
      const src = path.join(tmpRoot, "card", "A0");
      fs.mkdirSync(src, { recursive: true });
      fs.writeFileSync(path.join(src, "1 kick.wav"), "kick");
      fs.writeFileSync(path.join(src, "2 snare.wav"), "snare");
      return src;
    }

    it("stops the copy when a file is never read", async () => {
      const src = cardKit();
      const copyFile = vi
        .spyOn(fs.promises, "copyFile")
        .mockReturnValue(new Promise<never>(() => undefined));
      cardWatchdogSettings.timeoutMs = 20;

      const result = await service.copyDirectory(src, path.join(tmpRoot, "A0"));

      expect(result).toEqual({
        error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
        success: false,
      });
      // It gave up on the first file and didn't start the next
      expect(copyFile).toHaveBeenCalledTimes(1);
    });

    it("stops the copy when the kit folder is never listed", async () => {
      const src = cardKit();
      vi.spyOn(fs.promises, "readdir").mockReturnValue(
        new Promise<never>(() => undefined),
      );
      const copyFile = vi.spyOn(fs.promises, "copyFile");
      cardWatchdogSettings.timeoutMs = 20;

      const result = await service.copyDirectory(src, path.join(tmpRoot, "A0"));

      expect(result.error).toBe(CARD_NOT_RESPONDING_SETUP_MESSAGE);
      expect(copyFile).not.toHaveBeenCalled();
    });

    it("touches the card only through fs.promises", async () => {
      const src = cardKit();
      vi.clearAllMocks();

      const result = await service.copyDirectory(src, path.join(tmpRoot, "A0"));

      expect(result.success).toBe(true);
      for (const sync of [
        fs.copyFileSync,
        fs.lstatSync,
        fs.mkdirSync,
        fs.readdirSync,
        fs.statSync,
      ]) {
        expect(sync).not.toHaveBeenCalled();
      }
    });
  });
});

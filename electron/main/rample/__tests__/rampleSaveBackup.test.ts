// @vitest-environment node

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syntheticSaveFolder } from "../../../../tests/factories/rampleSave.factory";
import {
  CARD_OPERATION_TIMEOUT_MS,
  cardWatchdogSettings,
} from "../../services/cardWatchdog";
import {
  backupRampleSaveFolder,
  RAMPLE_SAVE_BACKUP_FOLDER,
  RAMPLE_SAVE_BACKUP_LIMITS,
  RAMPLE_SAVE_WRITE_BACKUPS_KEPT,
} from "../rampleSaveBackup";

const AT = new Date("2026-10-08T21:46:58.123Z");
const WRITE_NAME = "2026-10-08T21-46-58-123Z-write";
const SETUP_NAME = "2026-10-08T21-46-58-123Z-setup";

/** Every file under `root`, relative, with its bytes and mtime */
function snapshot(root: string) {
  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .map((entry) => {
      const full = path.join(entry.parentPath, entry.name);
      const stat = fs.lstatSync(full);
      return [
        path.relative(root, full),
        stat.mtimeMs,
        stat.isFile() ? fs.readFileSync(full).toString("hex") : "",
      ];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

describe("[Q-04] [UC-34] keeping a copy of the card's _save folder (#786)", () => {
  let tempDir: string;
  let card: string;
  let saveDir: string;
  let dbDir: string;
  let backups: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-save-backup-"));
    card = path.join(tempDir, "card");
    saveDir = path.join(card, "_save");
    dbDir = path.join(tempDir, "store", ".romperdb");
    backups = path.join(dbDir, RAMPLE_SAVE_BACKUP_FOLDER);
    fs.mkdirSync(saveDir, { recursive: true });
    fs.mkdirSync(dbDir, { recursive: true });
    for (const [name, bytes] of Object.entries(syntheticSaveFolder())) {
      fs.writeFileSync(path.join(saveDir, name), bytes);
    }
  });

  afterEach(() => {
    cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
    vi.restoreAllMocks();
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  const backup = (
    options: Partial<Parameters<typeof backupRampleSaveFolder>[0]> = {},
  ) =>
    backupRampleSaveFolder({
      cardPath: card,
      dbDir,
      now: AT,
      reason: "write",
      ...options,
    });

  it("copies every file byte for byte, and changes nothing on the card", async () => {
    const before = snapshot(card);

    const result = await backup({ reason: "setup" });

    const copy = path.join(backups, SETUP_NAME);
    expect(result).toEqual({
      backupPath: copy,
      files: [
        "F7.rpl",
        "L1.rpl",
        "autosave_C1.rpl",
        "global_assign.rpl",
        "settings.rpl",
      ],
      removedBackups: [],
      skipped: [],
      status: "copied",
    });
    for (const name of fs.readdirSync(saveDir)) {
      expect(fs.readFileSync(path.join(copy, name))).toEqual(
        fs.readFileSync(path.join(saveDir, name)),
      );
    }
    expect(fs.readdirSync(backups)).toEqual([SETUP_NAME]);
    expect(snapshot(card)).toEqual(before);
  });

  it("finds _save whatever its case, as FAT32 does", async () => {
    fs.renameSync(saveDir, path.join(card, "_SAVE"));

    const result = await backup();

    expect(result.status).toBe("copied");
    expect(fs.readdirSync(path.join(backups, WRITE_NAME))).toHaveLength(5);
  });

  it("has nothing to copy from a card without _save, and makes no folder", async () => {
    fs.rmSync(saveDir, { recursive: true });

    expect(await backup()).toEqual({ status: "missing" });
    expect(fs.existsSync(backups)).toBe(false);
  });

  it("copies an empty _save as an empty copy", async () => {
    fs.rmSync(saveDir, { recursive: true });
    fs.mkdirSync(saveDir);

    const result = await backup();

    expect(result).toMatchObject({ files: [], status: "copied" });
    expect(fs.readdirSync(path.join(backups, WRITE_NAME))).toEqual([]);
  });

  it("skips links, folders and files too big to be a save file, and never follows a link", async () => {
    const outside = path.join(tempDir, "outside.txt");
    fs.writeFileSync(outside, "not the device's");
    fs.symlinkSync(outside, path.join(saveDir, "link.rpl"));
    fs.mkdirSync(path.join(saveDir, "sub"));
    fs.writeFileSync(path.join(saveDir, "sub", "A0.rpl"), "nested");
    fs.writeFileSync(
      path.join(saveDir, "huge.rpl"),
      Buffer.alloc(RAMPLE_SAVE_BACKUP_LIMITS.maxFileBytes + 1),
    );

    const result = await backup();

    expect(result.status).toBe("copied");
    if (result.status !== "copied") return;
    expect(result.skipped).toEqual([
      {
        name: "huge.rpl",
        reason: `${RAMPLE_SAVE_BACKUP_LIMITS.maxFileBytes + 1} bytes, more than a save file can be`,
      },
      { name: "link.rpl", reason: "not a regular file" },
      { name: "sub", reason: "not a regular file" },
    ]);
    expect(fs.readdirSync(result.backupPath).sort()).toEqual(
      result.files.slice().sort(),
    );
    expect(result.files).not.toContain("link.rpl");
  });

  it("stops at the total size limit, file by file", async () => {
    const { maxTotalBytes } = RAMPLE_SAVE_BACKUP_LIMITS;
    RAMPLE_SAVE_BACKUP_LIMITS.maxTotalBytes = 500;
    try {
      const result = await backup();

      expect(result).toMatchObject({
        files: ["F7.rpl", "autosave_C1.rpl", "global_assign.rpl"],
        skipped: [
          { name: "L1.rpl", reason: "the copy would be more than 500 bytes" },
          {
            name: "settings.rpl",
            reason: "the copy would be more than 500 bytes",
          },
        ],
        status: "copied",
      });
    } finally {
      RAMPLE_SAVE_BACKUP_LIMITS.maxTotalBytes = maxTotalBytes;
    }
  });

  it("doesn't follow a link named _save", async () => {
    const elsewhere = path.join(tempDir, "elsewhere");
    fs.renameSync(saveDir, elsewhere);
    fs.symlinkSync(elsewhere, saveDir, "dir");

    const result = await backup();

    expect(result).toEqual({
      cardNotResponding: false,
      error:
        "Couldn't read the card's _save folder: _save on the card isn't a folder",
      status: "failed",
    });
    expect(fs.existsSync(backups)).toBe(false);
  });

  it("gives up on a card that stops responding, and stores nothing", async () => {
    cardWatchdogSettings.timeoutMs = 200;
    const readFile = fs.promises.readFile;
    vi.spyOn(fs.promises, "readFile").mockImplementation(((
      file: fs.PathLike,
      ...rest: unknown[]
    ) =>
      String(file).endsWith("settings.rpl")
        ? new Promise(() => undefined)
        : (readFile as (...args: unknown[]) => Promise<Buffer>)(
            file,
            ...rest,
          )) as typeof fs.promises.readFile);

    const result = await backup();

    expect(result).toMatchObject({
      cardNotResponding: true,
      status: "failed",
    });
    expect(fs.existsSync(backups)).toBe(false);
  });

  it("reports a store it can't write to, and never makes the .romperdb folder", async () => {
    // A setup cleaned up while the card was read: its folder moved aside
    fs.rmSync(dbDir, { recursive: true });

    const result = await backup({ reason: "setup" });

    expect(result).toMatchObject({
      cardNotResponding: false,
      status: "failed",
    });
    expect(fs.existsSync(dbDir)).toBe(false);
  });

  it("leaves no half-made copy when storing a file fails", async () => {
    const writeFile = fs.promises.writeFile;
    vi.spyOn(fs.promises, "writeFile").mockImplementation(((
      file: fs.PathLike,
      ...rest: unknown[]
    ) =>
      String(file).endsWith("L1.rpl")
        ? Promise.reject(new Error("disk full"))
        : (writeFile as (...args: unknown[]) => Promise<void>)(
            file,
            ...rest,
          )) as typeof fs.promises.writeFile);

    const result = await backup();

    expect(result).toEqual({
      cardNotResponding: false,
      error: "Couldn't store the copy of the card's _save folder: disk full",
      status: "failed",
    });
    expect(fs.readdirSync(backups)).toEqual([]);
  });

  it("names two copies taken in the same millisecond apart", async () => {
    await backup();
    const second = await backup();

    expect(second).toMatchObject({
      backupPath: path.join(backups, `${WRITE_NAME}-2`),
    });
    expect(fs.readdirSync(backups).sort()).toEqual([
      WRITE_NAME,
      `${WRITE_NAME}-2`,
    ]);
  });

  describe("retention", () => {
    const at = (minute: number) =>
      new Date(Date.UTC(2026, 9, 8, 12, minute, 0, 0));
    const nameAt = (minute: number, reason = "write") =>
      `${at(minute).toISOString().replaceAll(/[:.]/g, "-")}-${reason}`;

    it(`keeps the setup copy and the newest ${RAMPLE_SAVE_WRITE_BACKUPS_KEPT} copies taken before a write`, async () => {
      await backup({ now: at(0), reason: "setup" });
      for (let minute = 1; minute <= RAMPLE_SAVE_WRITE_BACKUPS_KEPT; minute++) {
        await backup({ now: at(minute) });
      }
      // Not Romper's copies: left alone
      fs.mkdirSync(path.join(backups, "notes"));
      fs.mkdirSync(path.join(backups, `${nameAt(0)}.partial`));

      const result = await backup({
        now: at(RAMPLE_SAVE_WRITE_BACKUPS_KEPT + 1),
      });

      expect(result).toMatchObject({
        removedBackups: [nameAt(1)],
        status: "copied",
      });
      const kept = fs.readdirSync(backups).sort();
      expect(kept).toContain(nameAt(0, "setup"));
      expect(kept).not.toContain(nameAt(1));
      expect(kept).toContain(nameAt(2));
      expect(kept).toContain(nameAt(RAMPLE_SAVE_WRITE_BACKUPS_KEPT + 1));
      expect(kept).toContain("notes");
      expect(kept).toContain(`${nameAt(0)}.partial`);
      expect(kept.filter((name) => name.endsWith("-write"))).toHaveLength(
        RAMPLE_SAVE_WRITE_BACKUPS_KEPT,
      );
    });

    it("never removes the copy it just made, even with the clock set back", async () => {
      for (let minute = 10; minute < 13; minute++) {
        await backup({ keep: 2, now: at(minute) });
      }

      const result = await backup({ keep: 2, now: at(1) });

      expect(result.status).toBe("copied");
      const kept = fs.readdirSync(backups).sort();
      expect(kept).toContain(nameAt(1));
      expect(kept).toContain(nameAt(12));
      expect(kept).toHaveLength(3);
    });

    it("keeps the new copy when removing old ones fails, and says why", async () => {
      await backup({ keep: 1, now: at(1) });
      vi.spyOn(fs.promises, "rm").mockRejectedValue(new Error("busy"));

      const result = await backup({ keep: 1, now: at(2) });

      expect(result).toMatchObject({
        removedBackups: [],
        retentionError: "busy",
        status: "copied",
      });
      expect(fs.readdirSync(backups).sort()).toEqual([nameAt(1), nameAt(2)]);
    });
  });
});

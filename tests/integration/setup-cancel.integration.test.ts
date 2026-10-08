import AdmZip from "adm-zip";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { ArchiveService } from "../../electron/main/services/archiveService.js";
import {
  LocalStoreSetupService,
  SetupCancelledError,
} from "../../electron/main/services/localStoreSetupService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

/**
 * Whether this process still has `file` open. Windows can't delete an open
 * file, so a leaked handle fails cleanup there; lsof finds the leak on
 * macOS and Linux too. Null where lsof isn't available.
 */
function holdsOpen(file: string): boolean | null {
  try {
    const out = execFileSync("lsof", ["-p", String(process.pid)], {
      encoding: "utf8",
    });
    return out.includes(fs.realpathSync(file));
  } catch {
    return null;
  }
}

// RE-66: setup can be cancelled. Main aborts the extraction in progress, and
// cleanup removes only what this setup wrote into the target (kit folders it
// extracted or copied, its database), so a retry in the same folder works.

describe("[UC-02] Cancelling setup (RE-66)", () => {
  let tempDir: string;
  let target: string;
  let setup: LocalStoreSetupService;

  beforeEach(() => {
    tempDir = createTempStore("setup-cancel-");
    target = path.join(tempDir, "store");
    fs.mkdirSync(target);
    // Something of the user's that was there before setup
    fs.writeFileSync(path.join(target, "notes.txt"), "mine");
    setup = new LocalStoreSetupService();
  });

  afterEach(() => {
    removeTempStore(tempDir);
  });

  it("aborts an extraction part way and cleans up only what it wrote", async () => {
    // 40 kit folders of 1 MiB files: long enough to cancel mid-way
    const zip = new AdmZip();
    const payload = Buffer.alloc(1024 * 1024, 7);
    for (let kit = 0; kit < 40; kit++) {
      zip.addFile(`A${kit}/1 kick.wav`, payload);
    }
    const zipPath = path.join(tempDir, "factory.zip");
    zip.writeZip(zipPath);

    const archive = new ArchiveService();
    let cancelled = false;
    const result = await setup.trackCreatedEntries(target, () =>
      archive.downloadAndExtractArchive(
        pathToFileURL(zipPath).href,
        target,
        (progress) => {
          if (progress.phase === "Extracting" && !cancelled) {
            cancelled = true;
            setup.cancelSetup();
          }
        },
        setup.setupSignal,
      ),
    );

    expect(result).toEqual({
      cancelled: true,
      error: "Setup cancelled",
      success: false,
    });
    const extracted = fs
      .readdirSync(target)
      .filter((name) => name !== "notes.txt");
    expect(extracted.length).toBeGreaterThan(0);
    expect(extracted.length).toBeLessThan(40);

    const cleanup = setup.cleanupFailedSetup(target);
    expect(cleanup).toMatchObject({
      removed: true,
      removedEntries: extracted.length,
    });
    expect(fs.readdirSync(target)).toEqual(["notes.txt"]);
    // The archive itself (a file:// source) is never deleted, and nothing
    // still has it open
    expect(fs.existsSync(zipPath)).toBe(true);
    expect(holdsOpen(zipPath)).not.toBe(true);
  });

  it("cleans up a copied kit and the database, and nothing else", async () => {
    await setup.trackCreatedEntries(target, () => {
      fs.mkdirSync(path.join(target, "A0"));
      fs.writeFileSync(path.join(target, "A0", "1 kick.wav"), "x");
    });
    const dbDir = path.join(target, ".romperdb");
    expect(setup.createSetupDatabase(dbDir).success).toBe(true);

    const cleanup = setup.cleanupFailedSetup(target);

    expect(cleanup.removed).toBe(true);
    expect(cleanup.removedEntries).toBe(1);
    expect(cleanup.movedTo).toMatch(/\.romperdb\.failed-\d+$/);
    expect(fs.readdirSync(target).sort()).toEqual(
      [path.basename(cleanup.movedTo!), "notes.txt"].sort(),
    );
  });

  it("records what work created even when the work fails", async () => {
    await expect(
      setup.trackCreatedEntries(target, () => {
        fs.mkdirSync(path.join(target, "B1"));
        throw new Error("copy failed");
      }),
    ).rejects.toThrow("copy failed");

    expect(setup.cleanupFailedSetup(target).removedEntries).toBe(1);
    expect(fs.existsSync(path.join(target, "B1"))).toBe(false);
  });

  it("leaves a finished store alone", async () => {
    await setup.trackCreatedEntries(target, () => {
      fs.mkdirSync(path.join(target, "A0"));
    });
    setup.markSetupComplete(target);

    expect(setup.cleanupFailedSetup(target).removed).toBe(false);
    expect(setup.cleanupUnfinishedSetups()).toEqual([]);
    expect(fs.existsSync(path.join(target, "A0"))).toBe(true);
  });

  it("cleans up an unfinished setup on quit, but not the configured store", async () => {
    await setup.trackCreatedEntries(target, () => {
      fs.mkdirSync(path.join(target, "A0"));
    });

    expect(setup.cleanupUnfinishedSetups(target)).toEqual([]);
    expect(fs.existsSync(path.join(target, "A0"))).toBe(true);

    const results = setup.cleanupUnfinishedSetups(null);
    expect(results).toEqual([
      expect.objectContaining({ removed: true, targetPath: target }),
    ]);
    expect(fs.existsSync(path.join(target, "A0"))).toBe(false);
  });

  it("gives work started after a cancel a fresh signal", () => {
    const first = setup.setupSignal;
    setup.cancelSetup();
    expect(first.aborted).toBe(true);
    expect(first.reason).toBeInstanceOf(SetupCancelledError);
    expect(setup.setupSignal.aborted).toBe(false);
  });
  it("closes the zip after a complete extraction", async () => {
    const zip = new AdmZip();
    for (let kit = 0; kit < 3; kit++) {
      zip.addFile(`A${kit}/1 kick.wav`, Buffer.alloc(1024, 1));
    }
    const zipPath = path.join(tempDir, "small.zip");
    zip.writeZip(zipPath);

    const result = await new ArchiveService().downloadAndExtractArchive(
      pathToFileURL(zipPath).href,
      target,
    );

    expect(result.success).toBe(true);
    expect(holdsOpen(zipPath)).not.toBe(true);
    // What Windows needs: the file can go
    fs.rmSync(zipPath);
  });
});

// #616: the wizard marks the store finished (finish-setup) as soon as it's
// fully built, before saving it as the local store. If that save fails and
// the user quits, the quit-time cleanup keeps the store; a store whose
// build failed part way is still cleaned up.
describe("[UC-01] Quitting after setup built the store (#616)", () => {
  let tempDir: string;
  let target: string;
  let dbDir: string;
  let setup: LocalStoreSetupService;

  /** What the wizard does before the settings save: copy a kit, build the db */
  async function buildStore() {
    await setup.trackCreatedEntries(target, () => {
      fs.mkdirSync(path.join(target, "A0"));
      fs.writeFileSync(
        path.join(target, "A0", "1 kick.wav"),
        encodeTestWav([sine(220, 0.05, 44100)], {
          bitDepth: 16,
          encoding: "pcm",
          sampleRate: 44100,
        }),
      );
    });
    expect(setup.createSetupDatabase(dbDir).success).toBe(true);
    expect(setup.importSetupKit(dbDir, "A0").success).toBe(true);
  }

  beforeEach(() => {
    tempDir = createTempStore("setup-finish-");
    target = path.join(tempDir, "store");
    dbDir = path.join(target, ".romperdb");
    fs.mkdirSync(target);
    setup = new LocalStoreSetupService();
  });

  afterEach(() => {
    removeTempStore(tempDir);
  });

  it("keeps a fully built store when saving it as the local store failed", async () => {
    await buildStore();
    setup.markSetupComplete(target);

    // The settings save failed, so no local store is configured at quit
    expect(setup.cleanupUnfinishedSetups(null)).toEqual([]);

    expect(fs.readdirSync(target).sort()).toEqual([".romperdb", "A0"]);
    expect(fs.existsSync(path.join(dbDir, "romper.sqlite"))).toBe(true);
    expect(fs.existsSync(path.join(target, "A0", "1 kick.wav"))).toBe(true);
  });

  it("still cleans up a store whose build failed part way", async () => {
    await setup.trackCreatedEntries(target, () => {
      fs.mkdirSync(path.join(target, "A0"));
    });
    expect(setup.createSetupDatabase(dbDir).success).toBe(true);
    // The build stops here (a crash, or a failed kit import): never finished

    const results = setup.cleanupUnfinishedSetups(null);

    expect(results).toEqual([
      expect.objectContaining({ removed: true, targetPath: target }),
    ]);
    expect(fs.existsSync(path.join(target, "A0"))).toBe(false);
    expect(fs.existsSync(dbDir)).toBe(false);
    expect(fs.readdirSync(target)).toEqual([
      expect.stringMatching(/^\.romperdb\.failed-\d+$/),
    ]);
  });
});

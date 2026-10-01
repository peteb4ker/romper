import AdmZip from "adm-zip";
import fs from "node:fs";
import os from "node:os";
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

// RE-66: setup can be cancelled. Main aborts the extraction in progress, and
// cleanup removes only what this setup wrote into the target (kit folders it
// extracted or copied, its database), so a retry in the same folder works.

describe("[UC-02] Cancelling setup (RE-66)", () => {
  let tempDir: string;
  let target: string;
  let setup: LocalStoreSetupService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-cancel-"));
    target = path.join(tempDir, "store");
    fs.mkdirSync(target);
    // Something of the user's that was there before setup
    fs.writeFileSync(path.join(target, "notes.txt"), "mine");
    setup = new LocalStoreSetupService();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { force: true, recursive: true });
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
    // The archive itself (a file:// source) is never deleted
    expect(fs.existsSync(zipPath)).toBe(true);
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
});

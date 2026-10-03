import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { createRomperDbFile } from "../../electron/main/db/romperDbCoreORM.js";
import { syncService } from "../../electron/main/services/syncService.js";

// RE-76: a library with nothing left to copy can still be written, so the
// card is cleared of the kits and bank names the library no longer has.

describe("[UC-34] Writing a library with nothing to copy (RE-76)", () => {
  let tempDir: string;
  let sdCardPath: string;
  let settings: { localStorePath: string };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-removals-only-"));
    const localStorePath = path.join(tempDir, "store");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(localStorePath, { recursive: true });
    createRomperDbFile(path.join(localStorePath, ".romperdb"));
    settings = { localStorePath };

    // What an earlier write left: a kit and a bank name, plus the Rample's
    // own settings folder
    fs.mkdirSync(path.join(sdCardPath, "A0"), { recursive: true });
    fs.writeFileSync(path.join(sdCardPath, "A0", "1-01 kick.wav"), "x");
    fs.writeFileSync(path.join(sdCardPath, "A - OLD.rtf"), "{\\rtf1}");
    fs.mkdirSync(path.join(sdCardPath, "_save"));
    fs.writeFileSync(path.join(sdCardPath, "_save", "A0.rpl"), "rample");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it("lists the card's leftovers for removal with no files to copy", async () => {
    const summary = await syncService.generateChangeSummary(
      settings,
      sdCardPath,
    );
    expect(summary.success).toBe(true);
    expect(summary.data?.fileCount).toBe(0);
    expect(summary.data?.removals).toEqual(
      expect.arrayContaining(["A - OLD.rtf", "A0"]),
    );
  });

  it("removes them, and leaves the Rample's _save folder alone", async () => {
    const result = await syncService.startKitSync(settings, { sdCardPath });

    expect(result.success).toBe(true);
    expect(result.data?.syncedFiles).toBe(0);
    expect(fs.readdirSync(sdCardPath)).toEqual(["_save"]);
    expect(
      fs.readFileSync(path.join(sdCardPath, "_save", "A0.rpl"), "utf8"),
    ).toBe("rample");
  });
});

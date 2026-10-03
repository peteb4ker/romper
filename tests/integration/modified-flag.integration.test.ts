import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import {
  addKit,
  addSample,
  copyKit,
  createRomperDbFile,
  getKit,
  markKitsAsSynced,
  updateBank,
  updateSampleGain,
  updateVoiceAlias,
} from "../../electron/main/db/romperDbCoreORM.js";
import { kitService } from "../../electron/main/services/kitService.js";
import { scanService } from "../../electron/main/services/scanService.js";
import { syncService } from "../../electron/main/services/syncService.js";

// RE-35: every edit that changes the kit sets "modified since sync", so the
// Modified filter shows it, and a completed write clears it again.

/** A short 16-bit mono WAV */
function wav(): Buffer {
  const data = Buffer.alloc(4410 * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(44100, 24);
  header.writeUInt32LE(44100 * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe("[UC-11] Edits mark a kit modified since the last write (RE-35)", () => {
  let tempDir: string;
  let localStorePath: string;
  let dbDir: string;
  let sdCardPath: string;
  let settings: { localStorePath: string };

  const modified = (kitName: string) =>
    getKit(dbDir, kitName).data?.modified_since_sync;

  const kit = (name: string) =>
    addKit(dbDir, {
      alias: null,
      bank_letter: name.charAt(0),
      editable: true,
      locked: false,
      modified_since_sync: false,
      name,
      step_pattern: null,
    });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "modified-flag-"));
    localStorePath = path.join(tempDir, "store");
    dbDir = path.join(localStorePath, ".romperdb");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(sdCardPath, { recursive: true });
    fs.mkdirSync(localStorePath, { recursive: true });
    createRomperDbFile(dbDir);
    settings = { localStorePath };

    const source = path.join(tempDir, "kick.wav");
    fs.writeFileSync(source, wav());
    kit("A0");
    kit("A1");
    kit("B0");
    addSample(dbDir, {
      filename: "kick.wav",
      kit_name: "A0",
      slot_number: 0,
      source_path: source,
      voice_number: 1,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it("a gain change marks the kit modified", () => {
    expect(updateSampleGain(dbDir, "A0", 1, 0, -6).success).toBe(true);

    expect(modified("A0")).toBe(true);
    expect(modified("A1")).toBe(false);
  });

  it("a gain change on a missing sample changes nothing", () => {
    expect(updateSampleGain(dbDir, "A1", 1, 0, -6).success).toBe(false);

    expect(modified("A1")).toBe(false);
  });

  it("renaming a voice marks the kit modified, saving the same name doesn't", () => {
    expect(updateVoiceAlias(dbDir, "A0", 2, "Snare").success).toBe(true);
    expect(modified("A0")).toBe(true);

    markKitsAsSynced(dbDir, ["A0"]);
    expect(updateVoiceAlias(dbDir, "A0", 2, "Snare").success).toBe(true);
    expect(modified("A0")).toBe(false);

    expect(updateVoiceAlias(dbDir, "A0", 2, "").success).toBe(true);
    expect(modified("A0")).toBe(true);
  });

  it("renaming or clearing a bank marks every kit in it modified", () => {
    expect(updateBank(dbDir, "A", { artist: "Autechre" }).success).toBe(true);
    expect([modified("A0"), modified("A1"), modified("B0")]).toEqual([
      true,
      true,
      false,
    ]);

    markKitsAsSynced(dbDir, ["A0", "A1"]);
    expect(updateBank(dbDir, "A", { artist: "Autechre" }).success).toBe(true);
    expect([modified("A0"), modified("A1")]).toEqual([false, false]);

    // Clearing the name takes its file off the card (RE-23)
    expect(updateBank(dbDir, "A", { artist: null }).success).toBe(true);
    expect([modified("A0"), modified("A1")]).toEqual([true, true]);
  });

  it("a bank scan reads names the card already has, so it marks nothing", () => {
    fs.writeFileSync(path.join(localStorePath, "A - Autechre.rtf"), "{\\rtf1}");

    const result = scanService.scanBanks(settings);

    expect(result.success).toBe(true);
    expect(result.data?.updatedBanks).toBe(1);
    expect([modified("A0"), modified("A1")]).toEqual([false, false]);
  });

  it("a new or duplicated kit starts modified: the card doesn't have it yet", () => {
    expect(kitService.createKit(settings, "C0").success).toBe(true);
    expect(modified("C0")).toBe(true);

    expect(copyKit(dbDir, "A0", "C1").success).toBe(true);
    expect(modified("C1")).toBe(true);
  });

  it("a completed write clears the flag on every kit, those without samples too", async () => {
    updateSampleGain(dbDir, "A0", 1, 0, -6);
    updateVoiceAlias(dbDir, "A1", 1, "Kick");
    updateBank(dbDir, "B", { artist: "Boards" });
    expect([modified("A0"), modified("A1"), modified("B0")]).toEqual([
      true,
      true,
      true,
    ]);

    const result = await syncService.startKitSync(settings, { sdCardPath });

    expect(result.success).toBe(true);
    expect(fs.readdirSync(sdCardPath).sort()).toEqual(["A0", "B - Boards.rtf"]);
    expect([modified("A0"), modified("A1"), modified("B0")]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("a kit with a sample the write skipped stays modified", async () => {
    addSample(dbDir, {
      filename: "gone.wav",
      kit_name: "A1",
      slot_number: 0,
      source_path: path.join(tempDir, "gone.wav"),
      voice_number: 1,
    });
    updateSampleGain(dbDir, "A0", 1, 0, -6);
    updateSampleGain(dbDir, "A1", 1, 0, -6);

    const result = await syncService.startKitSync(settings, {
      sdCardPath,
      skipInvalidFiles: true,
    });

    expect(result.success).toBe(true);
    expect(modified("A0")).toBe(false);
    expect(modified("A1")).toBe(true);
  });
});

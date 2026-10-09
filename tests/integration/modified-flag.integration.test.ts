import fs from "node:fs";
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
  getKit,
  markKitsAsSynced,
  toggleKitFavorite,
  updateBank,
  updateKit,
  updateSampleGain,
  updateVoiceAlias,
  updateVoiceSampleMode,
  updateVoiceSliceSettings,
  updateVoiceStereoMode,
  updateVoiceVolume,
} from "../../electron/main/db/romperDbCoreORM.js";
import { kitService } from "../../electron/main/services/kitService.js";
import { sampleService } from "../../electron/main/services/sampleService.js";
import { scanService } from "../../electron/main/services/scanService.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// "Modified since sync" means the next write will change this kit on the
// card (#566). Every edit that changes what the write puts there sets it,
// edits the card never sees don't, and a completed write clears it again
// (RE-35). One test per writer.

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

describe("[UC-11] Edits the next write puts on the card mark a kit modified (#566)", () => {
  let tempDir: string;
  let localStorePath: string;
  let dbDir: string;
  let sdCardPath: string;
  let settings: { localStorePath: string };

  let kickPath: string;

  const modified = (kitName: string) =>
    getKit(dbDir, kitName).data?.modified_since_sync;

  /** Write a short WAV, creating its folder */
  const wavFile = (file: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, wav());
    return file;
  };

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
    tempDir = createTempStore("modified-flag-");
    localStorePath = path.join(tempDir, "store");
    dbDir = path.join(localStorePath, ".romperdb");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(sdCardPath, { recursive: true });
    fs.mkdirSync(localStorePath, { recursive: true });
    createStoreDb(dbDir);
    settings = { localStorePath };

    const source = wavFile(path.join(tempDir, "kick.wav"));
    kickPath = source;
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
    removeTempStore(tempDir);
  });

  it("a gain change does: the written file is scaled", () => {
    expect(updateSampleGain(dbDir, "A0", 1, 0, -6).success).toBe(true);

    expect(modified("A0")).toBe(true);
    expect(modified("A1")).toBe(false);
  });

  it("a gain change on a missing sample doesn't", () => {
    expect(updateSampleGain(dbDir, "A1", 1, 0, -6).success).toBe(false);

    expect(modified("A1")).toBe(false);
  });

  it("renaming a voice doesn't: voice names aren't written to the card", () => {
    expect(updateVoiceAlias(dbDir, "A0", 2, "Snare").success).toBe(true);
    expect(updateVoiceAlias(dbDir, "A0", 2, "").success).toBe(true);

    expect(getKit(dbDir, "A0").data?.voices?.[1]?.voice_alias).toBe("");
    expect(modified("A0")).toBe(false);
  });

  it("the kit's alias, BPM, steps, conditions, slicer data and editable don't", () => {
    const edits = [
      { alias: "Drums" },
      { bpm: 140 },
      { step_pattern: [[127, 0, 0, 0]] },
      { trigger_conditions: [["1:2"]] },
      { slice_steps: [[null]] },
      { slicer_division: 8 },
      { editable: false },
    ];
    for (const edit of edits) {
      expect(updateKit(dbDir, "A0", edit).success).toBe(true);
    }

    expect(getKit(dbDir, "A0").data?.bpm).toBe(140);
    expect(modified("A0")).toBe(false);
  });

  it("a voice's level, sample mode and slicer settings don't", () => {
    expect(updateVoiceVolume(dbDir, "A0", 1, 60).success).toBe(true);
    expect(updateVoiceSampleMode(dbDir, "A0", 1, "random").success).toBe(true);
    expect(
      updateVoiceSliceSettings(dbDir, "A0", 1, {
        enabled: true,
        rollAmount: 2,
      }).success,
    ).toBe(true);

    expect(modified("A0")).toBe(false);
  });

  it("a favorite doesn't", () => {
    expect(toggleKitFavorite(dbDir, "A0").success).toBe(true);

    expect(modified("A0")).toBe(false);
  });

  it("adding a sample does", () => {
    const snare = wavFile(path.join(tempDir, "snare.wav"));
    expect(
      sampleService.addSampleToSlot(settings, "A1", 1, 0, snare).success,
    ).toBe(true);

    expect([modified("A0"), modified("A1")]).toEqual([false, true]);
  });

  it("deleting a sample does", () => {
    expect(
      sampleService.deleteSampleFromSlot(settings, "A0", 1, 0).success,
    ).toBe(true);

    expect(modified("A0")).toBe(true);
  });

  it("moving a sample within a kit does", () => {
    expect(
      sampleService.moveSampleInKit(settings, "A0", 1, 0, 2, 0, "insert")
        .success,
    ).toBe(true);

    expect(modified("A0")).toBe(true);
  });

  it("moving a sample to another kit does, for both kits", () => {
    expect(
      sampleService.moveSampleBetweenKits(settings, {
        fromKit: "A0",
        fromSlot: 0,
        fromVoice: 1,
        mode: "insert",
        toKit: "B0",
        toSlot: 0,
        toVoice: 1,
      }).success,
    ).toBe(true);

    expect([modified("A0"), modified("A1"), modified("B0")]).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("an undo's restore of a voice's samples does", () => {
    expect(
      sampleService.restoreVoices(settings, "A1", [
        {
          samples: [
            {
              filename: "kick.wav",
              gain_db: 0,
              slot_number: 0,
              source_mtime_ms: null,
              source_path: kickPath,
              source_size: null,
              source_status: null,
              wav_bit_depth: null,
              wav_bitrate: null,
              wav_channels: null,
              wav_format_tag: null,
              wav_sample_rate: null,
            },
          ],
          voice: 1,
        },
      ]).success,
    ).toBe(true);

    expect(modified("A1")).toBe(true);
  });

  it("linking, unlinking and Keep mono do: they decide which files go out as mono", () => {
    expect(updateVoiceStereoMode(dbDir, "A0", 1, true).success).toBe(true);
    expect(modified("A0")).toBe(true);

    markKitsAsSynced(dbDir, ["A0"]);
    expect(updateVoiceStereoMode(dbDir, "A0", 1, false).success).toBe(true);
    expect(modified("A0")).toBe(true);

    // Keep mono on a voice that isn't linked records the choice (#537)
    expect(updateVoiceStereoMode(dbDir, "A1", 3, false).success).toBe(true);
    expect(modified("A1")).toBe(true);
  });

  it("a refused link doesn't", () => {
    expect(updateVoiceStereoMode(dbDir, "A0", 4, true).success).toBe(false);

    expect(modified("A0")).toBe(false);
  });

  it("a scan that adds samples does; one that adds none doesn't", () => {
    // A scan adds a folder's files only to a kit that isn't editable
    expect(updateKit(dbDir, "A1", { editable: false }).success).toBe(true);
    wavFile(path.join(localStorePath, "A1", "1 kick.wav"));
    expect(scanService.rescanKit(settings, "A1").data?.addedSamples).toBe(1);
    expect(modified("A1")).toBe(true);

    markKitsAsSynced(dbDir, ["A1"]);
    expect(scanService.rescanKit(settings, "A1").success).toBe(true);
    expect(modified("A1")).toBe(false);
  });

  it("setup's import of the card's bank names doesn't: the card has them", () => {
    expect(
      updateBank(dbDir, "A", { artist: "Autechre" }, { source: "scan" })
        .success,
    ).toBe(true);

    expect([modified("A0"), modified("A1")]).toEqual([false, false]);
  });

  it("renaming or clearing a bank does, for every kit in it: its name file is on the card", () => {
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

  it("a new or duplicated kit starts modified: the card doesn't have it yet", () => {
    expect(kitService.createKit(settings, "C0").success).toBe(true);
    expect(modified("C0")).toBe(true);

    expect(copyKit(dbDir, "A0", "C1").success).toBe(true);
    expect(modified("C1")).toBe(true);
  });

  it("a completed write clears the flag on every kit, those without samples too", async () => {
    updateSampleGain(dbDir, "A0", 1, 0, -6);
    updateVoiceStereoMode(dbDir, "A1", 1, true);
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
      source_mtime_ms: null,
      source_path: path.join(tempDir, "gone.wav"),
      source_size: null,
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

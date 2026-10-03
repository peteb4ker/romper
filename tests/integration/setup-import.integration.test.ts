import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { getKit } from "../../electron/main/db/romperDbCoreORM.js";
import { LocalStoreSetupService } from "../../electron/main/services/localStoreSetupService.js";
import { encodeTestWav, sine } from "../validation/support/wav.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// RE-34: setup imports each kit in main: samples (12 per voice, in card
// order), WAV metadata and voice names, in one transaction per kit. Only
// into the store this setup created, and only folders named like kits.

function writeWav(file: string, channels: 1 | 2, sampleRate = 44100) {
  const tone = sine(220, 0.05, sampleRate);
  fs.writeFileSync(
    file,
    encodeTestWav(channels === 1 ? [tone] : [tone, tone], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate,
    }),
  );
}

describe("[UC-01] [UC-02] Setup imports kits in main (RE-34)", () => {
  let store: string;
  let dbDir: string;
  let setup: LocalStoreSetupService;

  beforeEach(() => {
    store = createTempStore("setup-import-");
    dbDir = path.join(store, ".romperdb");
    setup = new LocalStoreSetupService();
    expect(setup.createSetupDatabase(dbDir).success).toBe(true);

    const kit = path.join(store, "A0");
    fs.mkdirSync(kit);
    // 13 kicks: one more than voice 1's 12 slots
    for (let i = 1; i <= 13; i++) {
      writeWav(path.join(kit, `1 KICK ${String(i).padStart(2, "0")}.wav`), 1);
    }
    writeWav(path.join(kit, "2 SNARE.wav"), 2, 48000);
    // Not samples: macOS metadata and a file with no voice prefix
    fs.writeFileSync(path.join(kit, "._1 KICK 01.wav"), "metadata");
    writeWav(path.join(kit, "loop.wav"), 1);
  });

  afterEach(() => {
    removeTempStore(store);
  });

  it("imports samples in card order, with WAV metadata and voice names", () => {
    const result = setup.importSetupKit(dbDir, "A0");

    expect(result.success).toBe(true);
    expect(result.data?.skippedFiles).toEqual([
      { filename: "1 KICK 13.wav", reason: "voice_full", voiceNumber: 1 },
    ]);

    const kit = getKit(dbDir, "A0").data;
    expect(kit?.editable).toBe(false);
    expect(kit?.modified_since_sync).toBe(false);

    const samples = kit?.samples ?? [];
    const voice1 = samples
      .filter((s) => s.voice_number === 1)
      .sort((a, b) => a.slot_number - b.slot_number);
    expect(voice1.map((s) => s.filename)).toEqual(
      Array.from(
        { length: 12 },
        (_, i) => `1 KICK ${String(i + 1).padStart(2, "0")}.wav`,
      ),
    );
    expect(voice1.map((s) => s.slot_number)).toEqual(
      Array.from({ length: 12 }, (_, i) => i),
    );
    expect(voice1[0].source_path).toBe(path.join(store, "A0", "1 KICK 01.wav"));

    const snare = samples.find((s) => s.voice_number === 2);
    expect(snare).toMatchObject({
      filename: "2 SNARE.wav",
      wav_bit_depth: 16,
      wav_channels: 2,
      wav_sample_rate: 48000,
    });
    expect(samples).toHaveLength(13);

    const names = Object.fromEntries(
      (kit?.voices ?? []).map((v) => [v.voice_number, v.voice_alias]),
    );
    expect(names[1]).toMatch(/kick/i);
    expect(names[2]).toMatch(/snare/i);
  });

  it("refuses a store this setup didn't create", () => {
    const other = new LocalStoreSetupService();
    const result = other.importSetupKit(dbDir, "A0");
    expect(result.success).toBe(false);
    expect(getKit(dbDir, "A0").data).toBeFalsy();
  });

  it.each(["../A0", "Drums", "a0", "A100"])(
    "refuses %s, which isn't a kit folder name",
    (name) => {
      const result = setup.importSetupKit(dbDir, name);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Not a kit folder name/);
    },
  );

  it("reports a kit folder it can't read", () => {
    const result = setup.importSetupKit(dbDir, "B1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Can't read kit folder/);
  });
});

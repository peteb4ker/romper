import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { closeAllDbConnections } from "../../electron/main/db/utils/dbConnections.js";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import {
  addKit,
  addSample,
  createRomperDbFile,
  updateVoiceStereoMode,
} from "../../electron/main/db/romperDbCoreORM.js";
import { syncService } from "../../electron/main/services/syncService.js";

// RE-29: stereo is a voice setting. A stereo file on a voice linked as stereo
// is written as it is; on a voice that isn't linked, it's mixed to mono.
// Samples carry no stereo flag of their own.

const FRAMES = 4410;

/** Channel count and the first frame's samples of a card file */
function cardAudio(file: string) {
  const buffer = fs.readFileSync(file);
  const channels = buffer.readUInt16LE(22);
  const first = Array.from({ length: channels }, (_, ch) =>
    buffer.readInt16LE(44 + ch * 2),
  );
  return { bits: buffer.readUInt16LE(34), channels, first };
}

/** 16-bit PCM WAV with a constant value per channel */
function constantWav(values: number[]): Buffer {
  const channels = values.length;
  const data = Buffer.alloc(FRAMES * channels * 2);
  for (let f = 0; f < FRAMES; f++) {
    values.forEach((v, ch) => data.writeInt16LE(v, (f * channels + ch) * 2));
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(44100, 24);
  header.writeUInt32LE(44100 * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe("[UC-28] [UC-34] Writing stereo files to the card (RE-29)", () => {
  let tempDir: string;
  let dbDir: string;
  let sdCardPath: string;
  let settings: { localStorePath: string };
  const sources: Record<string, string> = {};

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-stereo-"));
    const localStorePath = path.join(tempDir, "store");
    dbDir = path.join(localStorePath, ".romperdb");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(sdCardPath, { recursive: true });
    fs.mkdirSync(localStorePath, { recursive: true });
    createRomperDbFile(dbDir);
    settings = { localStorePath };

    const files: Record<string, Buffer> = {
      "linked pad.wav": constantWav([1000, 3000]),
      "mono kick.wav": constantWav([1234]),
      "unlinked pad.wav": constantWav([1000, 3000]),
    };
    const samplesDir = path.join(tempDir, "samples");
    fs.mkdirSync(samplesDir);
    for (const [name, buffer] of Object.entries(files)) {
      sources[name] = path.join(samplesDir, name);
      fs.writeFileSync(sources[name], buffer);
    }

    addKit(dbDir, {
      alias: null,
      bank_letter: "A",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: "A0",
      step_pattern: null,
    });
    updateVoiceStereoMode(dbDir, "A0", 1, true);
    const add = (filename: string, voice: number) =>
      addSample(dbDir, {
        filename,
        // What every add and import path writes; it must not matter
        kit_name: "A0",
        slot_number: 0,
        source_path: sources[filename],
        voice_number: voice,
      });
    add("linked pad.wav", 1);
    add("unlinked pad.wav", 3);
    add("mono kick.wav", 4);
  });

  afterEach(() => {
    // Windows can't delete a database file that's still open
    closeAllDbConnections();
    fs.rmSync(tempDir, { force: true, recursive: true });
  });

  it("shows the mono mix as a conversion in the write summary", async () => {
    const summary = await syncService.generateChangeSummary(
      settings,
      sdCardPath,
    );
    expect(summary.success).toBe(true);
    expect(summary.data?.banks).toEqual([
      expect.objectContaining({ bank: "A", hasConversions: true }),
    ]);
    expect(summary.data?.warnings).toEqual([]);
  });

  it("keeps a linked voice's stereo file and mixes an unlinked one to mono", async () => {
    const result = await syncService.startKitSync(settings, { sdCardPath });
    expect(result.success).toBe(true);

    const kit = path.join(sdCardPath, "A0");
    expect(fs.readdirSync(kit).sort()).toEqual([
      "1-01 linked pad.wav",
      "3-01 unlinked pad.wav",
      "4-01 mono kick.wav",
    ]);
    // Linked as stereo: written byte for byte, still two channels
    expect(fs.readFileSync(path.join(kit, "1-01 linked pad.wav"))).toEqual(
      fs.readFileSync(sources["linked pad.wav"]),
    );
    // Not linked: one channel, the average of the two
    expect(cardAudio(path.join(kit, "3-01 unlinked pad.wav"))).toEqual({
      bits: 16,
      channels: 1,
      first: [2000],
    });
    // Mono already: untouched
    expect(fs.readFileSync(path.join(kit, "4-01 mono kick.wav"))).toEqual(
      fs.readFileSync(sources["mono kick.wav"]),
    );
  });

  it("writes the stereo file as it is once its voice is linked", async () => {
    updateVoiceStereoMode(dbDir, "A0", 3, true);
    const result = await syncService.startKitSync(settings, { sdCardPath });
    expect(result.success).toBe(true);
    expect(
      fs.readFileSync(path.join(sdCardPath, "A0", "3-01 unlinked pad.wav")),
    ).toEqual(fs.readFileSync(sources["unlinked pad.wav"]));
  });
});

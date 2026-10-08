import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { addKit, addSample } from "../../electron/main/db/romperDbCoreORM.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// RE-08: WAV files whose fmt chunk isn't the first 16 bytes after the RIFF
// header are written correctly; files Romper can't read are listed in the
// summary instead of aborting the sync.

function chunk(id: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(id, 0, "ascii");
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body, Buffer.alloc(body.length % 2)]);
}

function fmtChunk(tag: number, bits: number, subFormat?: number): Buffer {
  const body = Buffer.alloc(subFormat === undefined ? 16 : 40);
  body.writeUInt16LE(tag, 0);
  body.writeUInt16LE(1, 2); // mono
  body.writeUInt32LE(44100, 4);
  body.writeUInt32LE((44100 * bits) / 8, 8);
  body.writeUInt16LE(Math.max(1, bits / 8), 12);
  body.writeUInt16LE(bits, 14);
  if (subFormat !== undefined) {
    body.writeUInt16LE(22, 16);
    body.writeUInt16LE(bits, 18);
    body.writeUInt16LE(subFormat, 24);
  }
  return chunk("fmt ", body);
}

function riff(...chunks: Buffer[]): Buffer {
  const body = Buffer.concat([Buffer.from("WAVE", "ascii"), ...chunks]);
  const header = Buffer.alloc(8);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}

// 0.1 s of a 16-bit tone, and the same as 32-bit float
const FRAMES = 4410;
const pcm16 = Buffer.alloc(FRAMES * 2);
const float32 = Buffer.alloc(FRAMES * 4);
for (let i = 0; i < FRAMES; i++) {
  const v = Math.sin(i / 10) * 0.5;
  pcm16.writeInt16LE(Math.round(v * 32767), i * 2);
  float32.writeFloatLE(v, i * 4);
}

/** The format tag and fmt size of a file on the card */
function cardFormat(file: string) {
  const buffer = fs.readFileSync(file);
  return {
    bits: buffer.readUInt16LE(34),
    fmtSize: buffer.readUInt32LE(16),
    tag: buffer.readUInt16LE(20),
  };
}

describe("[UC-34] Syncing WAV files with unusual headers (RE-08)", () => {
  let tempDir: string;
  let dbDir: string;
  let sdCardPath: string;
  let settings: { localStorePath: string };
  const sources: Record<string, string> = {};

  beforeEach(() => {
    tempDir = createTempStore("sync-wav-formats-");
    const localStorePath = path.join(tempDir, "store");
    dbDir = path.join(localStorePath, ".romperdb");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(sdCardPath, { recursive: true });
    fs.mkdirSync(localStorePath, { recursive: true });
    createStoreDb(dbDir);
    settings = { localStorePath };

    const files: Record<string, Buffer> = {
      "adpcm.wav": riff(fmtChunk(2, 4), chunk("data", pcm16)),
      "extensible.wav": riff(fmtChunk(0xfffe, 16, 1), chunk("data", pcm16)),
      "float.wav": riff(fmtChunk(3, 32), chunk("data", float32)),
      "junk-first.wav": riff(
        chunk("JUNK", Buffer.alloc(28)),
        fmtChunk(1, 16),
        chunk("data", pcm16),
      ),
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
    ["junk-first.wav", "extensible.wav", "float.wav"].forEach((name, slot) =>
      addSample(dbDir, {
        filename: name,
        kit_name: "A0",
        slot_number: slot,
        source_path: sources[name],
        voice_number: 1,
      }),
    );
    // A WAV Romper can't read quarantines its kit (#537 rule 4), so it
    // lives in a kit of its own
    addKit(dbDir, {
      alias: null,
      bank_letter: "A",
      editable: true,
      locked: false,
      modified_since_sync: false,
      name: "A1",
      step_pattern: null,
    });
    addSample(dbDir, {
      filename: "adpcm.wav",
      kit_name: "A1",
      slot_number: 0,
      source_path: sources["adpcm.wav"],
      voice_number: 1,
    });
  });

  afterEach(() => {
    removeTempStore(tempDir);
  });

  it("quarantines the kit with the unreadable file and writes the rest in a format the Rample reads", async () => {
    const summary = await syncService.generateChangeSummary(
      settings,
      sdCardPath,
    );
    expect(summary.data?.fileCount).toBe(3);
    expect(summary.data?.validationErrors).toEqual([]);
    expect(summary.data?.stereo.quarantined).toEqual([
      {
        kitName: "A1",
        problems: [
          { filename: "adpcm.wav", kind: "unreadable", voiceNumber: 1 },
        ],
      },
    ]);

    const result = await syncService.startKitSync(settings, { sdCardPath });
    expect(result.success).toBe(true);
    expect(result.data?.syncedFiles).toBe(3);

    expect(fs.existsSync(path.join(sdCardPath, "A1"))).toBe(false);
    const kit = path.join(sdCardPath, "A0");
    expect(fs.readdirSync(kit).sort()).toEqual([
      "1-01 junk-first.wav",
      "1-02 extensible.wav",
      "1-03 float.wav",
    ]);
    // Already compliant: copied byte for byte, JUNK chunk and all
    expect(fs.readFileSync(path.join(kit, "1-01 junk-first.wav"))).toEqual(
      fs.readFileSync(sources["junk-first.wav"]),
    );
    // Rewritten as plain 16-bit PCM
    for (const name of ["1-02 extensible.wav", "1-03 float.wav"]) {
      expect(cardFormat(path.join(kit, name))).toEqual({
        bits: 16,
        fmtSize: 16,
        tag: 1,
      });
    }
  });
});

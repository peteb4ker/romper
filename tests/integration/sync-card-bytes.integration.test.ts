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
  updateVoiceStereoMode,
} from "../../electron/main/db/romperDbCoreORM.js";
import { syncService } from "../../electron/main/services/syncService.js";
import {
  decodeWav,
  encodeTestWav,
  maxSampleDifference,
  readPcm16,
  readWavInfo,
  referenceConversion,
  sine,
  type WavFormat,
} from "../validation/support/wav";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// RE-67: Romper's main promise, checked on the bytes. A kit of generated
// audio in the formats people drop on it goes through the real write to a
// card folder, and every file on the card is compared with what it should
// be: byte for byte where the Rample plays the file as it is, and sample by
// sample where Romper converts it, against the validation harness's own
// reference conversion (tests/validation/support/wav.ts), which shares no
// code with the app's converter.
//
// Stereo is a voice setting: voices 1 and 2 are linked, so their stereo
// files stay stereo; voices 3 and 4 aren't, so a stereo file there is mixed
// down to mono. Nothing reads stereo from a file's channel count alone.

const SECONDS = 0.25;

type Format = Omit<WavFormat, "channels">;
const pcm = (bitDepth: number, sampleRate = 44100): Format => ({
  bitDepth,
  encoding: "pcm",
  sampleRate,
});

interface KitFile {
  /** What should reach the card: the source's bytes, or a conversion */
  expect: "convert" | "copy";
  extensible?: boolean;
  extraChunk?: boolean;
  format: Format;
  gainDb?: number;
  /** Channels in the source file */
  inputChannels: 1 | 2;
  name: string;
  /** Channels on the card, for a converted file */
  outputChannels: 1 | 2;
  slot: number;
  voice: number;
}

/** A tone per channel, at that format's rate */
function tones(format: Format, channels: 1 | 2): Float64Array[] {
  const left = sine(220, SECONDS, format.sampleRate, 0.5);
  return channels === 1
    ? [left]
    : [left, sine(330, SECONDS, format.sampleRate, 0.4)];
}

// Voices 1 and 2 are a stereo pair; a mono file in a pair would quarantine
// the kit (#537 rule 4), so the pair holds stereo files only. Voice 4 has
// samples, so voice 3 can't be linked automatically (rule 2).
const KIT: KitFile[] = [
  // The pair: stereo as it is, and stereo converted (still stereo)
  {
    expect: "copy",
    extraChunk: true,
    format: pcm(16),
    inputChannels: 2,
    name: "pad 16.wav",
    outputChannels: 2,
    slot: 0,
    voice: 1,
  },
  {
    expect: "convert",
    format: pcm(24, 48000),
    inputChannels: 2,
    name: "pad 24-48k.wav",
    outputChannels: 2,
    slot: 1,
    voice: 1,
  },
  // A mono voice: mono files copied, a stereo file mixed down
  {
    expect: "copy",
    format: pcm(16),
    inputChannels: 1,
    name: "kick 16.wav",
    outputChannels: 1,
    slot: 0,
    voice: 3,
  },
  {
    expect: "copy",
    format: pcm(8),
    inputChannels: 1,
    name: "kick 8.wav",
    outputChannels: 1,
    slot: 1,
    voice: 3,
  },
  {
    expect: "convert",
    format: pcm(16),
    inputChannels: 2,
    name: "loop stereo.wav",
    outputChannels: 1,
    slot: 2,
    voice: 3,
  },
  // Voice 4, which can't be linked: every kind of conversion
  {
    expect: "convert",
    format: { bitDepth: 32, encoding: "float", sampleRate: 44100 },
    inputChannels: 1,
    name: "hat float.wav",
    outputChannels: 1,
    slot: 0,
    voice: 4,
  },
  {
    expect: "convert",
    format: pcm(16),
    gainDb: 3,
    inputChannels: 1,
    name: "hat gain.wav",
    outputChannels: 1,
    slot: 1,
    voice: 4,
  },
  {
    expect: "convert",
    extensible: true,
    format: pcm(24),
    inputChannels: 1,
    name: "hat extensible.wav",
    outputChannels: 1,
    slot: 2,
    voice: 4,
  },
  {
    expect: "convert",
    format: pcm(24, 48000),
    inputChannels: 2,
    name: "hat stereo 48k.wav",
    outputChannels: 1,
    slot: 3,
    voice: 4,
  },
];

const cardName = (f: KitFile) =>
  `${f.voice}-${String(f.slot + 1).padStart(2, "0")} ${f.name}`;

/** Every file under `dir`, relative, with its bytes */
function snapshot(dir: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const entry of fs.readdirSync(dir, { recursive: true })) {
    const full = path.join(dir, String(entry));
    if (fs.statSync(full).isFile())
      files.set(String(entry), fs.readFileSync(full));
  }
  return files;
}

describe("[UC-28] [UC-34] [Q-07] What reaches the card, byte for byte (RE-67)", () => {
  let tempDir: string;
  let dbDir: string;
  let sdCardPath: string;
  let settings: { localStorePath: string };
  const sources = new Map<string, string>();

  beforeEach(() => {
    tempDir = createTempStore("sync-card-bytes-");
    const localStorePath = path.join(tempDir, "store");
    dbDir = path.join(localStorePath, ".romperdb");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(sdCardPath, { recursive: true });
    fs.mkdirSync(localStorePath, { recursive: true });
    createStoreDb(dbDir);
    settings = { localStorePath };

    const samplesDir = path.join(tempDir, "samples");
    fs.mkdirSync(samplesDir);
    for (const file of KIT) {
      const source = path.join(samplesDir, file.name);
      fs.writeFileSync(
        source,
        encodeTestWav(tones(file.format, file.inputChannels), file.format, {
          extensible: file.extensible,
          extraChunk: file.extraChunk,
        }),
      );
      sources.set(file.name, source);
    }

    addKit(dbDir, {
      alias: null,
      bank_letter: "A",
      editable: true,
      locked: false,
      modified_since_sync: true,
      name: "A0",
      step_pattern: null,
    });
    expect(updateVoiceStereoMode(dbDir, "A0", 1, true).success).toBe(true);
    for (const file of KIT) {
      expect(
        addSample(dbDir, {
          filename: file.name,
          gain_db: file.gainDb ?? 0,
          kit_name: "A0",
          slot_number: file.slot,
          source_path: sources.get(file.name) ?? "",
          voice_number: file.voice,
        }).success,
      ).toBe(true);
    }
  });

  afterEach(() => {
    removeTempStore(tempDir);
  });

  it("writes every sample once, in the kit's folder, and nothing else", async () => {
    const result = await syncService.startKitSync(settings, { sdCardPath });
    expect(result.success).toBe(true);
    expect(result.data?.syncedFiles).toBe(KIT.length);

    expect(fs.readdirSync(sdCardPath)).toEqual(["A0"]);
    // Voice 2 is voice 1's right channel: it gets no file of its own
    expect(fs.readdirSync(path.join(sdCardPath, "A0")).sort()).toEqual(
      KIT.map(cardName).sort(),
    );
  });

  it("copies the files the Rample plays as they are, byte for byte", async () => {
    await syncService.startKitSync(settings, { sdCardPath });

    const copies = KIT.filter((f) => f.expect === "copy");
    expect(copies.map((f) => f.name)).toEqual([
      "pad 16.wav",
      "kick 16.wav",
      "kick 8.wav",
    ]);
    for (const file of copies) {
      const card = fs.readFileSync(path.join(sdCardPath, "A0", cardName(file)));
      // Chunks and all: the LIST chunk survives
      expect(
        card.equals(fs.readFileSync(sources.get(file.name) ?? "")),
        file.name,
      ).toBe(true);
    }
  });

  it("converts the rest to plain 16-bit, 44.1 kHz audio that matches the reference conversion", async () => {
    await syncService.startKitSync(settings, { sdCardPath });

    for (const file of KIT.filter((f) => f.expect === "convert")) {
      const card = fs.readFileSync(path.join(sdCardPath, "A0", cardName(file)));
      const info = readWavInfo(card);
      expect(
        {
          bitDepth: info.bitDepth,
          channels: info.channels,
          chunks: info.chunks,
          dataOffset: info.dataOffset,
          formatTag: info.formatTag,
          sampleRate: info.sampleRate,
        },
        file.name,
      ).toEqual({
        bitDepth: 16,
        // A linked voice's stereo file stays stereo; elsewhere it's mixed down
        channels: file.outputChannels,
        chunks: ["fmt ", "data"],
        dataOffset: 44,
        formatTag: 1,
        sampleRate: 44100,
      });

      const reference = referenceConversion(
        decodeWav(fs.readFileSync(sources.get(file.name) ?? "")),
        { gainDb: file.gainDb ?? 0, outputChannels: file.outputChannels },
      );
      // Within one step of the reference, sample by sample, same length
      expect(
        maxSampleDifference(readPcm16(card), reference),
        file.name,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("changes nothing on the card when it writes the same store again", async () => {
    await syncService.startKitSync(settings, { sdCardPath });
    const first = snapshot(sdCardPath);

    const again = await syncService.startKitSync(settings, { sdCardPath });
    expect(again.success).toBe(true);
    const second = snapshot(sdCardPath);

    expect([...second.keys()].sort()).toEqual([...first.keys()].sort());
    for (const [file, bytes] of first) {
      expect(second.get(file)?.equals(bytes), file).toBe(true);
    }
  });
});

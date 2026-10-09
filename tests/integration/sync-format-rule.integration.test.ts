import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
}));

import { cardSampleFileName } from "@romper/shared/rampleCardLayout";
import { planKitStereo, stereoSampleOf } from "@romper/shared/stereoLinkRules";

import { getCompatibilityStatus } from "../../app/renderer/utils/wavMetadataFormatter.js";
import {
  addKit,
  addSample,
  getSyncPlanData,
  updateVoiceStereoMode,
} from "../../electron/main/db/romperDbCoreORM.js";
import { readWavMetadata } from "../../electron/main/services/scanService.js";
import { syncService } from "../../electron/main/services/syncService.js";
import { createStoreDb } from "./support/storeDb.js";
import { createTempStore, removeTempStore } from "./support/tempStore.js";

// #576: a sample's format badge and the write plan their answer with one
// rule (planConversion in shared/rampleFormat.ts), so for every file the
// badge says "native" exactly when the write copies it byte for byte. The
// summary counts gain re-encodes as conversions and warns about samples
// shorter than the Rample's 50 ms minimum.

interface Placed {
  gain?: number;
  kit: string;
  name: string;
  spec: WavSpec;
  voice: number;
}

interface WavSpec {
  bits?: number;
  channels?: number;
  extensible?: boolean;
  float?: boolean;
  frames?: number;
  rate?: number;
}

/** A WAV file of silence-ish noise in the given format */
function wav({
  bits = 16,
  channels = 1,
  extensible = false,
  float = false,
  frames = 4410,
  rate = 44100,
}: WavSpec): Buffer {
  const blockAlign = channels * (bits / 8);
  const data = Buffer.alloc(frames * blockAlign);
  for (let i = 0; i < data.length; i++) data[i] = (i * 7) % 251;
  if (float) {
    for (let i = 0; i < frames * channels; i++) {
      data.writeFloatLE(Math.sin(i / 10) * 0.5, i * 4);
    }
  }
  const fmt = Buffer.alloc(extensible ? 40 : 16);
  const tag = float ? 3 : 1;
  fmt.writeUInt16LE(extensible ? 0xfffe : tag, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE(rate * blockAlign, 8);
  fmt.writeUInt16LE(blockAlign, 12);
  fmt.writeUInt16LE(bits, 14);
  if (extensible) {
    fmt.writeUInt16LE(22, 16);
    fmt.writeUInt16LE(bits, 18);
    fmt.writeUInt16LE(tag, 24); // the sub-format GUID's first two bytes
  }
  const chunk = (id: string, body: Buffer) => {
    const header = Buffer.alloc(8);
    header.write(id, 0, "ascii");
    header.writeUInt32LE(body.length, 4);
    return Buffer.concat([header, body, Buffer.alloc(body.length % 2)]);
  };
  const body = Buffer.concat([
    Buffer.from("WAVE", "ascii"),
    chunk("fmt ", fmt),
    chunk("data", data),
  ]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

const SAMPLES: Placed[] = [
  // A0 voice 1 is linked by hand: its stereo file is written as stereo
  { kit: "A0", name: "pad linked", spec: { channels: 2 }, voice: 1 },
  // Voice 3 can't pair (voice 4 has samples): its stereo file is mixed down
  { kit: "A0", name: "pad unlinked", spec: { channels: 2 }, voice: 3 },
  { kit: "A0", name: "native", spec: {}, voice: 4 },
  { kit: "A0", name: "eight bit", spec: { bits: 8 }, voice: 4 },
  { kit: "A0", name: "24-bit", spec: { bits: 24 }, voice: 4 },
  { kit: "A0", name: "48 kHz", spec: { frames: 4800, rate: 48000 }, voice: 4 },
  { kit: "A0", name: "float", spec: { bits: 32, float: true }, voice: 4 },
  { kit: "A0", name: "extensible", spec: { extensible: true }, voice: 4 },
  { kit: "A0", name: "quad", spec: { channels: 4 }, voice: 4 },
  { gain: -6, kit: "A0", name: "gain", spec: {}, voice: 4 },
  { kit: "A0", name: "20 ms", spec: { frames: 882 }, voice: 4 },
  { kit: "A0", name: "exactly 50 ms", spec: { frames: 2205 }, voice: 4 },
  { kit: "A0", name: "10 ms", spec: { frames: 441 }, voice: 4 },
  // A1 voice 1 isn't linked, but the write links it automatically (#537
  // rule 2), so its stereo file is written as stereo
  { kit: "A1", name: "pad auto-linked", spec: { channels: 2 }, voice: 1 },
];

describe("[UC-34] [Q-08] One format rule for the badge and the write (#576)", () => {
  let tempDir: string;
  let dbDir: string;
  let sdCardPath: string;
  let settings: { localStorePath: string };
  const sources: Record<string, string> = {};

  beforeEach(() => {
    tempDir = createTempStore("sync-format-rule-");
    const localStorePath = path.join(tempDir, "store");
    dbDir = path.join(localStorePath, ".romperdb");
    sdCardPath = path.join(tempDir, "card");
    fs.mkdirSync(sdCardPath, { recursive: true });
    fs.mkdirSync(localStorePath, { recursive: true });
    createStoreDb(dbDir);
    settings = { localStorePath };

    const samplesDir = path.join(tempDir, "samples");
    fs.mkdirSync(samplesDir);
    for (const kit of ["A0", "A1"]) {
      addKit(dbDir, {
        alias: null,
        bank_letter: "A",
        editable: true,
        locked: false,
        modified_since_sync: false,
        name: kit,
        step_pattern: null,
      });
    }
    updateVoiceStereoMode(dbDir, "A0", 1, true);

    const slots = new Map<string, number>();
    for (const { gain, kit, name, spec, voice } of SAMPLES) {
      const source = path.join(samplesDir, `${name}.wav`);
      fs.writeFileSync(source, wav(spec));
      sources[name] = source;
      const key = `${kit}:${voice}`;
      const slot = slots.get(key) ?? 0;
      slots.set(key, slot + 1);
      // The columns adding a sample stores, from the file's header
      const columns = readWavMetadata(source);
      expect(columns).not.toBeNull();
      addSample(dbDir, {
        filename: `${name}.wav`,
        gain_db: gain ?? 0,
        kit_name: kit,
        slot_number: slot,
        source_path: source,
        voice_number: voice,
        ...columns,
      });
    }
  });

  afterEach(() => {
    removeTempStore(tempDir);
  });

  /** Each sample's badge, as the kit editor shows it before the write */
  function badges(): Map<string, null | string> {
    const plan = getSyncPlanData(dbDir);
    expect(plan.success).toBe(true);
    const { samples, voices } = plan.data!;
    const result = new Map<string, null | string>();
    for (const kit of ["A0", "A1"]) {
      const kitSamples = samples.filter((s) => s.kit_name === kit);
      const links = planKitStereo(
        voices.filter((v) => v.kit_name === kit),
        kitSamples.map(stereoSampleOf),
      ).links;
      for (const sample of kitSamples) {
        result.set(
          sample.filename.replace(/\.wav$/, ""),
          getCompatibilityStatus(
            {
              filename: sample.filename,
              gain_db: sample.gain_db,
              source_path: sample.source_path,
              wav_bit_depth: sample.wav_bit_depth ?? undefined,
              wav_channels: sample.wav_channels ?? undefined,
              wav_format_tag: sample.wav_format_tag ?? undefined,
              wav_sample_rate: sample.wav_sample_rate ?? undefined,
            },
            { stereoVoice: links.includes(sample.voice_number) },
          ),
        );
      }
    }
    return result;
  }

  it("shows native exactly for the files the write copies as they are", async () => {
    const before = badges();
    expect(Object.fromEntries(before)).toEqual({
      "10 ms": "native",
      "20 ms": "native",
      "24-bit": "convertible",
      "48 kHz": "convertible",
      "eight bit": "native",
      "exactly 50 ms": "native",
      extensible: "convertible",
      float: "convertible",
      gain: "convertible",
      native: "native",
      "pad auto-linked": "native",
      "pad linked": "native",
      "pad unlinked": "convertible",
      quad: "convertible",
    });

    const result = await syncService.startKitSync(settings, { sdCardPath });
    expect(result.success).toBe(true);
    expect(result.data?.syncedFiles).toBe(SAMPLES.length);

    const slots = new Map<string, number>();
    for (const { kit, name, voice } of SAMPLES) {
      const key = `${kit}:${voice}`;
      const slot = slots.get(key) ?? 0;
      slots.set(key, slot + 1);
      const card = path.join(
        sdCardPath,
        kit,
        cardSampleFileName(voice, slot, `${name}.wav`),
      );
      const copied = fs
        .readFileSync(card)
        .equals(fs.readFileSync(sources[name]));
      expect({ copied, name }).toEqual({
        copied: before.get(name) === "native",
        name,
      });
    }
  });

  it("counts gain re-encodes as conversions, and warns about samples under 50 ms", async () => {
    const summary = await syncService.generateChangeSummary(
      settings,
      sdCardPath,
    );
    expect(summary.success).toBe(true);
    // Format: the mixdown, 24-bit, 48 kHz, float, extensible, quad
    expect(summary.data?.conversions).toEqual({ format: 6, gain: 1 });
    // 20 ms and 10 ms; exactly 50 ms is long enough
    expect(summary.data?.warnings).toContain(
      "2 samples are shorter than the Rample's 50 ms minimum.",
    );
    expect(summary.data?.banks).toEqual([
      expect.objectContaining({ bank: "A", hasConversions: true }),
    ]);
  });
});

import { describe, expect, it } from "vitest";

import {
  decodeWav,
  encodeTestWav,
  isRampleNative,
  maxSampleDifference,
  readPcm16,
  readWavInfo,
  referenceConversion,
  sine,
} from "../wav";

// The full-pipeline validation uses this module as its oracle for what the
// card should hold, so it gets its own tests.

const pcm16 = { bitDepth: 16, encoding: "pcm", sampleRate: 44100 } as const;

function pcm16Buffer(values: number[][]): Buffer {
  // Build exact integer samples, independent of encodeTestWav's scaling
  const frames = values[0].length;
  const data = Buffer.alloc(frames * values.length * 2);
  for (let f = 0; f < frames; f++) {
    for (let ch = 0; ch < values.length; ch++) {
      data.writeInt16LE(values[ch][f], (f * values.length + ch) * 2);
    }
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(values.length, 22);
  header.writeUInt32LE(44100, 24);
  header.writeUInt32LE(44100 * values.length * 2, 28);
  header.writeUInt16LE(values.length * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe("readWavInfo", () => {
  it("skips an odd-length chunk's pad byte to find the data", () => {
    const wav = encodeTestWav([sine(440, 0.01, 44100)], pcm16, {
      extraChunk: true,
    });
    const info = readWavInfo(wav);
    expect(info.chunks).toEqual(["fmt ", "LIST", "data"]);
    expect(info.dataOffset + info.dataLength).toBe(wav.length);
  });

  it("resolves an extensible header to its sub-format", () => {
    const wav = encodeTestWav([sine(440, 0.01, 44100)], {
      bitDepth: 32,
      encoding: "float",
      sampleRate: 44100,
    });
    // Rewrite as WAVE_FORMAT_EXTENSIBLE: 40-byte fmt, float sub-format
    const fmt = Buffer.alloc(48);
    fmt.write("fmt ", 0, "ascii");
    fmt.writeUInt32LE(40, 4);
    wav.copy(fmt, 8, 20, 36);
    fmt.writeUInt16LE(0xfffe, 8);
    fmt.writeUInt16LE(22, 24);
    fmt.writeUInt16LE(3, 32);
    const body = Buffer.concat([fmt, wav.subarray(36)]);
    const riff = Buffer.alloc(12);
    riff.write("RIFF", 0, "ascii");
    riff.writeUInt32LE(4 + body.length, 4);
    riff.write("WAVE", 8, "ascii");
    const info = readWavInfo(Buffer.concat([riff, body]));
    expect(info.formatTag).toBe(0xfffe);
    expect(info.encoding).toBe("float");
  });

  it("rejects a file that isn't RIFF/WAVE", () => {
    expect(() => readWavInfo(Buffer.from("not a wav file at all"))).toThrow();
  });
});

describe("decodeWav", () => {
  it("scales 16-bit asymmetrically so full scale is exactly ±1", () => {
    const decoded = decodeWav(pcm16Buffer([[-32768, 0, 32767]]));
    expect(Array.from(decoded.channels[0])).toEqual([-1, 0, 1]);
  });

  it("round-trips 24-bit samples", () => {
    const signal = sine(1000, 0.01, 48000, 0.9);
    const wav = encodeTestWav([signal], {
      bitDepth: 24,
      encoding: "pcm",
      sampleRate: 48000,
    });
    const decoded = decodeWav(wav).channels[0];
    for (let i = 0; i < signal.length; i++) {
      expect(Math.abs(decoded[i] - signal[i])).toBeLessThan(1 / 8388607);
    }
  });
});

describe("referenceConversion", () => {
  it("leaves 16-bit, 44.1 kHz audio unchanged with no gain", () => {
    const values = [-32768, -1234, 0, 1, 32767];
    const out = referenceConversion(decodeWav(pcm16Buffer([values])), {
      gainDb: 0,
      outputChannels: 1,
    });
    expect(Array.from(out[0])).toEqual(values);
  });

  it("mixes stereo to mono by averaging", () => {
    const out = referenceConversion(
      decodeWav(
        pcm16Buffer([
          [16383, -16384, 1000],
          [16383, 16383, -1000],
        ]),
      ),
      { gainDb: 0, outputChannels: 1 },
    );
    expect(out).toHaveLength(1);
    expect(Array.from(out[0])).toEqual([16383, 0, 0]);
  });

  it("applies gain and clamps at full scale", () => {
    const out = referenceConversion(decodeWav(pcm16Buffer([[10000, 30000]])), {
      gainDb: 6,
      outputChannels: 1,
    });
    expect(out[0][0]).toBe(
      Math.round((10000 / 32767) * 10 ** (6 / 20) * 32767),
    );
    expect(out[0][1]).toBe(32767);
  });

  it("resamples 48 kHz to floor(length * 44100 / 48000) frames", () => {
    const wav = encodeTestWav([sine(440, 0.1, 48000)], {
      bitDepth: 16,
      encoding: "pcm",
      sampleRate: 48000,
    });
    const out = referenceConversion(decodeWav(wav), {
      gainDb: 0,
      outputChannels: 1,
    });
    expect(out[0].length).toBe(Math.floor(4800 * (44100 / 48000)));
  });
});

describe("isRampleNative", () => {
  it("accepts 8- and 16-bit PCM at 44.1 kHz, mono or stereo", () => {
    expect(isRampleNative({ ...pcm16, channels: 2 })).toBe(true);
    expect(isRampleNative({ ...pcm16, bitDepth: 8, channels: 1 })).toBe(true);
  });

  it("rejects 24-bit, float, other rates and more than 2 channels", () => {
    expect(isRampleNative({ ...pcm16, bitDepth: 24, channels: 1 })).toBe(false);
    expect(
      isRampleNative({
        ...pcm16,
        bitDepth: 32,
        channels: 1,
        encoding: "float",
      }),
    ).toBe(false);
    expect(isRampleNative({ ...pcm16, channels: 1, sampleRate: 48000 })).toBe(
      false,
    );
    expect(isRampleNative({ ...pcm16, channels: 3 })).toBe(false);
  });
});

describe("readPcm16 and maxSampleDifference", () => {
  it("reads back what was written and reports the largest difference", () => {
    const a = readPcm16(pcm16Buffer([[1, 2, 3]]));
    const b = readPcm16(pcm16Buffer([[1, 3, 3]]));
    expect(maxSampleDifference(a, a)).toBe(0);
    expect(maxSampleDifference(a, b)).toBe(1);
  });

  it("treats different lengths or channel counts as a mismatch", () => {
    const mono = readPcm16(pcm16Buffer([[1, 2]]));
    expect(maxSampleDifference(mono, readPcm16(pcm16Buffer([[1]])))).toBe(
      Infinity,
    );
    expect(
      maxSampleDifference(
        mono,
        readPcm16(
          pcm16Buffer([
            [1, 2],
            [1, 2],
          ]),
        ),
      ),
    ).toBe(Infinity);
  });
});

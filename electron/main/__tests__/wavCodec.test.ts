import { describe, expect, it } from "vitest";

import type { WavHeader } from "../wavHeader";

import {
  decodeSamples,
  decodeWav,
  type EncodeBitDepth,
  encodeWav,
} from "../wavCodec";

function samples(
  bitDepth: number,
  values: number[],
  write: (buffer: Buffer, value: number, offset: number) => void,
): Buffer {
  const bytes = bitDepth / 8;
  const buffer = Buffer.alloc(values.length * bytes);
  values.forEach((value, i) => write(buffer, value, i * bytes));
  return buffer;
}

/** A minimal WAV: RIFF/WAVE, 16-byte fmt, optional extra chunks, data */
function wavFile(
  format: { bitDepth: number; channels: number; float?: boolean },
  data: Buffer,
  chunksBeforeData: Buffer[] = [],
): Buffer {
  const fmt = Buffer.alloc(24);
  const blockAlign = format.channels * (format.bitDepth / 8);
  fmt.write("fmt ", 0, "ascii");
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(format.float ? 3 : 1, 8);
  fmt.writeUInt16LE(format.channels, 10);
  fmt.writeUInt32LE(44100, 12);
  fmt.writeUInt32LE(44100 * blockAlign, 16);
  fmt.writeUInt16LE(blockAlign, 20);
  fmt.writeUInt16LE(format.bitDepth, 22);
  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0, "ascii");
  dataHeader.writeUInt32LE(data.length, 4);
  const body = Buffer.concat([
    Buffer.from("WAVE", "ascii"),
    fmt,
    ...chunksBeforeData,
    dataHeader,
    data,
  ]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(body.length, 4);
  return Buffer.concat([riff, body]);
}

const int16 = (values: number[]) =>
  samples(16, values, (b, v, o) => b.writeInt16LE(v, o));
const int24 = (values: number[]) =>
  samples(24, values, (b, v, o) => b.writeIntLE(v, o, 3));
const int32 = (values: number[]) =>
  samples(32, values, (b, v, o) => b.writeInt32LE(v, o));

const decodeMono = (buffer: Buffer) => [...decodeWav(buffer).channelData[0]];

describe("decodeWav", () => {
  it("decodes 8-bit unsigned PCM with 128 as silence", () => {
    const file = wavFile(
      { bitDepth: 8, channels: 1 },
      Buffer.from([0, 64, 128, 255]),
    );
    expect(decodeMono(file)).toEqual([-1, -0.5, 0, 1]);
  });

  it("decodes 16-bit PCM", () => {
    const file = wavFile(
      { bitDepth: 16, channels: 1 },
      int16([-32768, -16384, 0, 32767]),
    );
    expect(decodeMono(file)).toEqual([-1, -0.5, 0, 1]);
  });

  it("decodes the most negative 24-bit sample as -1 (node-wav gave +1.0000001)", () => {
    const file = wavFile(
      { bitDepth: 24, channels: 1 },
      int24([-8388608, -1, 0, 8388607]),
    );
    const decoded = decodeMono(file);
    expect(decoded[0]).toBe(-1);
    expect(decoded[1]).toBeCloseTo(-1 / 8388608, 12);
    expect(decoded.slice(2)).toEqual([0, 1]);
  });

  it("decodes 32-bit PCM", () => {
    const file = wavFile(
      { bitDepth: 32, channels: 1 },
      int32([-2147483648, 0, 2147483647]),
    );
    expect(decodeMono(file)).toEqual([-1, 0, 1]);
  });

  it("passes float samples through unclamped", () => {
    const f32 = Buffer.alloc(12);
    [-0.25, 0.5, 1.5].forEach((v, i) => f32.writeFloatLE(v, i * 4));
    expect(
      decodeMono(wavFile({ bitDepth: 32, channels: 1, float: true }, f32)),
    ).toEqual([-0.25, 0.5, 1.5]);

    const f64 = Buffer.alloc(16);
    [0.1, -2].forEach((v, i) => f64.writeDoubleLE(v, i * 8));
    expect(
      decodeMono(wavFile({ bitDepth: 64, channels: 1, float: true }, f64)),
    ).toEqual([Math.fround(0.1), -2]);
  });

  it("splits interleaved channels", () => {
    const file = wavFile(
      { bitDepth: 16, channels: 2 },
      int16([32767, -32768, 0, 16384]),
    );
    const { channelData, sampleRate } = decodeWav(file);
    expect(sampleRate).toBe(44100);
    expect([...channelData[0]]).toEqual([1, 0]);
    expect([...channelData[1]]).toEqual([-1, Math.fround(16384 / 32767)]);
  });

  it("reads samples after an odd-sized chunk and its pad byte (#388)", () => {
    const inst = Buffer.alloc(16);
    inst.write("inst", 0, "ascii");
    inst.writeUInt32LE(7, 4); // 7-byte body, then 1 pad byte
    const file = wavFile({ bitDepth: 16, channels: 1 }, int16([16384]), [inst]);
    expect(decodeMono(file)).toEqual([Math.fround(16384 / 32767)]);
  });

  it("decodes a Buffer that is a view into a larger ArrayBuffer", () => {
    const file = wavFile({ bitDepth: 16, channels: 1 }, int16([-16384, 8]));
    const backing = new ArrayBuffer(file.length + 101);
    const pooled = Buffer.from(backing, 101, file.length);
    file.copy(pooled);
    expect(decodeMono(pooled)).toEqual([-0.5, Math.fround(8 / 32767)]);
  });

  it("throws the header parser's reason for a file it can't read", () => {
    expect(() => decodeWav(Buffer.from("not a wav file at all"))).toThrow(
      "Not a WAV file",
    );
  });
});

describe("decodeSamples", () => {
  const header = (overrides: Partial<WavHeader>): WavHeader => ({
    bitDepth: 16,
    blockAlign: 2,
    channels: 1,
    dataOffset: 0,
    dataSize: 0,
    encoding: "pcm",
    extensible: false,
    sampleRate: 44100,
    ...overrides,
  });

  it("reads samples at an odd offset", () => {
    const buffer = Buffer.concat([Buffer.alloc(45), int16([32767, -32768])]);
    const decoded = decodeSamples(
      buffer,
      header({ dataOffset: 45, dataSize: 4 }),
    );
    expect([...decoded.channelData[0]]).toEqual([1, -1]);
  });

  it("drops a partial frame at the end of the data", () => {
    const buffer = int16([1, 2, 3]);
    const decoded = decodeSamples(
      buffer,
      header({ blockAlign: 4, channels: 2, dataSize: 6 }),
    );
    expect(decoded.channelData.map((c) => c.length)).toEqual([1, 1]);
  });
});

describe("encodeWav", () => {
  it("writes a 44-byte header for plain integer PCM", () => {
    const out = encodeWav(
      [new Float32Array(3), new Float32Array(3)],
      44100,
      16,
    );

    expect(out.length).toBe(44 + 12);
    expect(out.toString("ascii", 0, 4)).toBe("RIFF");
    expect(out.readUInt32LE(4)).toBe(out.length - 8);
    expect(out.toString("ascii", 8, 16)).toBe("WAVEfmt ");
    expect(out.readUInt32LE(16)).toBe(16);
    expect(out.readUInt16LE(20)).toBe(1); // PCM
    expect(out.readUInt16LE(22)).toBe(2); // channels
    expect(out.readUInt32LE(24)).toBe(44100);
    expect(out.readUInt32LE(28)).toBe(44100 * 4); // byte rate
    expect(out.readUInt16LE(32)).toBe(4); // block align
    expect(out.readUInt16LE(34)).toBe(16);
    expect(out.toString("ascii", 36, 40)).toBe("data");
    expect(out.readUInt32LE(40)).toBe(12);
  });

  it("interleaves channels", () => {
    const out = encodeWav(
      [Float32Array.of(1, 0), Float32Array.of(-1, 0.5)],
      44100,
      16,
    );
    expect([0, 1, 2, 3].map((i) => out.readInt16LE(44 + i * 2))).toEqual([
      32767, -32768, 0, 16383,
    ]);
  });

  it("clamps to [-1, 1], truncates, and writes NaN as silence", () => {
    const out = encodeWav(
      [Float32Array.of(2, -3, 0.99999, -0.99999, Number.NaN)],
      44100,
      16,
    );
    expect([0, 1, 2, 3, 4].map((i) => out.readInt16LE(44 + i * 2))).toEqual([
      32767, -32768, 32766, -32767, 0,
    ]);
  });

  it("writes 8-bit as unsigned", () => {
    const out = encodeWav([Float32Array.of(-1, 0, 1)], 44100, 8);
    expect([...out.subarray(44)]).toEqual([0, 127, 255]);
  });

  it("rounds negative 24-bit samples down, as node-wav did", () => {
    // -1.5 steps rounds to -2, where truncating toward zero would give -1
    const out = encodeWav([Float32Array.of(-1.5 / 8388608, -1)], 44100, 24);
    expect(out.readIntLE(44, 3)).toBe(-2);
    expect(out.readIntLE(47, 3)).toBe(-8388608);
  });

  it("writes an empty file for no channels", () => {
    expect(encodeWav([], 44100, 16).length).toBe(44);
  });

  it("re-encodes decoded 16-bit samples exactly, or one step low for positive values", () => {
    // Inherited from node-wav, and kept so converted files don't change:
    // positive samples are scaled by 1/32767, which a Float32 can't hold
    // exactly, and encoding truncates. Negative samples (1/32768) are exact.
    const original = Int16Array.from({ length: 4000 }, (_, i) =>
      Math.round(Math.sin(i * 0.37) * 32767),
    );
    const file = wavFile(
      { bitDepth: 16, channels: 1 },
      Buffer.from(original.buffer),
    );
    const reencoded = encodeWav(decodeWav(file).channelData, 44100, 16);

    original.forEach((sample, i) => {
      const difference = reencoded.readInt16LE(44 + i * 2) - sample;
      if (sample <= 0) {
        expect(difference).toBe(0);
      } else {
        expect([0, -1]).toContain(difference);
      }
    });
  });

  it.each([16, 24, 32] as EncodeBitDepth[])(
    "decodes what it encodes to within one %i-bit step",
    (bitDepth) => {
      const values = Float32Array.from(
        { length: 2000 },
        (_, i) => Math.sin(i * 0.37) * 1.1,
      );
      const decoded = decodeWav(encodeWav([values], 44100, bitDepth));
      const step = 1 / 2 ** (bitDepth - 1);
      decoded.channelData[0].forEach((sample, i) => {
        const expected = Math.max(-1, Math.min(values[i], 1));
        expect(Math.abs(sample - expected)).toBeLessThanOrEqual(step * 1.0001);
      });
    },
  );
});

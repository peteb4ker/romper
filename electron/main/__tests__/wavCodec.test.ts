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
      [Float32Array.of(1, 0), Float32Array.of(-1, 0.25)],
      44100,
      16,
    );
    expect([0, 1, 2, 3].map((i) => out.readInt16LE(44 + i * 2))).toEqual([
      32767, -32768, 0, 8192,
    ]);
  });

  it("clamps to [-1, 1], rounds to the nearest step, and writes NaN as silence (RE-63)", () => {
    const out = encodeWav(
      [Float32Array.of(2, -3, 0.99999, -0.99999, 0.5, Number.NaN)],
      44100,
      16,
    );
    // 0.99999 is 32766.7 steps and 0.5 is 16383.5: truncating gave 32766
    // and 16383
    expect([0, 1, 2, 3, 4, 5].map((i) => out.readInt16LE(44 + i * 2))).toEqual([
      32767, -32768, 32767, -32768, 16384, 0,
    ]);
  });

  it("writes 8-bit as unsigned, the inverse of decoding (RE-63)", () => {
    const out = encodeWav(
      [Float32Array.of(-1, -0.5, 0, 1, Number.NaN)],
      44100,
      8,
    );
    // node-wav wrote 0 as 127 and NaN as 0 (full-scale negative)
    expect([...out.subarray(44)]).toEqual([0, 64, 128, 255, 128]);
  });

  it("rounds 24-bit samples to the nearest step (RE-63)", () => {
    const out = encodeWav(
      [Float32Array.of(-1.4 / 8388608, -1.6 / 8388608, 1.6 / 8388607, -1)],
      44100,
      24,
    );
    expect([0, 1, 2, 3].map((i) => out.readIntLE(44 + i * 3, 3))).toEqual([
      -1, -2, 2, -8388608,
    ]);
  });

  it("writes an empty file for no channels", () => {
    expect(encodeWav([], 44100, 16).length).toBe(44);
  });

  it.each([
    [8, (b: Buffer, v: number, o: number) => b.writeUInt8(v + 128, o)],
    [16, (b: Buffer, v: number, o: number) => b.writeInt16LE(v, o)],
    [24, (b: Buffer, v: number, o: number) => b.writeIntLE(v, o, 3)],
  ] as const)(
    "gives back the same %i-bit samples after decoding and encoding (RE-63)",
    (bitDepth, write) => {
      const max = 2 ** (bitDepth - 1);
      // Both extremes, silence, and a full-range sweep in both channels
      const values = [-max, max - 1, 0, -1, 1];
      for (let i = 0; values.length < 20000; i++) {
        values.push(Math.round(Math.sin(i * 0.0137) * (max - 0.5) - 0.5));
      }
      const data = samples(bitDepth, values, write);
      const file = wavFile({ bitDepth, channels: 2 }, data);

      const reencoded = encodeWav(
        decodeWav(file).channelData,
        44100,
        bitDepth as EncodeBitDepth,
      );

      expect(Buffer.compare(reencoded.subarray(44), data)).toBe(0);
    },
  );

  it.each([16, 24, 32] as EncodeBitDepth[])(
    "decodes what it encodes to within half a %i-bit step",
    (bitDepth) => {
      const values = Float32Array.from(
        { length: 2000 },
        (_, i) => Math.sin(i * 0.37) * 1.1,
      );
      const decoded = decodeWav(encodeWav([values], 44100, bitDepth));
      // Half a step, plus the Float32 rounding of the decoded value
      const tolerance = 1 / 2 ** bitDepth + 2 ** -24;
      decoded.channelData[0].forEach((sample, i) => {
        const expected = Math.max(-1, Math.min(values[i], 1));
        expect(Math.abs(sample - expected)).toBeLessThanOrEqual(tolerance);
      });
    },
  );
});

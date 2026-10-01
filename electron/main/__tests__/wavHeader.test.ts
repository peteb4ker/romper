import { describe, expect, it } from "vitest";

import { decodeSamples as decodeWavSamples } from "../wavCodec";
import { parseWavHeader } from "../wavHeader";

interface Format {
  bits: number;
  channels?: number;
  fmtSize?: 16 | 18 | 40;
  rate?: number;
  /** For an extensible header: the real format tag in the sub-format */
  subFormat?: number;
  tag: number;
}

function chunk(id: string, body: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write(id, 0, "ascii");
  header.writeUInt32LE(body.length, 4);
  // RIFF bodies are padded to an even length; the size excludes the pad
  const pad = Buffer.alloc(body.length % 2);
  return Buffer.concat([header, body, pad]);
}

function fmtChunk(format: Format): Buffer {
  const { bits, channels = 1, fmtSize = 16, rate = 44100, tag } = format;
  const body = Buffer.alloc(fmtSize);
  const blockAlign = channels * (bits / 8);
  body.writeUInt16LE(tag, 0);
  body.writeUInt16LE(channels, 2);
  body.writeUInt32LE(rate, 4);
  body.writeUInt32LE(rate * blockAlign, 8);
  body.writeUInt16LE(blockAlign, 12);
  body.writeUInt16LE(bits, 14);
  if (fmtSize === 40) {
    body.writeUInt16LE(22, 16); // extension size
    body.writeUInt16LE(bits, 18); // valid bits
    body.writeUInt16LE(format.subFormat ?? 1, 24);
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

/** Four 16-bit samples */
const pcm16 = (() => {
  const data = Buffer.alloc(8);
  [0, 16384, -16384, 32767].forEach((v, i) => data.writeInt16LE(v, i * 2));
  return data;
})();

function decodeSamples(buffer: Buffer): number[] {
  const header = parse(buffer);
  if (!header.success || !header.data) throw new Error(header.error);
  return [...decodeWavSamples(buffer, header.data).channelData[0]];
}

function parse(buffer: Buffer) {
  return parseWavHeader(
    (offset, length) => buffer.subarray(offset, offset + length),
    buffer.length,
  );
}

const PLAIN = riff(fmtChunk({ bits: 16, tag: 1 }), chunk("data", pcm16));

describe("parseWavHeader", () => {
  it("reads a plain PCM file", () => {
    expect(parse(PLAIN)).toEqual({
      data: {
        bitDepth: 16,
        blockAlign: 2,
        channels: 1,
        dataOffset: 44,
        dataSize: 8,
        encoding: "pcm",
        extensible: false,
        sampleRate: 44100,
      },
      success: true,
    });
  });

  it.each([
    [
      "a JUNK chunk first",
      riff(
        chunk("JUNK", Buffer.alloc(28)),
        fmtChunk({ bits: 16, tag: 1 }),
        chunk("data", pcm16),
      ),
    ],
    [
      "a junk chunk between fmt and data (as in the factory kits)",
      riff(
        fmtChunk({ bits: 16, tag: 1 }),
        chunk("junk", Buffer.alloc(36)),
        chunk("data", pcm16),
      ),
    ],
    [
      "an 18-byte fmt chunk",
      riff(fmtChunk({ bits: 16, fmtSize: 18, tag: 1 }), chunk("data", pcm16)),
    ],
    [
      "an odd-sized chunk with its pad byte",
      riff(
        fmtChunk({ bits: 16, tag: 1 }),
        chunk("LIST", Buffer.from("odd", "ascii")),
        chunk("data", pcm16),
      ),
    ],
    [
      "a bext chunk first",
      riff(
        chunk("bext", Buffer.alloc(602)),
        fmtChunk({ bits: 16, tag: 1 }),
        chunk("data", pcm16),
      ),
    ],
  ])("finds the format and samples past %s", (_label, buffer) => {
    const header = parse(buffer);
    expect(header.success).toBe(true);
    expect(header.data).toMatchObject({ bitDepth: 16, encoding: "pcm" });
    expect(decodeSamples(buffer)).toEqual(decodeSamples(PLAIN));
  });

  it("reads WAVE_FORMAT_EXTENSIBLE PCM and flags it", () => {
    const buffer = riff(
      fmtChunk({ bits: 16, fmtSize: 40, subFormat: 1, tag: 0xfffe }),
      chunk("data", pcm16),
    );

    expect(parse(buffer).data).toMatchObject({
      bitDepth: 16,
      encoding: "pcm",
      extensible: true,
    });
    expect(decodeSamples(buffer)).toEqual(decodeSamples(PLAIN));
  });

  it("reads IEEE float, plain or extensible", () => {
    const floats = Buffer.alloc(8);
    floats.writeFloatLE(0.5, 0);
    floats.writeFloatLE(-0.25, 4);
    for (const format of [
      { bits: 32, tag: 3 },
      { bits: 32, fmtSize: 40 as const, subFormat: 3, tag: 0xfffe },
    ]) {
      const buffer = riff(fmtChunk(format), chunk("data", floats));
      expect(parse(buffer).data?.encoding).toBe("float");
      expect(decodeSamples(buffer)).toEqual([0.5, -0.25]);
    }
  });

  it("rejects compressed encodings with a reason", () => {
    const adpcm = riff(fmtChunk({ bits: 4, tag: 2 }), chunk("data", pcm16));
    expect(parse(adpcm)).toEqual({
      error:
        "Unsupported WAV encoding (format 0x0002); only uncompressed PCM or float can be used",
      success: false,
    });
  });

  it("rejects bit depths it can't decode", () => {
    const twelveBit = riff(
      fmtChunk({ bits: 12, tag: 1 }),
      chunk("data", pcm16),
    );
    expect(parse(twelveBit).error).toBe("Unsupported bit depth (12-bit PCM)");
  });

  it.each([
    ["not RIFF", Buffer.from("not a wav file at all"), "Not a WAV file"],
    ["no fmt chunk", riff(chunk("data", pcm16)), "No fmt chunk"],
    ["no data chunk", riff(fmtChunk({ bits: 16, tag: 1 })), "No sample data"],
  ])("explains a file that is %s", (_label, buffer, error) => {
    const header = parse(buffer);
    expect(header.success).toBe(false);
    expect(header.error).toContain(error);
  });

  it("reads only the samples a truncated file has", () => {
    const truncated = PLAIN.subarray(0, PLAIN.length - 4);
    expect(parse(truncated).data?.dataSize).toBe(4);
  });
});

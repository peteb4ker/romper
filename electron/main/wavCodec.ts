import { parseWavHeader, type WavHeader } from "./wavHeader.js";

/**
 * Decoding and encoding WAV sample data (RE-62). parseWavHeader finds the
 * format and where the samples are; this converts them to and from
 * per-channel floats in [-1, 1].
 *
 * The scaling matches node-wav, which this replaces, so converted files are
 * byte-for-byte what they were: integers map to floats asymmetrically
 * (negative values over 2^(n-1), positive over 2^(n-1) - 1), and encoding
 * clamps to [-1, 1] and truncates. 8-bit WAV is unsigned with 128 as
 * silence.
 *
 * Samples go through typed arrays, which are much faster than DataView.
 * WAV is little-endian, and so is every platform Romper ships for.
 */

export interface DecodedWav {
  /** One array per channel, each `frames` long */
  channelData: Float32Array[];
  sampleRate: number;
}

/** Integer PCM bit depths encodeWav can write */
export type EncodeBitDepth = 16 | 24 | 32 | 8;

const WAV_HEADER_SIZE = 44;

const LITTLE_ENDIAN = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;

/**
 * Decode the samples a parsed header points at. A partial frame at the end
 * of the data is dropped.
 */
export function decodeSamples(buffer: Buffer, header: WavHeader): DecodedWav {
  assertLittleEndian();
  const { bitDepth, channels } = header;
  const bytesPerSample = bitDepth / 8;
  const frames = Math.floor(header.dataSize / (bytesPerSample * channels));
  const channelData = Array.from(
    { length: channels },
    () => new Float32Array(frames),
  );

  // Copy the samples into their own ArrayBuffer: typed arrays need aligned
  // offsets, and the data can start anywhere, inside a pooled Buffer too.
  const start = header.dataOffset;
  const samples = new Uint8Array(
    buffer.subarray(start, start + frames * channels * bytesPerSample),
  ).buffer;

  if (header.encoding === "float") {
    const input =
      bitDepth === 64 ? new Float64Array(samples) : new Float32Array(samples);
    deinterleave(input, channelData, 1, 1);
    return { channelData, sampleRate: header.sampleRate };
  }

  switch (bitDepth) {
    case 16:
      deinterleave(new Int16Array(samples), channelData, 32768, 32767);
      break;
    case 24:
      deinterleave24(new Uint8Array(samples), channelData);
      break;
    case 32:
      deinterleave(
        new Int32Array(samples),
        channelData,
        2147483648,
        2147483647,
      );
      break;
    case 8:
      deinterleaveUnsigned8(new Uint8Array(samples), channelData);
      break;
    default:
      // parseWavHeader only accepts the depths above
      throw new Error(`Unsupported bit depth (${bitDepth}-bit PCM)`);
  }
  return { channelData, sampleRate: header.sampleRate };
}

/**
 * Decode a whole WAV file. Throws with parseWavHeader's reason if the file
 * isn't an uncompressed PCM or float WAV.
 */
export function decodeWav(buffer: Buffer): DecodedWav {
  const header = parseWavHeader(
    (offset, length) => buffer.subarray(offset, offset + length),
    buffer.length,
  );
  if (!header.success || !header.data) {
    throw new Error(header.error);
  }
  return decodeSamples(buffer, header.data);
}

/**
 * Encode per-channel floats as a plain integer PCM WAV: a 44-byte header
 * (16-byte `fmt `, then `data`) and interleaved samples. Every channel is
 * taken to be as long as the first.
 */
export function encodeWav(
  channelData: Float32Array[],
  sampleRate: number,
  bitDepth: EncodeBitDepth,
): Buffer {
  assertLittleEndian();
  const channels = channelData.length;
  const frames = channels > 0 ? channelData[0].length : 0;
  const blockAlign = channels * (bitDepth / 8);
  const dataSize = frames * blockAlign;

  // Buffer.alloc never uses the shared pool, so the samples at byte 44 are
  // aligned for every sample size
  const out = Buffer.alloc(WAV_HEADER_SIZE + dataSize);
  out.write("RIFF", 0, "ascii");
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVE", 8, "ascii");
  out.write("fmt ", 12, "ascii");
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); // integer PCM
  out.writeUInt16LE(channels, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * blockAlign, 28);
  out.writeUInt16LE(blockAlign, 32);
  out.writeUInt16LE(bitDepth, 34);
  out.write("data", 36, "ascii");
  out.writeUInt32LE(dataSize, 40);

  const start = out.byteOffset + WAV_HEADER_SIZE;
  const count = frames * channels;
  switch (bitDepth) {
    case 16:
      interleave(
        channelData,
        new Int16Array(out.buffer, start, count),
        32768,
        32767,
      );
      break;
    case 24:
      interleave24(channelData, new Uint8Array(out.buffer, start, count * 3));
      break;
    case 32:
      interleave(
        channelData,
        new Int32Array(out.buffer, start, count),
        2147483648,
        2147483647,
      );
      break;
    case 8:
      interleaveUnsigned8(
        channelData,
        new Uint8Array(out.buffer, start, count),
      );
      break;
  }
  return out;
}

function assertLittleEndian(): void {
  if (!LITTLE_ENDIAN) {
    throw new Error("WAV decoding needs a little-endian platform");
  }
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(value, 1));
}

/**
 * Split interleaved samples into channels, dividing negative values by
 * `negativeScale` and the rest by `positiveScale` (1 and 1 for float).
 */
function deinterleave(
  input: ArrayLike<number>,
  channelData: Float32Array[],
  negativeScale: number,
  positiveScale: number,
): void {
  const channels = channelData.length;
  const frames = channels > 0 ? channelData[0].length : 0;
  let i = 0;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = input[i++];
      channelData[channel][frame] =
        value < 0 ? value / negativeScale : value / positiveScale;
    }
  }
}

/** 24-bit PCM: three little-endian bytes per sample, two's complement */
function deinterleave24(input: Uint8Array, channelData: Float32Array[]): void {
  const channels = channelData.length;
  const frames = channels > 0 ? channelData[0].length : 0;
  let i = 0;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const unsigned = input[i] | (input[i + 1] << 8) | (input[i + 2] << 16);
      i += 3;
      // node-wav compared with > here, so the most negative sample came out
      // as +1.0000001
      const value = unsigned >= 0x800000 ? unsigned - 0x1000000 : unsigned;
      channelData[channel][frame] =
        value < 0 ? value / 8388608 : value / 8388607;
    }
  }
}

/** 8-bit PCM is unsigned: 128 is silence */
function deinterleaveUnsigned8(
  input: Uint8Array,
  channelData: Float32Array[],
): void {
  const channels = channelData.length;
  const frames = channels > 0 ? channelData[0].length : 0;
  let i = 0;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = input[i++] - 128;
      channelData[channel][frame] = value < 0 ? value / 128 : value / 127;
    }
  }
}

/** Inverse of deinterleave for integer output: clamp, scale and truncate */
function interleave(
  channelData: Float32Array[],
  output: Int16Array | Int32Array,
  negativeScale: number,
  positiveScale: number,
): void {
  const channels = channelData.length;
  const frames = channels > 0 ? channelData[0].length : 0;
  let i = 0;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = clamp(channelData[channel][frame]);
      output[i++] =
        (value < 0 ? value * negativeScale : value * positiveScale) | 0;
    }
  }
}

function interleave24(channelData: Float32Array[], output: Uint8Array): void {
  const channels = channelData.length;
  const frames = channels > 0 ? channelData[0].length : 0;
  let i = 0;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = clamp(channelData[channel][frame]);
      // Two's complement as an unsigned number. Negative values truncate
      // after the offset, so they round down, as node-wav did.
      const sample =
        (value < 0 ? 0x1000000 + value * 8388608 : value * 8388607) | 0;
      output[i++] = sample & 0xff;
      output[i++] = (sample >> 8) & 0xff;
      output[i++] = (sample >> 16) & 0xff;
    }
  }
}

function interleaveUnsigned8(
  channelData: Float32Array[],
  output: Uint8Array,
): void {
  const channels = channelData.length;
  const frames = channels > 0 ? channelData[0].length : 0;
  let i = 0;
  for (let frame = 0; frame < frames; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const value = clamp(channelData[channel][frame]);
      output[i++] = ((value * 0.5 + 0.5) * 255) | 0;
    }
  }
}

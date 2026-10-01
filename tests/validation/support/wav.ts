/**
 * The harness's own WAV reader, writer and reference conversion.
 *
 * It deliberately shares no code with the app (`wavHeader.ts`, `wavCodec.ts`,
 * `formatConverter.ts`), so a bug there can't hide itself: the card's
 * converted files are checked against what this module says they should be.
 * It follows the same documented rules (see `formatConverter.ts`):
 * - samples scale asymmetrically: negative values by 2^(n-1), positive by
 *   2^(n-1) - 1, so full scale is exactly -1 and 1; 8-bit is unsigned;
 * - stereo to mono is the average of the channels;
 * - gain multiplies by 10^(dB/20) and clamps to [-1, 1];
 * - resampling is linear interpolation, floor(length * ratio) output frames;
 * - encoding clamps, then rounds to the nearest step.
 */

export interface DecodedAudio {
  channels: Float64Array[];
  sampleRate: number;
}

export interface WavFormat {
  bitDepth: number;
  channels: number;
  /** "pcm" or "float", after resolving WAVE_FORMAT_EXTENSIBLE */
  encoding: "float" | "pcm";
  sampleRate: number;
}

export interface WavInfo extends WavFormat {
  /** Chunk ids in file order, e.g. ["fmt ", "LIST", "data"] */
  chunks: string[];
  /** Byte offset and length of the `data` chunk's payload */
  dataLength: number;
  dataOffset: number;
  /** The fmt chunk's raw format tag (1 PCM, 3 float, 0xFFFE extensible) */
  formatTag: number;
}

const PCM = 1;
const FLOAT = 3;
const EXTENSIBLE = 0xfffe;

export function decodeWav(buffer: Buffer): DecodedAudio {
  const info = readWavInfo(buffer);
  const bytesPerSample = info.bitDepth / 8;
  const frameSize = bytesPerSample * info.channels;
  const frames = Math.floor(info.dataLength / frameSize);
  const channels = Array.from(
    { length: info.channels },
    () => new Float64Array(frames),
  );
  for (let frame = 0; frame < frames; frame++) {
    for (let ch = 0; ch < info.channels; ch++) {
      const at = info.dataOffset + frame * frameSize + ch * bytesPerSample;
      channels[ch][frame] = readSample(buffer, at, info);
    }
  }
  return { channels, sampleRate: info.sampleRate };
}

/** Encode test audio. `extraChunk` inserts a LIST chunk before `data`. */
export function encodeTestWav(
  channels: Float64Array[],
  format: Omit<WavFormat, "channels">,
  options: { extraChunk?: boolean } = {},
): Buffer {
  const bytesPerSample = format.bitDepth / 8;
  const frames = channels[0].length;
  const blockAlign = bytesPerSample * channels.length;
  const data = Buffer.alloc(frames * blockAlign);
  for (let f = 0; f < frames; f++) {
    for (let ch = 0; ch < channels.length; ch++) {
      const at = f * blockAlign + ch * bytesPerSample;
      const v = Math.max(-1, Math.min(1, channels[ch][f]));
      if (format.encoding === "float") {
        data.writeFloatLE(v, at);
      } else if (format.bitDepth === 16) {
        data.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), at);
      } else if (format.bitDepth === 24) {
        data.writeIntLE(Math.round(v < 0 ? v * 8388608 : v * 8388607), at, 3);
      } else {
        throw new Error(`test encoder doesn't write ${format.bitDepth}-bit`);
      }
    }
  }
  const fmt = Buffer.alloc(24);
  fmt.write("fmt ", 0, "ascii");
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(format.encoding === "float" ? FLOAT : PCM, 8);
  fmt.writeUInt16LE(channels.length, 10);
  fmt.writeUInt32LE(format.sampleRate, 12);
  fmt.writeUInt32LE(format.sampleRate * blockAlign, 16);
  fmt.writeUInt16LE(blockAlign, 20);
  fmt.writeUInt16LE(format.bitDepth, 22);
  const extra = options.extraChunk ? listChunk() : Buffer.alloc(0);
  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0, "ascii");
  dataHeader.writeUInt32LE(data.length, 4);
  const body = Buffer.concat([fmt, extra, dataHeader, data]);
  const riff = Buffer.alloc(12);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(4 + body.length, 4);
  riff.write("WAVE", 8, "ascii");
  return Buffer.concat([riff, body]);
}

/** What the Rample plays as-is: Romper copies these byte for byte */
export function isRampleNative(format: WavFormat): boolean {
  return (
    format.encoding === "pcm" &&
    (format.bitDepth === 8 || format.bitDepth === 16) &&
    format.sampleRate === 44100 &&
    format.channels <= 2
  );
}

/** Largest per-sample difference, or Infinity when the shapes differ */
export function maxSampleDifference(a: Int16Array[], b: Int16Array[]): number {
  if (a.length !== b.length) return Infinity;
  let max = 0;
  for (let ch = 0; ch < a.length; ch++) {
    if (a[ch].length !== b[ch].length) return Infinity;
    for (let i = 0; i < a[ch].length; i++) {
      max = Math.max(max, Math.abs(a[ch][i] - b[ch][i]));
    }
  }
  return max;
}

/** Raw 16-bit samples of a PCM file, one Int16Array per channel */
export function readPcm16(buffer: Buffer): Int16Array[] {
  const info = readWavInfo(buffer);
  if (info.encoding !== "pcm" || info.bitDepth !== 16) {
    throw new Error(
      `expected 16-bit PCM, got ${info.bitDepth}-bit ${info.encoding}`,
    );
  }
  const frames = Math.floor(info.dataLength / (2 * info.channels));
  const out = Array.from(
    { length: info.channels },
    () => new Int16Array(frames),
  );
  for (let f = 0; f < frames; f++) {
    for (let ch = 0; ch < info.channels; ch++) {
      out[ch][f] = buffer.readInt16LE(
        info.dataOffset + (f * info.channels + ch) * 2,
      );
    }
  }
  return out;
}

export function readWavInfo(buffer: Buffer): WavInfo {
  if (
    buffer.length < 12 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("not a RIFF/WAVE file");
  }
  const chunks: string[] = [];
  let fmt: null | Omit<WavInfo, "chunks" | "dataLength" | "dataOffset"> = null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    chunks.push(id);
    if (id === "fmt ") {
      const formatTag = buffer.readUInt16LE(body);
      const channels = buffer.readUInt16LE(body + 2);
      const sampleRate = buffer.readUInt32LE(body + 4);
      const bitDepth = buffer.readUInt16LE(body + 14);
      // Extensible headers carry the real format in the sub-format GUID
      const tag =
        formatTag === EXTENSIBLE && size >= 40
          ? buffer.readUInt16LE(body + 24)
          : formatTag;
      if (tag !== PCM && tag !== FLOAT) {
        throw new Error(`unsupported format tag 0x${tag.toString(16)}`);
      }
      fmt = {
        bitDepth,
        channels,
        encoding: tag === FLOAT ? "float" : "pcm",
        formatTag,
        sampleRate,
      };
    } else if (id === "data") {
      if (!fmt) throw new Error("data chunk before fmt chunk");
      const dataLength = Math.min(size, buffer.length - body);
      return { ...fmt, chunks, dataLength, dataOffset: body };
    }
    // RIFF chunks are padded to an even length
    offset = body + size + (size % 2);
  }
  throw new Error("no data chunk");
}

/**
 * The 16-bit, 44.1 kHz samples Romper should write for `source`, one
 * Int16Array per output channel.
 */
export function referenceConversion(
  source: DecodedAudio,
  options: { gainDb: number; outputChannels: 1 | 2 },
): Int16Array[] {
  let channels: Float64Array[] = source.channels;
  if (options.outputChannels === 1 && channels.length > 1) {
    const mono = new Float64Array(channels[0].length);
    for (let i = 0; i < mono.length; i++) {
      let sum = 0;
      for (const ch of channels) sum += ch[i];
      mono[i] = sum / channels.length;
    }
    channels = [mono];
  } else if (options.outputChannels === 2 && channels.length === 1) {
    channels = [channels[0], channels[0]];
  } else {
    channels = channels.slice(0, options.outputChannels);
  }

  if (options.gainDb !== 0) {
    const gain = Math.pow(10, options.gainDb / 20);
    channels = channels.map((ch) =>
      ch.map((v) => Math.max(-1, Math.min(1, v * gain))),
    );
  }

  if (source.sampleRate !== 44100) {
    const ratio = 44100 / source.sampleRate;
    const outFrames = Math.floor(channels[0].length * ratio);
    channels = channels.map((input) => {
      const out = new Float64Array(outFrames);
      for (let i = 0; i < outFrames; i++) {
        const pos = i / ratio;
        const left = Math.floor(pos);
        const right = Math.min(left + 1, input.length - 1);
        const fraction = pos - left;
        out[i] = input[left] * (1 - fraction) + input[right] * fraction;
      }
      return out;
    });
  }

  return channels.map((ch) => Int16Array.from(ch, quantize16));
}

/** A sine at `hz`, `seconds` long, at `amplitude` of full scale */
export function sine(
  hz: number,
  seconds: number,
  sampleRate: number,
  amplitude = 0.5,
): Float64Array {
  const out = new Float64Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / sampleRate);
  }
  return out;
}

function listChunk(): Buffer {
  // An odd-length chunk, so readers must skip its pad byte to find `data`
  const text = Buffer.from("Romper check\0", "ascii");
  const info = Buffer.concat([
    Buffer.from("INFOICMT", "ascii"),
    u32(text.length),
    text,
  ]);
  if (info.length % 2 === 0) throw new Error("LIST test chunk must be odd");
  const padded =
    info.length % 2 ? Buffer.concat([info, Buffer.alloc(1)]) : info;
  return Buffer.concat([
    Buffer.from("LIST", "ascii"),
    u32(info.length),
    padded,
  ]);
}

function quantize16(value: number): number {
  const v = Math.max(-1, Math.min(1, value));
  return Math.round(v < 0 ? v * 32768 : v * 32767);
}

function readSample(buffer: Buffer, at: number, format: WavFormat): number {
  if (format.encoding === "float") {
    return format.bitDepth === 64
      ? buffer.readDoubleLE(at)
      : buffer.readFloatLE(at);
  }
  switch (format.bitDepth) {
    case 16: {
      const v = buffer.readInt16LE(at);
      return v < 0 ? v / 32768 : v / 32767;
    }
    case 24: {
      const v = buffer.readIntLE(at, 3);
      return v < 0 ? v / 8388608 : v / 8388607;
    }
    case 32: {
      const v = buffer.readInt32LE(at);
      return v < 0 ? v / 2147483648 : v / 2147483647;
    }
    case 8: {
      const v = buffer.readUInt8(at) - 128;
      return v < 0 ? v / 128 : v / 127;
    }
    default:
      throw new Error(`unsupported PCM depth ${format.bitDepth}`);
  }
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

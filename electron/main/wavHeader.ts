import type { DbResult } from "@romper/shared/db/schema.js";

/**
 * Reading WAV headers (RE-08). A WAV file is a RIFF container: after the
 * 12-byte `RIFF....WAVE` header comes a list of chunks, each an id, a size
 * and a body padded to an even length. Only `fmt ` and `data` matter here,
 * and they can sit anywhere: Squarp's factory kits put a `junk` chunk before
 * `data`, some files put `JUNK`, `bext` or `LIST` first, and `fmt ` can be
 * 16, 18 or 40 bytes long.
 */

/** Reads `length` bytes at `offset` (fewer at the end of the file). */
export type ReadBytes = (offset: number, length: number) => Buffer;

/** Sample encodings Romper can read: integer PCM and IEEE float. */
export type WavEncoding = "float" | "pcm";

export interface WavHeader {
  bitDepth: number;
  /** Bytes per sample frame (all channels) */
  blockAlign: number;
  channels: number;
  /** Where the sample data starts and how long it is, in bytes */
  dataOffset: number;
  dataSize: number;
  encoding: WavEncoding;
  /**
   * WAVE_FORMAT_EXTENSIBLE header. Nothing shows the Rample reads it, so
   * sync rewrites these files as plain PCM.
   */
  extensible: boolean;
  sampleRate: number;
}

const FORMAT_PCM = 0x0001;
const FORMAT_FLOAT = 0x0003;
const FORMAT_EXTENSIBLE = 0xfffe;

const SUPPORTED_BIT_DEPTHS: Record<WavEncoding, readonly number[]> = {
  float: [32, 64],
  pcm: [8, 16, 24, 32],
};

/**
 * Find a WAV file's format and sample data by walking its chunks.
 * Fails with a reason a user can act on for anything that isn't an
 * uncompressed PCM or float WAV.
 */
export function parseWavHeader(
  read: ReadBytes,
  fileSize: number,
): DbResult<WavHeader> {
  const riff = read(0, 12);
  if (
    riff.length < 12 ||
    riff.toString("ascii", 0, 4) !== "RIFF" ||
    riff.toString("ascii", 8, 12) !== "WAVE"
  ) {
    return { error: "Not a WAV file (no RIFF/WAVE header)", success: false };
  }

  let format: DbResult<Omit<WavHeader, "dataOffset" | "dataSize">> | null =
    null;
  let offset = 12;
  while (offset + 8 <= fileSize) {
    const chunkHeader = read(offset, 8);
    if (chunkHeader.length < 8) break;
    const id = chunkHeader.toString("ascii", 0, 4);
    const size = chunkHeader.readUInt32LE(4);
    const body = offset + 8;

    if (id === "fmt ") {
      format = parseFormatChunk(read(body, Math.min(size, 40)));
      if (!format.success) return { error: format.error, success: false };
    } else if (id === "data") {
      if (!format?.success) {
        return { error: "No fmt chunk before the sample data", success: false };
      }
      return {
        data: {
          ...format.data!,
          dataOffset: body,
          // A truncated file holds less than its header says
          dataSize: Math.min(size, Math.max(0, fileSize - body)),
        },
        success: true,
      };
    }
    offset = body + size + (size % 2);
  }

  return {
    error: format ? "No sample data (no data chunk)" : "No fmt chunk",
    success: false,
  };
}

function parseFormatChunk(
  fmt: Buffer,
): DbResult<Omit<WavHeader, "dataOffset" | "dataSize">> {
  if (fmt.length < 16) {
    return { error: "The fmt chunk is too short", success: false };
  }
  let formatTag = fmt.readUInt16LE(0);
  const extensible = formatTag === FORMAT_EXTENSIBLE;
  if (extensible) {
    if (fmt.length < 26) {
      return { error: "The fmt chunk is too short", success: false };
    }
    // The sub-format GUID starts with the real format tag
    formatTag = fmt.readUInt16LE(24);
  }

  let encoding: WavEncoding;
  if (formatTag === FORMAT_PCM) {
    encoding = "pcm";
  } else if (formatTag === FORMAT_FLOAT) {
    encoding = "float";
  } else {
    return {
      error: `Unsupported WAV encoding (format 0x${formatTag.toString(16).padStart(4, "0")}); only uncompressed PCM or float can be used`,
      success: false,
    };
  }

  const channels = fmt.readUInt16LE(2);
  const sampleRate = fmt.readUInt32LE(4);
  const blockAlign = fmt.readUInt16LE(12);
  const bitDepth = fmt.readUInt16LE(14);
  if (channels === 0 || sampleRate === 0 || blockAlign === 0) {
    return { error: "The fmt chunk has no channels or rate", success: false };
  }
  if (!SUPPORTED_BIT_DEPTHS[encoding].includes(bitDepth)) {
    return {
      error: `Unsupported bit depth (${bitDepth}-bit ${encoding === "float" ? "float" : "PCM"})`,
      success: false,
    };
  }

  return {
    data: {
      bitDepth,
      blockAlign,
      channels,
      encoding,
      extensible,
      sampleRate,
    },
    success: true,
  };
}

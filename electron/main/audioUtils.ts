import type {
  AudioMetadata,
  FormatIssue,
  FormatValidationResult,
} from "@romper/shared/audioTypes.js";
import type { DbResult } from "@romper/shared/db/schema.js";

import fs from "node:fs";
import path from "node:path";

import {
  parseWavHeader,
  parseWavHeaderAsync,
  type WavHeader,
} from "./wavHeader.js";

// Re-export shared audio types for callers that still import them from here.
// The canonical definitions live in shared/audioTypes.ts so the renderer
// does not need to reach into electron/main/.
export type { AudioMetadata, FormatIssue, FormatValidationResult };

/**
 * Squarp Rample format requirements
 */
export interface RampleFormatRequirements {
  readonly bitDepths: readonly number[];
  readonly fileExtensions: readonly string[];
  readonly maxChannels: number;
  readonly sampleRates: readonly number[];
}

export const RAMPLE_FORMAT_REQUIREMENTS: RampleFormatRequirements = {
  bitDepths: [8, 16],
  fileExtensions: [".wav"],
  maxChannels: 2, // mono or stereo
  sampleRates: [44100],
} as const;

/**
 * Reads a WAV file's format from its header, wherever its `fmt ` and `data`
 * chunks sit (see wavHeader.ts).
 */
export function getAudioMetadata(filePath: string): DbResult<AudioMetadata> {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: "File does not exist", success: false };
    }
    if (path.extname(filePath).toLowerCase() !== ".wav") {
      return { error: "Only WAV files are supported", success: false };
    }

    const fileSize = fs.statSync(filePath).size;
    const fd = fs.openSync(filePath, "r");
    try {
      const read = (offset: number, length: number) => {
        const buffer = Buffer.alloc(length);
        const bytesRead = fs.readSync(fd, buffer, 0, length, offset);
        return buffer.subarray(0, bytesRead);
      };
      return toAudioMetadata(parseWavHeader(read, fileSize), fileSize);
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    return metadataReadError(error);
  }
}

/**
 * {@link getAudioMetadata} without blocking the main thread: the file is
 * opened, sized and read with fs.promises. Sync planning reads every
 * sample's header with it (RE-82).
 */
export async function getAudioMetadataAsync(
  filePath: string,
): Promise<DbResult<AudioMetadata>> {
  if (path.extname(filePath).toLowerCase() !== ".wav") {
    return { error: "Only WAV files are supported", success: false };
  }
  let file: fs.promises.FileHandle;
  try {
    file = await fs.promises.open(filePath, "r");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { error: "File does not exist", success: false };
    }
    return metadataReadError(error);
  }
  try {
    const { size: fileSize } = await file.stat();
    const read = async (offset: number, length: number) => {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await file.read(buffer, 0, length, offset);
      return buffer.subarray(0, bytesRead);
    };
    return toAudioMetadata(await parseWavHeaderAsync(read, fileSize), fileSize);
  } catch (error) {
    return metadataReadError(error);
  } finally {
    await file.close();
  }
}

/**
 * Checks if a format issue is critical (prevents assignment) or warning (allows assignment with conversion)
 */
export function isFormatIssueCritical(issue: FormatIssue): boolean {
  // File extension, file access and invalid format errors are critical
  // Only bit depth, sample rate, and channel count issues can be converted during SD card sync
  return (
    issue.type === "extension" ||
    issue.type === "fileAccess" ||
    issue.type === "invalidFormat"
  );
}

/**
 * Validates audio metadata against Rample requirements
 */
export function validateAudioFormat(metadata: AudioMetadata): FormatIssue[] {
  const issues: FormatIssue[] = [];

  // Float samples and extensible headers are converted to plain PCM
  if (metadata.encoding === "float") {
    issues.push({
      current: `${metadata.bitDepth}-bit float`,
      message: `${metadata.bitDepth}-bit float samples will be converted to 16-bit PCM.`,
      required: "PCM",
      type: "encoding",
    });
  } else if (metadata.extensible) {
    issues.push({
      current: "WAVE_FORMAT_EXTENSIBLE",
      message:
        "The file has an extended WAV header; it will be rewritten as a standard WAV.",
      required: "PCM",
      type: "encoding",
    });
  }

  // Validate bit depth (a float file's is covered above)
  if (
    metadata.encoding !== "float" &&
    metadata.bitDepth !== undefined &&
    !RAMPLE_FORMAT_REQUIREMENTS.bitDepths.includes(metadata.bitDepth)
  ) {
    issues.push({
      current: metadata.bitDepth,
      message: `Bit depth ${metadata.bitDepth} is not supported. Rample supports ${RAMPLE_FORMAT_REQUIREMENTS.bitDepths.join(", ")} bit only.`,
      required: RAMPLE_FORMAT_REQUIREMENTS.bitDepths,
      type: "bitDepth",
    });
  }

  // Validate sample rate
  if (
    metadata.sampleRate !== undefined &&
    !RAMPLE_FORMAT_REQUIREMENTS.sampleRates.includes(metadata.sampleRate)
  ) {
    issues.push({
      current: metadata.sampleRate,
      message: `Sample rate ${metadata.sampleRate} Hz is not supported. Rample requires ${RAMPLE_FORMAT_REQUIREMENTS.sampleRates[0]} Hz.`,
      required: RAMPLE_FORMAT_REQUIREMENTS.sampleRates[0],
      type: "sampleRate",
    });
  }

  // Validate channel count
  if (
    metadata.channels !== undefined &&
    metadata.channels > RAMPLE_FORMAT_REQUIREMENTS.maxChannels
  ) {
    issues.push({
      current: metadata.channels,
      message: `${metadata.channels} channels not supported. Rample supports mono (1) or stereo (2) only.`,
      required: `1-${RAMPLE_FORMAT_REQUIREMENTS.maxChannels}`,
      type: "channels",
    });
  }

  return issues;
}

/**
 * Validates file extension against Rample requirements
 */
export function validateFileExtension(filePath: string): FormatIssue | null {
  const ext = path.extname(filePath).toLowerCase();

  if (!RAMPLE_FORMAT_REQUIREMENTS.fileExtensions.includes(ext)) {
    return {
      current: ext,
      message: `File extension '${ext}' is not supported. Rample only supports .wav files.`,
      required: RAMPLE_FORMAT_REQUIREMENTS.fileExtensions,
      type: "extension",
    };
  }

  return null;
}

/**
 * Validates a sample file against Rample format requirements
 * This combines file extension validation and audio format validation
 */
export function validateSampleFormat(
  filePath: string,
): DbResult<FormatValidationResult> {
  const issues: FormatIssue[] = [];

  // Check file extension first
  const extensionIssue = validateFileExtension(filePath);
  if (extensionIssue) {
    issues.push(extensionIssue);
    // If extension is wrong, don't bother checking audio format
    return { data: { issues, isValid: false }, success: true };
  }

  return toFormatValidation(getAudioMetadata(filePath));
}

/**
 * {@link validateSampleFormat}, reading the header without blocking the
 * main thread (RE-82)
 */
export async function validateSampleFormatAsync(
  filePath: string,
): Promise<DbResult<FormatValidationResult>> {
  const extensionIssue = validateFileExtension(filePath);
  if (extensionIssue) {
    return {
      data: { issues: [extensionIssue], isValid: false },
      success: true,
    };
  }
  return toFormatValidation(await getAudioMetadataAsync(filePath));
}

function metadataReadError(error: unknown): DbResult<AudioMetadata> {
  return {
    error: `Failed to read audio metadata: ${error instanceof Error ? error.message : String(error)}`,
    success: false,
  };
}

function toAudioMetadata(
  header: DbResult<WavHeader>,
  fileSize: number,
): DbResult<AudioMetadata> {
  if (!header.success || !header.data) {
    return { error: header.error, success: false };
  }
  const { bitDepth, blockAlign, channels, dataSize, encoding, extensible } =
    header.data;
  const { sampleRate } = header.data;
  return {
    data: {
      bitDepth,
      channels,
      duration: dataSize / (sampleRate * blockAlign),
      encoding,
      extensible,
      fileSize,
      sampleRate,
    },
    success: true,
  };
}

/** Check a file's metadata against the Rample's requirements */
function toFormatValidation(
  metadataResult: DbResult<AudioMetadata>,
): DbResult<FormatValidationResult> {
  const issues: FormatIssue[] = [];
  if (!metadataResult.success || !metadataResult.data) {
    issues.push({
      message: `Unable to read audio file: ${metadataResult.error || "Unknown error"}`,
      type: "fileAccess",
    });
    return { data: { issues, isValid: false }, success: true };
  }

  // Validate audio format requirements
  const formatIssues = validateAudioFormat(metadataResult.data);
  issues.push(...formatIssues);

  return {
    data: {
      issues,
      isValid: issues.length === 0,
      metadata: metadataResult.data,
    },
    success: true,
  };
}

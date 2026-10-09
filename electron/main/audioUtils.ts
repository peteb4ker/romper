import type {
  AudioMetadata,
  FormatIssue,
  FormatValidationResult,
} from "@romper/shared/audioTypes.js";
import type { DbResult } from "@romper/shared/db/schema.js";

import {
  formatIssues,
  RAMPLE_FORMAT_REQUIREMENTS,
} from "@romper/shared/rampleFormat.js";
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

// The Rample's requirements live in shared/rampleFormat.ts, with the rule
// for what a write converts (#576); re-exported for main's callers.
export {
  RAMPLE_FORMAT_REQUIREMENTS,
  type RampleFormatRequirements,
} from "@romper/shared/rampleFormat.js";

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
 * Validates audio metadata against Rample requirements (the shared rule's
 * `formatIssues`)
 */
export function validateAudioFormat(metadata: AudioMetadata): FormatIssue[] {
  return formatIssues(metadata);
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
      frames: Math.floor(dataSize / blockAlign),
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

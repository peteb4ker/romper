import fs from "fs";
import path from "path";

import type { DbResult } from "../../shared/db/schema.js";

/**
 * Squarp Rample format requirements
 */
export interface RampleFormatRequirements {
  readonly fileExtensions: readonly string[];
  readonly bitDepths: readonly number[];
  readonly sampleRates: readonly number[];
  readonly maxChannels: number;
}

export const RAMPLE_FORMAT_REQUIREMENTS: RampleFormatRequirements = {
  fileExtensions: [".wav"],
  bitDepths: [8, 16],
  sampleRates: [44100],
  maxChannels: 2, // mono or stereo
} as const;

/**
 * Format validation result for a sample file
 */
export interface FormatValidationResult {
  isValid: boolean;
  issues: FormatIssue[];
  metadata?: AudioMetadata;
}

/**
 * Specific format issue with type and description
 */
export interface FormatIssue {
  type:
    | "extension"
    | "bitDepth"
    | "sampleRate"
    | "channels"
    | "fileAccess"
    | "invalidFormat";
  message: string;
  current?: string | number;
  required?: string | number | readonly (string | number)[];
}

/**
 * Audio file metadata
 */
export interface AudioMetadata {
  bitDepth?: number;
  sampleRate?: number;
  channels?: number;
  duration?: number;
  fileSize?: number;
}

/**
 * Validates file extension against Rample requirements
 */
export function validateFileExtension(filePath: string): FormatIssue | null {
  const ext = path.extname(filePath).toLowerCase();

  if (!RAMPLE_FORMAT_REQUIREMENTS.fileExtensions.includes(ext)) {
    return {
      type: "extension",
      message: `File extension '${ext}' is not supported. Rample only supports .wav files.`,
      current: ext,
      required: RAMPLE_FORMAT_REQUIREMENTS.fileExtensions,
    };
  }

  return null;
}

/**
 * Validates audio metadata against Rample requirements
 */
export function validateAudioFormat(metadata: AudioMetadata): FormatIssue[] {
  const issues: FormatIssue[] = [];

  // Validate bit depth
  if (
    metadata.bitDepth !== undefined &&
    !RAMPLE_FORMAT_REQUIREMENTS.bitDepths.includes(metadata.bitDepth)
  ) {
    issues.push({
      type: "bitDepth",
      message: `Bit depth ${metadata.bitDepth} is not supported. Rample supports ${RAMPLE_FORMAT_REQUIREMENTS.bitDepths.join(", ")} bit only.`,
      current: metadata.bitDepth,
      required: RAMPLE_FORMAT_REQUIREMENTS.bitDepths,
    });
  }

  // Validate sample rate
  if (
    metadata.sampleRate !== undefined &&
    !RAMPLE_FORMAT_REQUIREMENTS.sampleRates.includes(metadata.sampleRate)
  ) {
    issues.push({
      type: "sampleRate",
      message: `Sample rate ${metadata.sampleRate} Hz is not supported. Rample requires ${RAMPLE_FORMAT_REQUIREMENTS.sampleRates[0]} Hz.`,
      current: metadata.sampleRate,
      required: RAMPLE_FORMAT_REQUIREMENTS.sampleRates[0],
    });
  }

  // Validate channel count
  if (
    metadata.channels !== undefined &&
    metadata.channels > RAMPLE_FORMAT_REQUIREMENTS.maxChannels
  ) {
    issues.push({
      type: "channels",
      message: `${metadata.channels} channels not supported. Rample supports mono (1) or stereo (2) only.`,
      current: metadata.channels,
      required: `1-${RAMPLE_FORMAT_REQUIREMENTS.maxChannels}`,
    });
  }

  return issues;
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
    return { success: true, data: { isValid: false, issues } };
  }

  // Get audio metadata and validate format
  const metadataResult = getAudioMetadata(filePath);

  if (!metadataResult.success || !metadataResult.data) {
    issues.push({
      type: "fileAccess",
      message: `Unable to read audio file: ${metadataResult.error || "Unknown error"}`,
    });
    return { success: true, data: { isValid: false, issues } };
  }

  // Validate audio format requirements
  const formatIssues = validateAudioFormat(metadataResult.data);
  issues.push(...formatIssues);

  return {
    success: true,
    data: {
      isValid: issues.length === 0,
      issues,
      metadata: metadataResult.data,
    },
  };
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
 * Reads WAV file header to extract audio metadata
 * Reference: http://soundfile.sapp.org/doc/WaveFormat/
 */
export function getAudioMetadata(filePath: string): DbResult<AudioMetadata> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File does not exist" };
    }

    // Check file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".wav") {
      return { success: false, error: "Only WAV files are supported" };
    }

    // Get file size
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Read WAV header (first 44 bytes minimum)
    const buffer = Buffer.alloc(44);
    const fd = fs.openSync(filePath, "r");

    try {
      const bytesRead = fs.readSync(fd, buffer, 0, 44, 0);
      if (bytesRead < 44) {
        return { success: false, error: "Invalid WAV file: header too short" };
      }

      // Check RIFF header
      const riffHeader = buffer.subarray(0, 4).toString("ascii");
      if (riffHeader !== "RIFF") {
        return {
          success: false,
          error: "Invalid WAV file: missing RIFF header",
        };
      }

      // Check WAVE format
      const waveFormat = buffer.subarray(8, 12).toString("ascii");
      if (waveFormat !== "WAVE") {
        return { success: false, error: "Invalid WAV file: not WAVE format" };
      }

      // Check fmt chunk
      const fmtChunk = buffer.subarray(12, 16).toString("ascii");
      if (fmtChunk !== "fmt ") {
        return { success: false, error: "Invalid WAV file: missing fmt chunk" };
      }

      // Read fmt chunk size (should be 16 for PCM)
      const fmtChunkSize = buffer.readUInt32LE(16);
      if (fmtChunkSize !== 16) {
        return { success: false, error: "Only PCM format is supported" };
      }

      // Read audio format (should be 1 for PCM)
      const audioFormat = buffer.readUInt16LE(20);
      if (audioFormat !== 1) {
        return {
          success: false,
          error: "Only uncompressed PCM format is supported",
        };
      }

      // Read audio metadata
      const channels = buffer.readUInt16LE(22);
      const sampleRate = buffer.readUInt32LE(24);
      const bitsPerSample = buffer.readUInt16LE(34);

      // Calculate duration from data chunk
      let duration: number | undefined;
      try {
        // Find data chunk (skip fmt chunk and look for "data")
        let offset = 20 + fmtChunkSize; // Start after fmt chunk
        const searchBuffer = Buffer.alloc(8);

        while (offset < fileSize - 8) {
          fs.readSync(fd, searchBuffer, 0, 8, offset);
          const chunkId = searchBuffer.subarray(0, 4).toString("ascii");
          const chunkSize = searchBuffer.readUInt32LE(4);

          if (chunkId === "data") {
            const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
            duration = chunkSize / bytesPerSecond;
            break;
          }

          offset += 8 + chunkSize;
        }
      } catch (error) {
        // Duration calculation failed, but other metadata is still valid
        console.warn("Could not calculate duration:", error);
      }

      const metadata: AudioMetadata = {
        bitDepth: bitsPerSample,
        sampleRate,
        channels,
        duration,
        fileSize,
      };

      return { success: true, data: metadata };
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to read audio metadata: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

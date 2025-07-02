// WAV file analysis scanner - analyzes WAV files for audio properties

import * as wav from "node-wav";

import type { ScanResult, WAVAnalysisInput, WAVAnalysisOutput } from "./types";

/**
 * Analyzes a WAV file to extract audio properties
 * @param input Object containing file path and optional file reader
 * @returns Audio properties of the WAV file
 */
export async function scanWAVAnalysis(
  input: WAVAnalysisInput,
): Promise<ScanResult<WAVAnalysisOutput>> {
  try {
    const { filePath, fileReader } = input;

    if (!fileReader) {
      throw new Error(
        "fileReader is required for WAV analysis in renderer process",
      );
    }

    const arrayBuffer = await fileReader(filePath);
    const buffer = Buffer.from(arrayBuffer);

    // Parse WAV file using node-wav
    const result = parseWAVFile(buffer);

    if (!result.isValid) {
      return {
        success: false,
        error: `Invalid WAV file: ${filePath}`,
      };
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during WAV analysis",
    };
  }
}

/**
 * Parses WAV file using node-wav library to extract audio properties
 * @param buffer Buffer containing WAV file data
 * @returns WAV file properties
 */
function parseWAVFile(buffer: Buffer): WAVAnalysisOutput {
  // Decode WAV file using node-wav
  const result = wav.decode(buffer);

  if (!result || !result.channelData || result.channelData.length === 0) {
    return {
      sampleRate: 0,
      bitDepth: 0,
      channels: 0,
      bitrate: 0,
      isStereo: false,
      isValid: false,
    };
  }

  const sampleRate = result.sampleRate;
  const channels = result.channelData.length;
  // node-wav doesn't directly provide bit depth, so we estimate based on common values
  // Most WAV files are either 16-bit or 24-bit
  const bitDepth = 16; // Default assumption, could be improved with better detection
  const bitrate = sampleRate * channels * bitDepth;
  const isStereo = channels === 2;

  return {
    sampleRate,
    bitDepth,
    channels,
    bitrate,
    isStereo,
    isValid: true,
  };
}

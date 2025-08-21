// WAV file analysis scanner - analyzes WAV files for audio properties

import type { ScanResult, WAVAnalysisInput, WAVAnalysisOutput } from "./types";

// TypeScript global declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      getAudioMetadata: (filePath: string) => Promise<{
        success: boolean;
        data?: {
          bitDepth?: number;
          channels?: number;
          duration?: number;
          fileSize?: number;
          sampleRate?: number;
        };
        error?: string;
      }>;
    };
  }
}

/**
 * Rample format requirements for validation
 */
const RAMPLE_FORMAT_REQUIREMENTS = {
  bitDepths: [8, 16],
  maxChannels: 2, // mono or stereo
  sampleRates: [44100],
} as const;

/**
 * Analyzes a WAV file to extract audio properties
 * @param input Object containing file path and optional file reader
 * @returns Audio properties of the WAV file
 */
export async function scanWAVAnalysis(
  input: WAVAnalysisInput,
): Promise<ScanResult<WAVAnalysisOutput>> {
  try {
    // Use the main process IPC call for WAV analysis
    if (!window.electronAPI?.getAudioMetadata) {
      return {
        error: "Audio metadata API not available",
        success: false,
      };
    }

    const result = await window.electronAPI.getAudioMetadata(input.filePath);

    if (!result.success || !result.data) {
      return {
        error: result.error || "Failed to analyze WAV file",
        success: false,
      };
    }

    const metadata = result.data;

    // Map AudioMetadata to WAVAnalysisOutput format
    const bitDepth = metadata.bitDepth || 16;
    const channels = metadata.channels || 1;
    const sampleRate = metadata.sampleRate || 44100;
    const bitrate = sampleRate * channels * bitDepth;
    const isStereo = channels === 2;

    // Check if we have real metadata vs just defaults
    const hasRealMetadata = Boolean(
      metadata.bitDepth && metadata.channels && metadata.sampleRate,
    );

    // Check Rample compatibility using the processed values
    const compatibility = checkRampleCompatibility({
      bitDepth,
      channels,
      sampleRate,
    });
    // File is valid only if we have real metadata AND it's compatible
    const isValid = hasRealMetadata && compatibility !== "incompatible";

    return {
      data: {
        bitDepth,
        bitrate,
        channels,
        isStereo,
        isValid,
        sampleRate,
      },
      success: true,
    };
  } catch (error) {
    return {
      error: `WAV analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      success: false,
    };
  }
}

/**
 * Checks if audio metadata is compatible with Rample requirements
 * @param metadata Audio metadata from main process (after defaults applied)
 * @returns Compatibility status
 */
function checkRampleCompatibility(metadata: {
  bitDepth: number;
  channels: number;
  sampleRate: number;
}): "convertible" | "incompatible" | "native" {
  const { bitDepth, channels, sampleRate } = metadata;

  // Check if natively compatible (no conversion needed)
  const bitDepthOk = RAMPLE_FORMAT_REQUIREMENTS.bitDepths.includes(bitDepth as 8 | 16);
  const channelsOk = channels <= RAMPLE_FORMAT_REQUIREMENTS.maxChannels;
  const sampleRateOk =
    RAMPLE_FORMAT_REQUIREMENTS.sampleRates.includes(sampleRate as 44100);

  if (bitDepthOk && channelsOk && sampleRateOk) {
    return "native";
  }

  // Check if convertible (supported by sync process)
  // Rample can handle format conversion for bit depth and sample rate
  // but has limits on channels
  if (channelsOk) {
    return "convertible";
  }

  return "incompatible";
}

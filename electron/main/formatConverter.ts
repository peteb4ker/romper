import * as fs from "fs";
import * as wav from "node-wav";
import * as path from "path";

import type { DbResult } from "../../shared/db/schema.js";
import { getAudioMetadata, RAMPLE_FORMAT_REQUIREMENTS } from "./audioUtils.js";

export interface ConversionOptions {
  targetBitDepth?: number;
  targetSampleRate?: number;
  targetChannels?: number;
  forceMonoConversion?: boolean;
}

export interface ConversionResult {
  inputPath: string;
  outputPath: string;
  originalFormat: {
    bitDepth: number;
    sampleRate: number;
    channels: number;
  };
  convertedFormat: {
    bitDepth: number;
    sampleRate: number;
    channels: number;
  };
  fileSize: number;
  duration?: number;
}

/**
 * Converts a WAV file to Rample-compatible format
 * Handles bit depth, sample rate, and channel conversion
 */
export async function convertSampleToRampleFormat(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions = {},
): Promise<DbResult<ConversionResult>> {
  try {
    // Validate input file exists
    if (!fs.existsSync(inputPath)) {
      return {
        success: false,
        error: `Input file does not exist: ${inputPath}`,
      };
    }

    // Get input file metadata
    const metadataResult = getAudioMetadata(inputPath);
    if (!metadataResult.success || !metadataResult.data) {
      return {
        success: false,
        error: `Failed to read input file metadata: ${metadataResult.error}`,
      };
    }

    const inputMetadata = metadataResult.data;

    // Set conversion targets with defaults
    const targetBitDepth = options.targetBitDepth || 16;
    const targetSampleRate = options.targetSampleRate || 44100;
    let targetChannels = options.targetChannels;

    // Apply forceMonoConversion setting if specified
    if (
      options.forceMonoConversion &&
      inputMetadata.channels &&
      inputMetadata.channels > 1
    ) {
      targetChannels = 1;
    } else if (!targetChannels) {
      // Default: preserve channel count unless it exceeds Rample limits
      targetChannels = Math.min(
        inputMetadata.channels || 1,
        RAMPLE_FORMAT_REQUIREMENTS.maxChannels,
      );
    }

    // Validate target format is supported by Rample
    if (!RAMPLE_FORMAT_REQUIREMENTS.bitDepths.includes(targetBitDepth)) {
      return {
        success: false,
        error: `Target bit depth ${targetBitDepth} not supported by Rample`,
      };
    }

    if (!RAMPLE_FORMAT_REQUIREMENTS.sampleRates.includes(targetSampleRate)) {
      return {
        success: false,
        error: `Target sample rate ${targetSampleRate} not supported by Rample`,
      };
    }

    // Read input WAV file
    const inputBuffer = fs.readFileSync(inputPath);
    const decoded = wav.decode(inputBuffer);

    if (!decoded || !decoded.channelData || decoded.channelData.length === 0) {
      return { success: false, error: "Failed to decode input WAV file" };
    }

    // Prepare conversion parameters
    const inputChannels = decoded.channelData.length;
    const inputSampleRate = decoded.sampleRate;
    const inputSamples = decoded.channelData[0].length;

    // Convert channel data to target format
    let outputChannelData: Float32Array[];

    if (targetChannels === 1 && inputChannels > 1) {
      // Convert stereo/multi-channel to mono by averaging channels
      const monoData = new Float32Array(inputSamples);
      for (let i = 0; i < inputSamples; i++) {
        let sum = 0;
        for (let ch = 0; ch < inputChannels; ch++) {
          sum += decoded.channelData[ch][i];
        }
        monoData[i] = sum / inputChannels;
      }
      outputChannelData = [monoData];
    } else if (targetChannels === 2 && inputChannels === 1) {
      // Convert mono to stereo by duplicating channel
      const leftChannel = decoded.channelData[0];
      const rightChannel = new Float32Array(leftChannel);
      outputChannelData = [leftChannel, rightChannel];
    } else {
      // Use existing channels (truncate if too many, or pad with zeros if too few)
      outputChannelData = [];
      for (let ch = 0; ch < targetChannels; ch++) {
        if (ch < inputChannels) {
          outputChannelData.push(decoded.channelData[ch]);
        } else {
          // Pad with silence for missing channels
          outputChannelData.push(new Float32Array(inputSamples));
        }
      }
    }

    // Handle sample rate conversion (simple linear interpolation)
    if (targetSampleRate !== inputSampleRate) {
      const ratio = targetSampleRate / inputSampleRate;
      const outputSamples = Math.floor(inputSamples * ratio);

      const resampledChannelData: Float32Array[] = [];
      for (let ch = 0; ch < outputChannelData.length; ch++) {
        const inputChannel = outputChannelData[ch];
        const outputChannel = new Float32Array(outputSamples);

        for (let i = 0; i < outputSamples; i++) {
          const sourceIndex = i / ratio;
          const leftIndex = Math.floor(sourceIndex);
          const rightIndex = Math.min(leftIndex + 1, inputChannel.length - 1);
          const fraction = sourceIndex - leftIndex;

          // Linear interpolation
          outputChannel[i] =
            inputChannel[leftIndex] * (1 - fraction) +
            inputChannel[rightIndex] * fraction;
        }
        resampledChannelData.push(outputChannel);
      }
      outputChannelData = resampledChannelData;
    }

    // Encode to WAV with target format
    const outputBuffer = wav.encode(outputChannelData, {
      sampleRate: targetSampleRate,
      float: false, // Use integer format
      bitDepth: targetBitDepth,
    });

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output file
    fs.writeFileSync(outputPath, outputBuffer);

    // Get output file stats
    const outputStats = fs.statSync(outputPath);

    // Calculate duration
    const samplesPerSecond = targetSampleRate;
    const outputSamples = outputChannelData[0].length;
    const duration = outputSamples / samplesPerSecond;

    const result: ConversionResult = {
      inputPath,
      outputPath,
      originalFormat: {
        bitDepth: inputMetadata.bitDepth || 16,
        sampleRate: inputMetadata.sampleRate || 44100,
        channels: inputMetadata.channels || 1,
      },
      convertedFormat: {
        bitDepth: targetBitDepth,
        sampleRate: targetSampleRate,
        channels: targetChannels,
      },
      fileSize: outputStats.size,
      duration,
    };

    return { success: true, data: result };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Audio conversion failed: ${errorMessage}`,
    };
  }
}

/**
 * Converts sample to Rample format with default settings
 * This is a convenience function that applies the most common conversion settings
 */
export async function convertToRampleDefault(
  inputPath: string,
  outputPath: string,
  forceMonoConversion = false,
): Promise<DbResult<ConversionResult>> {
  return convertSampleToRampleFormat(inputPath, outputPath, {
    targetBitDepth: 16,
    targetSampleRate: 44100,
    forceMonoConversion,
  });
}

/**
 * Checks if a file needs conversion to meet Rample requirements
 * Returns the conversion options needed, or null if no conversion is required
 */
export function getRequiredConversionOptions(
  metadata: { bitDepth?: number; sampleRate?: number; channels?: number },
  forceMonoConversion = false,
): ConversionOptions | null {
  const options: ConversionOptions = {};
  let needsConversion = false;

  // Check bit depth
  if (
    metadata.bitDepth &&
    !RAMPLE_FORMAT_REQUIREMENTS.bitDepths.includes(metadata.bitDepth)
  ) {
    options.targetBitDepth = 16; // Default to 16-bit
    needsConversion = true;
  }

  // Check sample rate
  if (
    metadata.sampleRate &&
    !RAMPLE_FORMAT_REQUIREMENTS.sampleRates.includes(metadata.sampleRate)
  ) {
    options.targetSampleRate = RAMPLE_FORMAT_REQUIREMENTS.sampleRates[0]; // 44100 Hz
    needsConversion = true;
  }

  // Check channels
  if (
    metadata.channels &&
    metadata.channels > RAMPLE_FORMAT_REQUIREMENTS.maxChannels
  ) {
    options.targetChannels = RAMPLE_FORMAT_REQUIREMENTS.maxChannels; // Convert to stereo
    needsConversion = true;
  }

  // Apply force mono conversion if requested
  if (forceMonoConversion && metadata.channels && metadata.channels > 1) {
    options.targetChannels = 1;
    options.forceMonoConversion = true;
    needsConversion = true;
  }

  return needsConversion ? options : null;
}

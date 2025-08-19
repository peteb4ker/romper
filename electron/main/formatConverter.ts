import type { DbResult } from "@romper/shared/db/schema.js";

import * as fs from "fs";
import * as wav from "node-wav";
import * as path from "path";

import { getAudioMetadata, RAMPLE_FORMAT_REQUIREMENTS } from "./audioUtils.js";

export interface ConversionOptions {
  forceMonoConversion?: boolean;
  targetBitDepth?: number;
  targetChannels?: number;
  targetSampleRate?: number;
}

export interface ConversionResult {
  convertedFormat: {
    bitDepth: number;
    channels: number;
    sampleRate: number;
  };
  duration?: number;
  fileSize: number;
  inputPath: string;
  originalFormat: {
    bitDepth: number;
    channels: number;
    sampleRate: number;
  };
  outputPath: string;
}

/**
 * Converts a WAV file to Rample-compatible format
 * Handles bit depth, sample rate, and channel conversion
 */
export async function convertSampleToRampleFormat(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions = {}
): Promise<DbResult<ConversionResult>> {
  try {
    // Validate input file exists
    if (!fs.existsSync(inputPath)) {
      return {
        error: `Input file does not exist: ${inputPath}`,
        success: false,
      };
    }

    // Get input file metadata
    const metadataResult = getAudioMetadata(inputPath);
    if (!metadataResult.success || !metadataResult.data) {
      return {
        error: `Failed to read input file metadata: ${metadataResult.error}`,
        success: false,
      };
    }

    const inputMetadata = metadataResult.data;
    const targetBitDepth = options.targetBitDepth || 16;
    const targetSampleRate = options.targetSampleRate || 44100;
    const targetChannels = determineTargetChannels(
      options,
      inputMetadata.channels || 1
    );

    // Validate target format
    const validationResult = validateTargetFormat(
      targetBitDepth,
      targetSampleRate
    );
    if (!validationResult.success) {
      return {
        error: validationResult.error,
        success: false,
      };
    }

    // Read and decode input WAV file
    const inputBuffer = fs.readFileSync(inputPath);
    const decoded = wav.decode(inputBuffer);

    if (!decoded?.channelData?.length) {
      return { error: "Failed to decode input WAV file", success: false };
    }

    const inputSampleRate = decoded.sampleRate;
    const inputSamples = decoded.channelData[0].length;

    // Convert channel data
    let outputChannelData = convertChannelData(
      [...decoded.channelData],
      targetChannels,
      inputSamples
    );

    // Handle sample rate conversion if needed
    if (targetSampleRate !== inputSampleRate) {
      outputChannelData = resampleAudio(
        outputChannelData,
        inputSampleRate,
        targetSampleRate
      );
    }

    // Write output file
    writeOutputFile(
      outputPath,
      outputChannelData,
      targetSampleRate,
      targetBitDepth
    );

    // Get output file stats and calculate result
    const outputStats = fs.statSync(outputPath);
    const duration = outputChannelData[0].length / targetSampleRate;

    const result: ConversionResult = {
      convertedFormat: {
        bitDepth: targetBitDepth,
        channels: targetChannels,
        sampleRate: targetSampleRate,
      },
      duration,
      fileSize: outputStats.size,
      inputPath,
      originalFormat: {
        bitDepth: inputMetadata.bitDepth || 16,
        channels: inputMetadata.channels || 1,
        sampleRate: inputMetadata.sampleRate || 44100,
      },
      outputPath,
    };

    return { data: result, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      error: `Audio conversion failed: ${errorMessage}`,
      success: false,
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
  forceMonoConversion = false
): Promise<DbResult<ConversionResult>> {
  return convertSampleToRampleFormat(inputPath, outputPath, {
    forceMonoConversion,
    targetBitDepth: 16,
    targetSampleRate: 44100,
  });
}

/**
 * Checks if a file needs conversion to meet Rample requirements
 * Returns the conversion options needed, or null if no conversion is required
 */
export function getRequiredConversionOptions(
  metadata: { bitDepth?: number; channels?: number; sampleRate?: number },
  forceMonoConversion = false
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

/**
 * Adjust channel count by truncating or padding
 */
function adjustChannelCount(
  channelData: Float32Array[],
  targetChannels: number,
  inputSamples: number
): Float32Array[] {
  const inputChannels = channelData.length;
  const outputChannelData: Float32Array[] = [];

  for (let ch = 0; ch < targetChannels; ch++) {
    if (ch < inputChannels) {
      outputChannelData.push(channelData[ch]);
    } else {
      // Pad with silence for missing channels
      outputChannelData.push(new Float32Array(inputSamples));
    }
  }

  return outputChannelData;
}

/**
 * Converts channel data to target channel count
 */
function convertChannelData(
  channelData: Float32Array[],
  targetChannels: number,
  inputSamples: number
): Float32Array[] {
  const inputChannels = channelData.length;

  if (targetChannels === 1 && inputChannels > 1) {
    return convertToMono(channelData, inputSamples);
  }

  if (targetChannels === 2 && inputChannels === 1) {
    return convertToStereo(channelData[0]);
  }

  return adjustChannelCount(channelData, targetChannels, inputSamples);
}

/**
 * Convert multi-channel to mono by averaging
 */
function convertToMono(
  channelData: Float32Array[],
  inputSamples: number
): Float32Array[] {
  const inputChannels = channelData.length;
  const monoData = new Float32Array(inputSamples);

  for (let i = 0; i < inputSamples; i++) {
    let sum = 0;
    for (let ch = 0; ch < inputChannels; ch++) {
      sum += channelData[ch][i];
    }
    monoData[i] = sum / inputChannels;
  }

  return [monoData];
}

/**
 * Convert mono to stereo by duplicating channel
 */
function convertToStereo(monoChannel: Float32Array): Float32Array[] {
  const leftChannel = monoChannel;
  const rightChannel = new Float32Array(leftChannel);
  return [leftChannel, rightChannel];
}

/**
 * Determines target channel count based on options and input metadata
 */
function determineTargetChannels(
  options: ConversionOptions,
  inputChannels: number
): number {
  if (options.forceMonoConversion && inputChannels > 1) {
    return 1;
  }

  if (options.targetChannels) {
    return options.targetChannels;
  }

  return Math.min(inputChannels, RAMPLE_FORMAT_REQUIREMENTS.maxChannels);
}

/**
 * Performs sample rate conversion using linear interpolation
 */
function resampleAudio(
  channelData: Float32Array[],
  inputSampleRate: number,
  targetSampleRate: number
): Float32Array[] {
  const ratio = targetSampleRate / inputSampleRate;
  const outputSamples = Math.floor(channelData[0].length * ratio);

  const resampledChannelData: Float32Array[] = [];
  for (const inputChannel of channelData) {
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
  return resampledChannelData;
}

/**
 * Validates target format against Rample requirements
 */
function validateTargetFormat(
  targetBitDepth: number,
  targetSampleRate: number
): DbResult<void> {
  if (!RAMPLE_FORMAT_REQUIREMENTS.bitDepths.includes(targetBitDepth)) {
    return {
      error: `Target bit depth ${targetBitDepth} not supported by Rample`,
      success: false,
    };
  }

  if (!RAMPLE_FORMAT_REQUIREMENTS.sampleRates.includes(targetSampleRate)) {
    return {
      error: `Target sample rate ${targetSampleRate} not supported by Rample`,
      success: false,
    };
  }

  return { success: true };
}

/**
 * Writes audio data to output file
 */
function writeOutputFile(
  outputPath: string,
  channelData: Float32Array[],
  targetSampleRate: number,
  targetBitDepth: number
): void {
  const outputBuffer = wav.encode(channelData, {
    bitDepth: targetBitDepth,
    float: false,
    sampleRate: targetSampleRate,
  });

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, outputBuffer);
}

import * as wav from "node-wav";
import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getAudioMetadata } from "../audioUtils.js";
import {
  convertSampleToRampleFormat,
  convertToRampleDefault,
  getRequiredConversionOptions,
} from "../formatConverter.js";

/**
 * Integration tests for formatConverter.ts
 *
 * These tests use REAL WAV files created via node-wav encode,
 * REAL filesystem I/O, and verify the actual converted output
 * can be decoded back to valid audio.
 */

const TEST_DIR = path.join(__dirname, "test-data-format-converter");

/** Create a real WAV file on disk using node-wav encode */
function createTestWavFile(
  filePath: string,
  channelData: Float32Array[],
  sampleRate: number,
  bitDepth = 16,
): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const encoded = wav.encode(channelData, {
    bitDepth,
    float: false,
    sampleRate,
  });
  fs.writeFileSync(filePath, encoded);
}

/** Generate a sine wave of the given length */
function generateSineWave(numSamples: number, frequency = 440): Float32Array {
  const data = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    data[i] = Math.sin((2 * Math.PI * frequency * i) / 44100);
  }
  return data;
}

describe("formatConverter integration tests", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { force: true, recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { force: true, recursive: true });
    }
  });

  describe("convertSampleToRampleFormat - channel conversion", () => {
    it("should convert stereo WAV to mono when forceMonoConversion is set", async () => {
      const inputPath = path.join(TEST_DIR, "stereo-input.wav");
      const outputPath = path.join(TEST_DIR, "mono-output.wav");

      // Create a real stereo WAV: left channel sine, right channel different sine
      const numSamples = 4410; // 0.1 seconds at 44100 Hz
      const leftChannel = generateSineWave(numSamples, 440);
      const rightChannel = generateSineWave(numSamples, 880);

      createTestWavFile(inputPath, [leftChannel, rightChannel], 44100);

      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        forceMonoConversion: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.convertedFormat.channels).toBe(1);
      expect(result.data!.originalFormat.channels).toBe(2);

      // Verify output file is valid WAV
      expect(fs.existsSync(outputPath)).toBe(true);
      const outputBuffer = fs.readFileSync(outputPath);
      const decoded = wav.decode(outputBuffer);
      expect(decoded.channelData.length).toBe(1);
      expect(decoded.sampleRate).toBe(44100);

      // Mono should be average of left and right channels
      const monoData = decoded.channelData[0];
      expect(monoData.length).toBe(numSamples);
      // Spot-check a few samples: mono = (left + right) / 2
      for (let i = 0; i < 10; i++) {
        const expected = (leftChannel[i] + rightChannel[i]) / 2;
        expect(monoData[i]).toBeCloseTo(expected, 2);
      }
    });

    it("should convert mono WAV to stereo when targetChannels is 2", async () => {
      const inputPath = path.join(TEST_DIR, "mono-input.wav");
      const outputPath = path.join(TEST_DIR, "stereo-output.wav");

      const numSamples = 4410;
      const monoChannel = generateSineWave(numSamples, 440);

      createTestWavFile(inputPath, [monoChannel], 44100);

      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        targetChannels: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data!.convertedFormat.channels).toBe(2);
      expect(result.data!.originalFormat.channels).toBe(1);

      // Verify output is valid stereo WAV
      const outputBuffer = fs.readFileSync(outputPath);
      const decoded = wav.decode(outputBuffer);
      expect(decoded.channelData.length).toBe(2);

      // Both channels should be identical to the input mono
      const left = decoded.channelData[0];
      const right = decoded.channelData[1];
      expect(left.length).toBe(numSamples);
      expect(right.length).toBe(numSamples);

      for (let i = 0; i < 10; i++) {
        expect(left[i]).toBeCloseTo(monoChannel[i], 2);
        expect(right[i]).toBeCloseTo(monoChannel[i], 2);
      }
    });

    it("should preserve stereo when no channel conversion is requested", async () => {
      const inputPath = path.join(TEST_DIR, "stereo-pass.wav");
      const outputPath = path.join(TEST_DIR, "stereo-pass-out.wav");

      const numSamples = 4410;
      const left = generateSineWave(numSamples, 440);
      const right = generateSineWave(numSamples, 880);
      createTestWavFile(inputPath, [left, right], 44100);

      const result = await convertSampleToRampleFormat(inputPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.data!.convertedFormat.channels).toBe(2);

      const decoded = wav.decode(fs.readFileSync(outputPath));
      expect(decoded.channelData.length).toBe(2);
    });
  });

  describe("convertSampleToRampleFormat - gain", () => {
    it("should apply positive gain (amplification)", async () => {
      const inputPath = path.join(TEST_DIR, "gain-pos-in.wav");
      const outputPath = path.join(TEST_DIR, "gain-pos-out.wav");

      const numSamples = 4410;
      // Use a low-amplitude signal so amplification doesn't clip
      const data = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        data[i] = 0.1 * Math.sin((2 * Math.PI * 440 * i) / 44100);
      }

      createTestWavFile(inputPath, [data], 44100);

      const gainDb = 6; // ~2x amplification
      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        gainDb,
      });

      expect(result.success).toBe(true);

      const decoded = wav.decode(fs.readFileSync(outputPath));
      const outputData = decoded.channelData[0];

      // Gain of +6dB should roughly double the amplitude
      const linearGain = Math.pow(10, gainDb / 20);
      for (let i = 1; i < 10; i++) {
        const expected = Math.max(-1.0, Math.min(1.0, data[i] * linearGain));
        expect(outputData[i]).toBeCloseTo(expected, 2);
      }
    });

    it("should apply negative gain (attenuation)", async () => {
      const inputPath = path.join(TEST_DIR, "gain-neg-in.wav");
      const outputPath = path.join(TEST_DIR, "gain-neg-out.wav");

      const numSamples = 4410;
      const data = generateSineWave(numSamples, 440);
      createTestWavFile(inputPath, [data], 44100);

      const gainDb = -6; // ~0.5x attenuation
      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        gainDb,
      });

      expect(result.success).toBe(true);

      const decoded = wav.decode(fs.readFileSync(outputPath));
      const outputData = decoded.channelData[0];

      const linearGain = Math.pow(10, gainDb / 20);
      for (let i = 1; i < 10; i++) {
        const expected = data[i] * linearGain;
        expect(outputData[i]).toBeCloseTo(expected, 2);
      }
    });

    it("should not modify audio when gain is zero", async () => {
      const inputPath = path.join(TEST_DIR, "gain-zero-in.wav");
      const outputPath = path.join(TEST_DIR, "gain-zero-out.wav");

      const numSamples = 4410;
      const data = generateSineWave(numSamples, 440);
      createTestWavFile(inputPath, [data], 44100);

      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        gainDb: 0,
      });

      expect(result.success).toBe(true);

      const decoded = wav.decode(fs.readFileSync(outputPath));
      const outputData = decoded.channelData[0];

      // With 0dB gain, output should match input
      for (let i = 0; i < 10; i++) {
        expect(outputData[i]).toBeCloseTo(data[i], 2);
      }
    });

    it("should clamp output values when gain causes clipping", async () => {
      const inputPath = path.join(TEST_DIR, "gain-clip-in.wav");
      const outputPath = path.join(TEST_DIR, "gain-clip-out.wav");

      const numSamples = 4410;
      const data = new Float32Array(numSamples);
      // Signal near full scale
      for (let i = 0; i < numSamples; i++) {
        data[i] = 0.9;
      }
      createTestWavFile(inputPath, [data], 44100);

      // Verify input was created and is readable
      expect(fs.existsSync(inputPath)).toBe(true);

      // +20dB gain should heavily clip
      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        gainDb: 20,
      });

      expect(result.success).toBe(true);

      const decoded = wav.decode(fs.readFileSync(outputPath));
      const outputData = decoded.channelData[0];

      // All samples should be clamped to 1.0 (or very close due to 16-bit quantization)
      for (let i = 0; i < 10; i++) {
        expect(outputData[i]).toBeGreaterThanOrEqual(0.99);
        expect(outputData[i]).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe("convertSampleToRampleFormat - resampling", () => {
    it("should resample from 48000 Hz to 44100 Hz", async () => {
      const inputPath = path.join(TEST_DIR, "resample-48k-in.wav");
      const outputPath = path.join(TEST_DIR, "resample-48k-out.wav");

      const numSamples = 4800; // 0.1 seconds at 48000 Hz
      const data = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        data[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
      }
      createTestWavFile(inputPath, [data], 48000);

      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        targetSampleRate: 44100,
      });

      expect(result.success).toBe(true);
      expect(result.data!.convertedFormat.sampleRate).toBe(44100);
      expect(result.data!.originalFormat.sampleRate).toBe(48000);

      // Verify output is at 44100 Hz
      const decoded = wav.decode(fs.readFileSync(outputPath));
      expect(decoded.sampleRate).toBe(44100);

      // Resampled length should be floor(4800 * 44100/48000) = 4410
      expect(decoded.channelData[0].length).toBe(
        Math.floor(numSamples * (44100 / 48000)),
      );
    });

    it("should resample from 22050 Hz to 44100 Hz (upsampling)", async () => {
      const inputPath = path.join(TEST_DIR, "resample-22k-in.wav");
      const outputPath = path.join(TEST_DIR, "resample-22k-out.wav");

      const numSamples = 2205; // 0.1 seconds at 22050 Hz
      const data = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        data[i] = Math.sin((2 * Math.PI * 440 * i) / 22050);
      }
      createTestWavFile(inputPath, [data], 22050);

      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        targetSampleRate: 44100,
      });

      expect(result.success).toBe(true);
      expect(result.data!.convertedFormat.sampleRate).toBe(44100);

      const decoded = wav.decode(fs.readFileSync(outputPath));
      expect(decoded.sampleRate).toBe(44100);

      // Upsampled length should be floor(2205 * 44100/22050) = 4410
      expect(decoded.channelData[0].length).toBe(
        Math.floor(numSamples * (44100 / 22050)),
      );
    });

    it("should not resample when already at target rate", async () => {
      const inputPath = path.join(TEST_DIR, "resample-noop-in.wav");
      const outputPath = path.join(TEST_DIR, "resample-noop-out.wav");

      const numSamples = 4410;
      const data = generateSineWave(numSamples, 440);
      createTestWavFile(inputPath, [data], 44100);

      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        targetSampleRate: 44100,
      });

      expect(result.success).toBe(true);

      const decoded = wav.decode(fs.readFileSync(outputPath));
      expect(decoded.sampleRate).toBe(44100);
      expect(decoded.channelData[0].length).toBe(numSamples);
    });
  });

  describe("convertSampleToRampleFormat - combined conversions", () => {
    it("should convert stereo 48kHz to mono 44.1kHz with gain in one pass", async () => {
      const inputPath = path.join(TEST_DIR, "combined-in.wav");
      const outputPath = path.join(TEST_DIR, "combined-out.wav");

      const numSamples = 4800;
      const left = new Float32Array(numSamples);
      const right = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        left[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / 48000);
        right[i] = 0.3 * Math.sin((2 * Math.PI * 880 * i) / 48000);
      }

      createTestWavFile(inputPath, [left, right], 48000);

      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        forceMonoConversion: true,
        gainDb: 3,
        targetSampleRate: 44100,
      });

      expect(result.success).toBe(true);
      expect(result.data!.convertedFormat.channels).toBe(1);
      expect(result.data!.convertedFormat.sampleRate).toBe(44100);
      expect(result.data!.originalFormat.channels).toBe(2);
      expect(result.data!.originalFormat.sampleRate).toBe(48000);

      const decoded = wav.decode(fs.readFileSync(outputPath));
      expect(decoded.channelData.length).toBe(1);
      expect(decoded.sampleRate).toBe(44100);
    });
  });

  describe("convertSampleToRampleFormat - error handling", () => {
    it("should return error for missing input file", async () => {
      const result = await convertSampleToRampleFormat(
        path.join(TEST_DIR, "nonexistent.wav"),
        path.join(TEST_DIR, "output.wav"),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Input file does not exist");
    });

    it("should return error for corrupted WAV file", async () => {
      const inputPath = path.join(TEST_DIR, "corrupted.wav");
      // Write garbage data - not a valid WAV
      fs.writeFileSync(inputPath, Buffer.from("this is not a wav file at all"));

      const result = await convertSampleToRampleFormat(
        inputPath,
        path.join(TEST_DIR, "output.wav"),
      );

      expect(result.success).toBe(false);
      // Could fail at metadata read or WAV decode
      expect(result.error).toBeDefined();
    });

    it("should return error for non-WAV file with .wav extension", async () => {
      const inputPath = path.join(TEST_DIR, "fake.wav");
      // Write a valid-looking RIFF header but with non-PCM format
      const buffer = Buffer.alloc(44);
      buffer.write("RIFF", 0);
      buffer.writeUInt32LE(36, 4);
      buffer.write("WAVE", 8);
      buffer.write("fmt ", 12);
      buffer.writeUInt32LE(16, 16); // fmt chunk size
      buffer.writeUInt16LE(2, 20); // audioFormat = 2 (non-PCM)
      buffer.writeUInt16LE(1, 22); // channels
      buffer.writeUInt32LE(44100, 24); // sampleRate
      buffer.writeUInt32LE(88200, 28); // byteRate
      buffer.writeUInt16LE(2, 32); // blockAlign
      buffer.writeUInt16LE(16, 34); // bitsPerSample
      buffer.write("data", 36);
      buffer.writeUInt32LE(0, 40);
      fs.writeFileSync(inputPath, buffer);

      const result = await convertSampleToRampleFormat(
        inputPath,
        path.join(TEST_DIR, "output.wav"),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should create output directory if it does not exist", async () => {
      const inputPath = path.join(TEST_DIR, "input.wav");
      const outputPath = path.join(TEST_DIR, "nested", "deep", "output.wav");

      const data = generateSineWave(4410, 440);
      createTestWavFile(inputPath, [data], 44100);

      const result = await convertSampleToRampleFormat(inputPath, outputPath);

      expect(result.success).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
    });
  });

  describe("convertSampleToRampleFormat - result metadata", () => {
    it("should return correct fileSize and duration", async () => {
      const inputPath = path.join(TEST_DIR, "meta-in.wav");
      const outputPath = path.join(TEST_DIR, "meta-out.wav");

      const numSamples = 44100; // 1 second at 44100 Hz
      const data = generateSineWave(numSamples, 440);
      createTestWavFile(inputPath, [data], 44100);

      const result = await convertSampleToRampleFormat(inputPath, outputPath);

      expect(result.success).toBe(true);
      expect(result.data!.duration).toBeCloseTo(1.0, 2);
      expect(result.data!.fileSize).toBeGreaterThan(0);
      expect(result.data!.inputPath).toBe(inputPath);
      expect(result.data!.outputPath).toBe(outputPath);
    });
  });

  describe("convertToRampleDefault", () => {
    it("should convert a 48kHz stereo file to 44.1kHz mono with default settings", async () => {
      const inputPath = path.join(TEST_DIR, "default-in.wav");
      const outputPath = path.join(TEST_DIR, "default-out.wav");

      const numSamples = 4800;
      const left = new Float32Array(numSamples);
      const right = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        left[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000);
        right[i] = 0.5 * Math.sin((2 * Math.PI * 880 * i) / 48000);
      }
      createTestWavFile(inputPath, [left, right], 48000);

      const result = await convertToRampleDefault(
        inputPath,
        outputPath,
        true,
        -3,
      );

      expect(result.success).toBe(true);
      expect(result.data!.convertedFormat).toEqual({
        bitDepth: 16,
        channels: 1,
        sampleRate: 44100,
      });

      const decoded = wav.decode(fs.readFileSync(outputPath));
      expect(decoded.channelData.length).toBe(1);
      expect(decoded.sampleRate).toBe(44100);
    });

    it("should preserve stereo when forceMonoConversion is false", async () => {
      const inputPath = path.join(TEST_DIR, "default-stereo-in.wav");
      const outputPath = path.join(TEST_DIR, "default-stereo-out.wav");

      const numSamples = 4410;
      const left = generateSineWave(numSamples, 440);
      const right = generateSineWave(numSamples, 880);
      createTestWavFile(inputPath, [left, right], 44100);

      const result = await convertToRampleDefault(inputPath, outputPath, false);

      expect(result.success).toBe(true);
      expect(result.data!.convertedFormat.channels).toBe(2);
    });
  });

  describe("getRequiredConversionOptions - with real RAMPLE_FORMAT_REQUIREMENTS", () => {
    it("should return null for Rample-compatible format (16-bit 44.1kHz mono)", () => {
      const result = getRequiredConversionOptions({
        bitDepth: 16,
        channels: 1,
        sampleRate: 44100,
      });
      expect(result).toBeNull();
    });

    it("should return null for Rample-compatible format (16-bit 44.1kHz stereo)", () => {
      const result = getRequiredConversionOptions({
        bitDepth: 16,
        channels: 2,
        sampleRate: 44100,
      });
      expect(result).toBeNull();
    });

    it("should return null for 8-bit 44.1kHz mono", () => {
      const result = getRequiredConversionOptions({
        bitDepth: 8,
        channels: 1,
        sampleRate: 44100,
      });
      expect(result).toBeNull();
    });

    it("should detect unsupported bit depth (24-bit)", () => {
      const result = getRequiredConversionOptions({
        bitDepth: 24,
        channels: 1,
        sampleRate: 44100,
      });
      expect(result).not.toBeNull();
      expect(result!.targetBitDepth).toBe(16);
    });

    it("should detect unsupported bit depth (32-bit)", () => {
      const result = getRequiredConversionOptions({
        bitDepth: 32,
        channels: 1,
        sampleRate: 44100,
      });
      expect(result).not.toBeNull();
      expect(result!.targetBitDepth).toBe(16);
    });

    it("should detect unsupported sample rate (48000)", () => {
      const result = getRequiredConversionOptions({
        bitDepth: 16,
        channels: 1,
        sampleRate: 48000,
      });
      expect(result).not.toBeNull();
      expect(result!.targetSampleRate).toBe(44100);
    });

    it("should detect unsupported sample rate (96000)", () => {
      const result = getRequiredConversionOptions({
        bitDepth: 16,
        channels: 1,
        sampleRate: 96000,
      });
      expect(result).not.toBeNull();
      expect(result!.targetSampleRate).toBe(44100);
    });

    it("should detect too many channels (surround 5.1)", () => {
      const result = getRequiredConversionOptions({
        bitDepth: 16,
        channels: 6,
        sampleRate: 44100,
      });
      expect(result).not.toBeNull();
      expect(result!.targetChannels).toBe(2); // maxChannels
    });

    it("should force mono conversion for stereo when requested", () => {
      const result = getRequiredConversionOptions(
        { bitDepth: 16, channels: 2, sampleRate: 44100 },
        true,
      );
      expect(result).not.toBeNull();
      expect(result!.targetChannels).toBe(1);
      expect(result!.forceMonoConversion).toBe(true);
    });

    it("should not force mono for already-mono audio", () => {
      const result = getRequiredConversionOptions(
        { bitDepth: 16, channels: 1, sampleRate: 44100 },
        true,
      );
      // Mono file + forceMonoConversion should not need conversion
      expect(result).toBeNull();
    });

    it("should combine multiple conversion requirements", () => {
      const result = getRequiredConversionOptions({
        bitDepth: 24,
        channels: 6,
        sampleRate: 96000,
      });
      expect(result).not.toBeNull();
      expect(result!.targetBitDepth).toBe(16);
      expect(result!.targetSampleRate).toBe(44100);
      expect(result!.targetChannels).toBe(2);
    });

    it("should return null for empty metadata", () => {
      expect(getRequiredConversionOptions({})).toBeNull();
    });

    it("should return null for undefined metadata fields", () => {
      expect(
        getRequiredConversionOptions({
          bitDepth: undefined,
          channels: undefined,
          sampleRate: undefined,
        }),
      ).toBeNull();
    });
  });

  describe("end-to-end roundtrip", () => {
    it("should produce a valid WAV file that can be read back with getAudioMetadata", async () => {
      const inputPath = path.join(TEST_DIR, "roundtrip-in.wav");
      const outputPath = path.join(TEST_DIR, "roundtrip-out.wav");

      // Create a stereo 48kHz input
      const numSamples = 4800;
      const left = new Float32Array(numSamples);
      const right = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        left[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48000);
        right[i] = 0.5 * Math.sin((2 * Math.PI * 880 * i) / 48000);
      }
      createTestWavFile(inputPath, [left, right], 48000);

      // Verify input metadata
      const inputMeta = getAudioMetadata(inputPath);
      expect(inputMeta.success).toBe(true);
      expect(inputMeta.data!.channels).toBe(2);
      expect(inputMeta.data!.sampleRate).toBe(48000);

      // Convert to Rample format
      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        forceMonoConversion: true,
        targetBitDepth: 16,
        targetSampleRate: 44100,
      });

      expect(result.success).toBe(true);

      // Verify output metadata using getAudioMetadata
      const outputMeta = getAudioMetadata(outputPath);
      expect(outputMeta.success).toBe(true);
      expect(outputMeta.data!.channels).toBe(1);
      expect(outputMeta.data!.sampleRate).toBe(44100);
      expect(outputMeta.data!.bitDepth).toBe(16);
      expect(outputMeta.data!.duration).toBeGreaterThan(0);
    });

    it("should produce output that passes getRequiredConversionOptions as null (already compatible)", async () => {
      const inputPath = path.join(TEST_DIR, "compat-in.wav");
      const outputPath = path.join(TEST_DIR, "compat-out.wav");

      // Create an incompatible file: 24-bit, 96kHz, 4-channel
      const numSamples = 960;
      const channels: Float32Array[] = [];
      for (let ch = 0; ch < 4; ch++) {
        const data = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
          data[i] =
            0.3 * Math.sin((2 * Math.PI * (440 + ch * 220) * i) / 96000);
        }
        channels.push(data);
      }
      // node-wav can only encode up to stereo reliably, so we use stereo for this test
      createTestWavFile(inputPath, [channels[0], channels[1]], 48000);

      // Convert
      const result = await convertSampleToRampleFormat(inputPath, outputPath, {
        targetBitDepth: 16,
        targetSampleRate: 44100,
      });

      expect(result.success).toBe(true);

      // Read output metadata and check it needs no further conversion
      const outputMeta = getAudioMetadata(outputPath);
      expect(outputMeta.success).toBe(true);

      const conversionNeeded = getRequiredConversionOptions({
        bitDepth: outputMeta.data!.bitDepth,
        channels: outputMeta.data!.channels,
        sampleRate: outputMeta.data!.sampleRate,
      });
      expect(conversionNeeded).toBeNull();
    });
  });
});

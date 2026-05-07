import * as wav from "node-wav";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getAudioMetadata,
  isFormatIssueCritical,
  RAMPLE_FORMAT_REQUIREMENTS,
  validateAudioFormat,
  validateFileExtension,
  validateSampleFormat,
} from "../audioUtils.js";

/**
 * Integration tests for audioUtils.ts
 *
 * These tests use REAL WAV files created via node-wav encode and
 * raw Buffer construction. They validate getAudioMetadata,
 * validateSampleFormat, and validateAudioFormat against actual
 * files on the filesystem.
 */

const TEST_DIR = path.join(__dirname, "test-data-audio-utils");

/** Create a minimal valid WAV header manually for edge-case tests */
function createRawWavHeader(config: {
  audioFormat: number;
  bitsPerSample: number;
  channels: number;
  dataSize?: number;
  sampleRate: number;
}): Buffer {
  const dataSize = config.dataSize ?? 0;
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM fmt chunk size
  buffer.writeUInt16LE(config.audioFormat, 20);
  buffer.writeUInt16LE(config.channels, 22);
  buffer.writeUInt32LE(config.sampleRate, 24);

  const bytesPerSecond =
    config.sampleRate * config.channels * (config.bitsPerSample / 8);
  buffer.writeUInt32LE(bytesPerSecond, 28);

  const blockAlign = config.channels * (config.bitsPerSample / 8);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(config.bitsPerSample, 34);

  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

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

describe("audioUtils integration tests", () => {
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

  describe("getAudioMetadata - with real node-wav generated files", () => {
    it("should extract metadata from a mono 16-bit 44.1kHz WAV file", () => {
      const filePath = path.join(TEST_DIR, "mono16.wav");
      const numSamples = 44100; // 1 second
      const data = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        data[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
      }
      createTestWavFile(filePath, [data], 44100, 16);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.channels).toBe(1);
      expect(result.data!.sampleRate).toBe(44100);
      expect(result.data!.bitDepth).toBe(16);
      expect(result.data!.fileSize).toBeGreaterThan(44); // Must be larger than header
      expect(result.data!.duration).toBeCloseTo(1.0, 1);
    });

    it("should extract metadata from a stereo 16-bit 44.1kHz WAV file", () => {
      const filePath = path.join(TEST_DIR, "stereo16.wav");
      const numSamples = 22050; // 0.5 seconds
      const left = new Float32Array(numSamples);
      const right = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        left[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
        right[i] = Math.sin((2 * Math.PI * 880 * i) / 44100);
      }
      createTestWavFile(filePath, [left, right], 44100, 16);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.channels).toBe(2);
      expect(result.data!.sampleRate).toBe(44100);
      expect(result.data!.bitDepth).toBe(16);
      expect(result.data!.duration).toBeCloseTo(0.5, 1);
    });

    it("should extract metadata from an 8-bit WAV file", () => {
      const filePath = path.join(TEST_DIR, "mono8.wav");
      const numSamples = 4410;
      const data = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        data[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 44100);
      }
      createTestWavFile(filePath, [data], 44100, 8);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.bitDepth).toBe(8);
      expect(result.data!.channels).toBe(1);
      expect(result.data!.sampleRate).toBe(44100);
    });

    it("should extract metadata from a 48kHz WAV file", () => {
      const filePath = path.join(TEST_DIR, "mono48k.wav");
      const numSamples = 48000;
      const data = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        data[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
      }
      createTestWavFile(filePath, [data], 48000, 16);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.sampleRate).toBe(48000);
      expect(result.data!.duration).toBeCloseTo(1.0, 1);
    });

    it("should calculate correct duration for short files", () => {
      const filePath = path.join(TEST_DIR, "short.wav");
      // 100ms of audio
      const numSamples = 4410;
      const data = new Float32Array(numSamples);
      createTestWavFile(filePath, [data], 44100, 16);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.duration).toBeCloseTo(0.1, 2);
    });

    it("should return correct fileSize for generated WAV", () => {
      const filePath = path.join(TEST_DIR, "size-check.wav");
      const numSamples = 1000;
      const data = new Float32Array(numSamples);
      createTestWavFile(filePath, [data], 44100, 16);

      const result = getAudioMetadata(filePath);
      const stats = fs.statSync(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.fileSize).toBe(stats.size);
    });
  });

  describe("getAudioMetadata - error cases", () => {
    it("should return error for missing file", () => {
      const result = getAudioMetadata(path.join(TEST_DIR, "nonexistent.wav"));

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return error for non-WAV extension", () => {
      const filePath = path.join(TEST_DIR, "audio.mp3");
      fs.writeFileSync(filePath, "fake mp3");

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Only WAV files are supported");
    });

    it("should return error for .ogg extension", () => {
      const filePath = path.join(TEST_DIR, "audio.ogg");
      fs.writeFileSync(filePath, "fake ogg");

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Only WAV files are supported");
    });

    it("should return error for truncated file (less than 44 bytes)", () => {
      const filePath = path.join(TEST_DIR, "truncated.wav");
      fs.writeFileSync(filePath, Buffer.alloc(20));

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("header too short");
    });

    it("should return error for file with invalid RIFF header", () => {
      const filePath = path.join(TEST_DIR, "bad-riff.wav");
      const buffer = Buffer.alloc(44);
      buffer.write("XXXX", 0); // Not RIFF
      buffer.write("WAVE", 8);
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing RIFF header");
    });

    it("should return error for RIFF file that is not WAVE", () => {
      const filePath = path.join(TEST_DIR, "riff-not-wave.wav");
      const buffer = Buffer.alloc(44);
      buffer.write("RIFF", 0);
      buffer.writeUInt32LE(36, 4);
      buffer.write("AVI ", 8); // Not WAVE
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not WAVE format");
    });

    it("should return error for file without fmt chunk", () => {
      const filePath = path.join(TEST_DIR, "no-fmt.wav");
      const buffer = Buffer.alloc(44);
      buffer.write("RIFF", 0);
      buffer.writeUInt32LE(36, 4);
      buffer.write("WAVE", 8);
      buffer.write("data", 12); // Missing "fmt "
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing fmt chunk");
    });

    it("should return error for non-PCM audio format", () => {
      const filePath = path.join(TEST_DIR, "non-pcm.wav");
      const buffer = createRawWavHeader({
        audioFormat: 3, // IEEE Float
        bitsPerSample: 32,
        channels: 1,
        sampleRate: 44100,
      });
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Only uncompressed PCM format is supported",
      );
    });

    it("should return error for non-standard fmt chunk size", () => {
      const filePath = path.join(TEST_DIR, "bad-fmt-size.wav");
      const buffer = Buffer.alloc(44);
      buffer.write("RIFF", 0);
      buffer.writeUInt32LE(36, 4);
      buffer.write("WAVE", 8);
      buffer.write("fmt ", 12);
      buffer.writeUInt32LE(18, 16); // Not 16 (non-PCM size)
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Only PCM format is supported");
    });
  });

  describe("validateSampleFormat - with real files", () => {
    it("should validate a Rample-compatible 16-bit 44.1kHz mono WAV as valid", () => {
      const filePath = path.join(TEST_DIR, "rample-ok.wav");
      const data = new Float32Array(4410);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
      }
      createTestWavFile(filePath, [data], 44100, 16);

      const result = validateSampleFormat(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.isValid).toBe(true);
      expect(result.data!.issues).toHaveLength(0);
      expect(result.data!.metadata).toBeDefined();
      expect(result.data!.metadata!.bitDepth).toBe(16);
      expect(result.data!.metadata!.sampleRate).toBe(44100);
      expect(result.data!.metadata!.channels).toBe(1);
    });

    it("should validate an 8-bit 44.1kHz stereo WAV as valid", () => {
      const filePath = path.join(TEST_DIR, "rample-8bit-stereo.wav");
      const left = new Float32Array(4410);
      const right = new Float32Array(4410);
      createTestWavFile(filePath, [left, right], 44100, 8);

      const result = validateSampleFormat(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.isValid).toBe(true);
      expect(result.data!.issues).toHaveLength(0);
    });

    it("should flag 48kHz sample rate as an issue", () => {
      const filePath = path.join(TEST_DIR, "bad-rate.wav");
      const data = new Float32Array(4800);
      createTestWavFile(filePath, [data], 48000, 16);

      const result = validateSampleFormat(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.isValid).toBe(false);
      expect(result.data!.issues.length).toBeGreaterThan(0);

      const sampleRateIssue = result.data!.issues.find(
        (i) => i.type === "sampleRate",
      );
      expect(sampleRateIssue).toBeDefined();
      expect(sampleRateIssue!.current).toBe(48000);
    });

    it("should flag non-WAV extension without reading content", () => {
      const filePath = path.join(TEST_DIR, "sample.mp3");
      fs.writeFileSync(filePath, "fake content");

      const result = validateSampleFormat(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.isValid).toBe(false);
      expect(result.data!.issues[0].type).toBe("extension");
    });

    it("should flag corrupted WAV as fileAccess issue", () => {
      const filePath = path.join(TEST_DIR, "corrupt.wav");
      fs.writeFileSync(filePath, "not a wav file");

      const result = validateSampleFormat(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.isValid).toBe(false);
      expect(result.data!.issues[0].type).toBe("fileAccess");
    });

    it("should flag non-existent .wav file as fileAccess issue", () => {
      const result = validateSampleFormat(path.join(TEST_DIR, "missing.wav"));

      expect(result.success).toBe(true);
      expect(result.data!.isValid).toBe(false);
      expect(result.data!.issues[0].type).toBe("fileAccess");
    });
  });

  describe("validateAudioFormat - boundary conditions", () => {
    it("should accept 8-bit audio", () => {
      const issues = validateAudioFormat({
        bitDepth: 8,
        channels: 1,
        sampleRate: 44100,
      });
      expect(issues).toHaveLength(0);
    });

    it("should accept 16-bit audio", () => {
      const issues = validateAudioFormat({
        bitDepth: 16,
        channels: 1,
        sampleRate: 44100,
      });
      expect(issues).toHaveLength(0);
    });

    it("should reject 24-bit audio", () => {
      const issues = validateAudioFormat({
        bitDepth: 24,
        channels: 1,
        sampleRate: 44100,
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("bitDepth");
    });

    it("should reject 32-bit audio", () => {
      const issues = validateAudioFormat({
        bitDepth: 32,
        channels: 1,
        sampleRate: 44100,
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("bitDepth");
    });

    it("should accept mono (1 channel)", () => {
      const issues = validateAudioFormat({
        bitDepth: 16,
        channels: 1,
        sampleRate: 44100,
      });
      expect(issues).toHaveLength(0);
    });

    it("should accept stereo (2 channels)", () => {
      const issues = validateAudioFormat({
        bitDepth: 16,
        channels: 2,
        sampleRate: 44100,
      });
      expect(issues).toHaveLength(0);
    });

    it("should reject 3+ channels", () => {
      const issues = validateAudioFormat({
        bitDepth: 16,
        channels: 3,
        sampleRate: 44100,
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("channels");
    });

    it("should reject 6-channel surround", () => {
      const issues = validateAudioFormat({
        bitDepth: 16,
        channels: 6,
        sampleRate: 44100,
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("channels");
      expect(issues[0].current).toBe(6);
    });

    it("should accept 44100 Hz sample rate", () => {
      const issues = validateAudioFormat({
        bitDepth: 16,
        channels: 1,
        sampleRate: 44100,
      });
      expect(issues).toHaveLength(0);
    });

    it("should reject 48000 Hz sample rate", () => {
      const issues = validateAudioFormat({
        bitDepth: 16,
        channels: 1,
        sampleRate: 48000,
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("sampleRate");
    });

    it("should reject 22050 Hz sample rate", () => {
      const issues = validateAudioFormat({
        bitDepth: 16,
        channels: 1,
        sampleRate: 22050,
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("sampleRate");
    });

    it("should report multiple issues simultaneously", () => {
      const issues = validateAudioFormat({
        bitDepth: 24,
        channels: 8,
        sampleRate: 96000,
      });
      expect(issues).toHaveLength(3);

      const types = issues.map((i) => i.type).sort();
      expect(types).toEqual(["bitDepth", "channels", "sampleRate"]);
    });

    it("should handle undefined fields gracefully (no issues)", () => {
      const issues = validateAudioFormat({});
      expect(issues).toHaveLength(0);
    });

    it("should handle partial metadata (only bitDepth set)", () => {
      const issues = validateAudioFormat({ bitDepth: 24 });
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("bitDepth");
    });
  });

  describe("validateFileExtension", () => {
    it("should accept .wav lowercase", () => {
      expect(validateFileExtension("/path/to/file.wav")).toBeNull();
    });

    it("should accept .WAV uppercase", () => {
      expect(validateFileExtension("/path/to/file.WAV")).toBeNull();
    });

    it("should accept .Wav mixed case", () => {
      expect(validateFileExtension("/path/to/file.Wav")).toBeNull();
    });

    it("should reject .mp3", () => {
      const issue = validateFileExtension("/path/to/file.mp3");
      expect(issue).not.toBeNull();
      expect(issue!.type).toBe("extension");
      expect(issue!.current).toBe(".mp3");
    });

    it("should reject .aiff", () => {
      const issue = validateFileExtension("/path/to/file.aiff");
      expect(issue).not.toBeNull();
      expect(issue!.type).toBe("extension");
    });

    it("should reject .flac", () => {
      const issue = validateFileExtension("/path/to/file.flac");
      expect(issue).not.toBeNull();
      expect(issue!.type).toBe("extension");
    });

    it("should reject files without extension", () => {
      const issue = validateFileExtension("/path/to/file");
      expect(issue).not.toBeNull();
      expect(issue!.type).toBe("extension");
    });
  });

  describe("isFormatIssueCritical", () => {
    it("should classify extension issues as critical", () => {
      expect(
        isFormatIssueCritical({
          message: "Wrong extension",
          type: "extension",
        }),
      ).toBe(true);
    });

    it("should classify fileAccess issues as critical", () => {
      expect(
        isFormatIssueCritical({
          message: "Cannot read",
          type: "fileAccess",
        }),
      ).toBe(true);
    });

    it("should classify invalidFormat issues as critical", () => {
      expect(
        isFormatIssueCritical({
          message: "Invalid format",
          type: "invalidFormat",
        }),
      ).toBe(true);
    });

    it("should classify bitDepth issues as non-critical (convertible)", () => {
      expect(
        isFormatIssueCritical({
          message: "Wrong bit depth",
          type: "bitDepth",
        }),
      ).toBe(false);
    });

    it("should classify sampleRate issues as non-critical (convertible)", () => {
      expect(
        isFormatIssueCritical({
          message: "Wrong rate",
          type: "sampleRate",
        }),
      ).toBe(false);
    });

    it("should classify channels issues as non-critical (convertible)", () => {
      expect(
        isFormatIssueCritical({
          message: "Too many channels",
          type: "channels",
        }),
      ).toBe(false);
    });
  });

  describe("RAMPLE_FORMAT_REQUIREMENTS constant", () => {
    it("should define supported bit depths as 8 and 16", () => {
      expect(RAMPLE_FORMAT_REQUIREMENTS.bitDepths).toContain(8);
      expect(RAMPLE_FORMAT_REQUIREMENTS.bitDepths).toContain(16);
      expect(RAMPLE_FORMAT_REQUIREMENTS.bitDepths).not.toContain(24);
      expect(RAMPLE_FORMAT_REQUIREMENTS.bitDepths).not.toContain(32);
    });

    it("should define supported sample rate as 44100", () => {
      expect(RAMPLE_FORMAT_REQUIREMENTS.sampleRates).toContain(44100);
      expect(RAMPLE_FORMAT_REQUIREMENTS.sampleRates).not.toContain(48000);
    });

    it("should define max channels as 2", () => {
      expect(RAMPLE_FORMAT_REQUIREMENTS.maxChannels).toBe(2);
    });

    it("should define .wav as the supported extension", () => {
      expect(RAMPLE_FORMAT_REQUIREMENTS.fileExtensions).toContain(".wav");
    });
  });

  describe("end-to-end: create WAV, validate, extract metadata", () => {
    it("should create a valid WAV and pass all validation checks", () => {
      const filePath = path.join(TEST_DIR, "e2e-valid.wav");

      // Create a valid Rample-compatible WAV
      const numSamples = 44100;
      const data = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        data[i] = 0.8 * Math.sin((2 * Math.PI * 440 * i) / 44100);
      }
      createTestWavFile(filePath, [data], 44100, 16);

      // Step 1: File extension validation
      const extIssue = validateFileExtension(filePath);
      expect(extIssue).toBeNull();

      // Step 2: Metadata extraction
      const metadata = getAudioMetadata(filePath);
      expect(metadata.success).toBe(true);
      expect(metadata.data!.bitDepth).toBe(16);
      expect(metadata.data!.sampleRate).toBe(44100);
      expect(metadata.data!.channels).toBe(1);

      // Step 3: Audio format validation
      const formatIssues = validateAudioFormat(metadata.data!);
      expect(formatIssues).toHaveLength(0);

      // Step 4: Full sample validation
      const sampleValidation = validateSampleFormat(filePath);
      expect(sampleValidation.data!.isValid).toBe(true);
    });

    it("should create an incompatible WAV and detect all issues", () => {
      const filePath = path.join(TEST_DIR, "e2e-bad.wav");

      // Create a 48kHz WAV (not Rample-compatible sample rate)
      const numSamples = 4800;
      const data = new Float32Array(numSamples);
      createTestWavFile(filePath, [data], 48000, 16);

      // Metadata should read correctly
      const metadata = getAudioMetadata(filePath);
      expect(metadata.success).toBe(true);
      expect(metadata.data!.sampleRate).toBe(48000);

      // Format validation should flag sample rate
      const formatIssues = validateAudioFormat(metadata.data!);
      expect(formatIssues.length).toBeGreaterThan(0);
      expect(formatIssues.some((i) => i.type === "sampleRate")).toBe(true);

      // Full sample validation should flag it too
      const sampleValidation = validateSampleFormat(filePath);
      expect(sampleValidation.data!.isValid).toBe(false);
    });
  });
});

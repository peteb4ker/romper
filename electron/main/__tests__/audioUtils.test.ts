import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getAudioMetadata,
  isFormatIssueCritical,
  validateAudioFormat,
  validateFileExtension,
  validateSampleFormat,
} from "../audioUtils.js";

describe("audioUtils", () => {
  const testDir = "/tmp/romper-audio-test";

  beforeEach(() => {
    // Clean up any existing test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("getAudioMetadata", () => {
    it("should return error for non-existent file", () => {
      const result = getAudioMetadata("/non/existent/file.wav");

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return error for non-wav files", () => {
      const filePath = path.join(testDir, "test.mp3");
      fs.writeFileSync(filePath, "fake mp3 content");

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Only WAV files are supported");
    });

    it("should return error for files that are too short", () => {
      const filePath = path.join(testDir, "short.wav");
      fs.writeFileSync(filePath, "short");

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("header too short");
    });

    it("should return error for files without RIFF header", () => {
      const filePath = path.join(testDir, "invalid.wav");
      const buffer = Buffer.alloc(44);
      buffer.write("FAKE", 0); // Invalid RIFF header
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing RIFF header");
    });

    it("should return error for files without WAVE format", () => {
      const filePath = path.join(testDir, "invalid.wav");
      const buffer = Buffer.alloc(44);
      buffer.write("RIFF", 0);
      buffer.write("FAKE", 8); // Invalid WAVE format
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not WAVE format");
    });

    it("should return error for files without fmt chunk", () => {
      const filePath = path.join(testDir, "invalid.wav");
      const buffer = Buffer.alloc(44);
      buffer.write("RIFF", 0);
      buffer.write("WAVE", 8);
      buffer.write("FAKE", 12); // Invalid fmt chunk
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing fmt chunk");
    });

    it("should return error for non-PCM format", () => {
      const filePath = path.join(testDir, "invalid.wav");
      const buffer = createValidWavHeader({
        audioFormat: 2, // Non-PCM format
        channels: 1,
        sampleRate: 44100,
        bitsPerSample: 16,
      });
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Only uncompressed PCM format is supported",
      );
    });

    it("should parse valid mono 16-bit 44100Hz WAV file", () => {
      const filePath = path.join(testDir, "valid.wav");
      const buffer = createValidWavHeader({
        audioFormat: 1,
        channels: 1,
        sampleRate: 44100,
        bitsPerSample: 16,
      });
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.channels).toBe(1);
      expect(result.data!.sampleRate).toBe(44100);
      expect(result.data!.bitDepth).toBe(16);
      expect(result.data!.fileSize).toBe(buffer.length);
    });

    it("should parse valid stereo 8-bit 44100Hz WAV file", () => {
      const filePath = path.join(testDir, "valid.wav");
      const buffer = createValidWavHeader({
        audioFormat: 1,
        channels: 2,
        sampleRate: 44100,
        bitsPerSample: 8,
      });
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.channels).toBe(2);
      expect(result.data!.sampleRate).toBe(44100);
      expect(result.data!.bitDepth).toBe(8);
    });

    it("should calculate duration from data chunk", () => {
      const filePath = path.join(testDir, "valid.wav");
      const dataSize = 44100 * 2 * 2; // 1 second of stereo 16-bit audio
      const buffer = createValidWavHeaderWithData({
        audioFormat: 1,
        channels: 2,
        sampleRate: 44100,
        bitsPerSample: 16,
        dataSize,
      });
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.duration).toBeCloseTo(1.0, 2);
    });

    it("should handle files without readable data chunk gracefully", () => {
      const filePath = path.join(testDir, "no-data.wav");
      const buffer = createValidWavHeader({
        audioFormat: 1,
        channels: 1,
        sampleRate: 44100,
        bitsPerSample: 16,
      });
      fs.writeFileSync(filePath, buffer);

      const result = getAudioMetadata(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.duration).toBeUndefined();
    });
  });

  describe("validateFileExtension", () => {
    it("should accept .wav files", () => {
      const result = validateFileExtension("/path/to/sample.wav");
      expect(result).toBeNull();
    });

    it("should accept .WAV files (case insensitive)", () => {
      const result = validateFileExtension("/path/to/sample.WAV");
      expect(result).toBeNull();
    });

    it("should reject non-wav files", () => {
      const result = validateFileExtension("/path/to/sample.mp3");
      expect(result).not.toBeNull();
      expect(result?.type).toBe("extension");
      expect(result?.message).toContain("not supported");
      expect(result?.current).toBe(".mp3");
    });
  });

  describe("validateAudioFormat", () => {
    it("should accept valid 16-bit 44100Hz mono metadata", () => {
      const metadata = {
        bitDepth: 16,
        sampleRate: 44100,
        channels: 1,
        duration: 5.0,
        fileSize: 441000,
      };

      const issues = validateAudioFormat(metadata);
      expect(issues).toHaveLength(0);
    });

    it("should reject invalid bit depth", () => {
      const metadata = {
        bitDepth: 24,
        sampleRate: 44100,
        channels: 1,
      };

      const issues = validateAudioFormat(metadata);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("bitDepth");
      expect(issues[0].current).toBe(24);
    });

    it("should reject invalid sample rate", () => {
      const metadata = {
        bitDepth: 16,
        sampleRate: 48000,
        channels: 1,
      };

      const issues = validateAudioFormat(metadata);
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe("sampleRate");
      expect(issues[0].current).toBe(48000);
    });
  });

  describe("validateSampleFormat", () => {
    it("should return invalid for non-wav files", () => {
      const filePath = path.join(testDir, "test.mp3");
      fs.writeFileSync(filePath, "fake mp3 content");

      const result = validateSampleFormat(filePath);

      expect(result.success).toBe(true);
      expect(result.data?.isValid).toBe(false);
      expect(result.data?.issues[0].type).toBe("extension");
    });

    it("should return valid for correct wav files", () => {
      const filePath = path.join(testDir, "valid.wav");
      const buffer = createValidWavHeader({
        audioFormat: 1,
        channels: 1,
        sampleRate: 44100,
        bitsPerSample: 16,
      });
      fs.writeFileSync(filePath, buffer);

      const result = validateSampleFormat(filePath);

      expect(result.success).toBe(true);
      expect(result.data?.isValid).toBe(true);
      expect(result.data?.issues).toHaveLength(0);
      expect(result.data?.metadata?.bitDepth).toBe(16);
    });
  });

  describe("isFormatIssueCritical", () => {
    it("should mark extension issues as critical", () => {
      expect(
        isFormatIssueCritical({
          type: "extension",
          message: "Wrong file type",
        }),
      ).toBe(true);
    });

    it("should mark fileAccess issues as critical", () => {
      expect(
        isFormatIssueCritical({
          type: "fileAccess",
          message: "File not found",
        }),
      ).toBe(true);
    });

    it("should mark invalidFormat issues as critical", () => {
      expect(
        isFormatIssueCritical({
          type: "invalidFormat",
          message: "Corrupt file",
        }),
      ).toBe(true);
    });

    it("should mark audio format issues as non-critical (convertible)", () => {
      expect(
        isFormatIssueCritical({
          type: "bitDepth",
          message: "Wrong bit depth",
        }),
      ).toBe(false);

      expect(
        isFormatIssueCritical({
          type: "sampleRate",
          message: "Wrong sample rate",
        }),
      ).toBe(false);

      expect(
        isFormatIssueCritical({
          type: "channels",
          message: "Too many channels",
        }),
      ).toBe(false);
    });
  });
});

/**
 * Helper function to create a valid WAV header for testing
 */
function createValidWavHeader(config: {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
}): Buffer {
  const buffer = Buffer.alloc(44);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36, 4); // File size - 8
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(config.audioFormat, 20);
  buffer.writeUInt16LE(config.channels, 22);
  buffer.writeUInt32LE(config.sampleRate, 24);

  const bytesPerSecond =
    config.sampleRate * config.channels * (config.bitsPerSample / 8);
  buffer.writeUInt32LE(bytesPerSecond, 28);

  const blockAlign = config.channels * (config.bitsPerSample / 8);
  buffer.writeUInt16LE(blockAlign, 32);

  buffer.writeUInt16LE(config.bitsPerSample, 34);

  // data chunk header (but no actual data)
  buffer.write("data", 36);
  buffer.writeUInt32LE(0, 40); // data size = 0

  return buffer;
}

/**
 * Helper function to create a valid WAV header with data chunk
 */
function createValidWavHeaderWithData(config: {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataSize: number;
}): Buffer {
  const headerSize = 44;
  const buffer = Buffer.alloc(headerSize + config.dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + config.dataSize, 4); // File size - 8
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(config.audioFormat, 20);
  buffer.writeUInt16LE(config.channels, 22);
  buffer.writeUInt32LE(config.sampleRate, 24);

  const bytesPerSecond =
    config.sampleRate * config.channels * (config.bitsPerSample / 8);
  buffer.writeUInt32LE(bytesPerSecond, 28);

  const blockAlign = config.channels * (config.bitsPerSample / 8);
  buffer.writeUInt16LE(blockAlign, 32);

  buffer.writeUInt16LE(config.bitsPerSample, 34);

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(config.dataSize, 40);

  // Fill data section with zeros (silence)
  buffer.fill(0, headerSize);

  return buffer;
}

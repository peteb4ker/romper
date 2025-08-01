import * as fs from "fs";
import * as wav from "node-wav";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAudioMetadata, RAMPLE_FORMAT_REQUIREMENTS } from "../audioUtils";
import {
  type ConversionOptions,
  convertSampleToRampleFormat,
  convertToRampleDefault,
  getRequiredConversionOptions,
} from "../formatConverter";

// Mock dependencies
vi.mock("fs");
vi.mock("node-wav");
vi.mock("path");
vi.mock("../audioUtils");

const mockFs = vi.mocked(fs);
const mockWav = vi.mocked(wav);
const mockPath = vi.mocked(path);
const mockGetAudioMetadata = vi.mocked(getAudioMetadata);

describe("formatConverter", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock RAMPLE_FORMAT_REQUIREMENTS
    vi.mocked(RAMPLE_FORMAT_REQUIREMENTS).bitDepths = [16, 24];
    vi.mocked(RAMPLE_FORMAT_REQUIREMENTS).sampleRates = [44100, 48000];
    vi.mocked(RAMPLE_FORMAT_REQUIREMENTS).maxChannels = 2;
  });

  describe("convertSampleToRampleFormat", () => {
    it("returns error when input file does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await convertSampleToRampleFormat(
        "nonexistent.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Input file does not exist");
    });

    it("returns error when audio metadata cannot be read", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: false,
        error: "Invalid audio file",
      });

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to read input file metadata");
    });

    it("returns error when target bit depth is not supported", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 44100, channels: 2 },
      });

      const options: ConversionOptions = { targetBitDepth: 32 };
      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
        options,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Target bit depth 32 not supported");
    });

    it("returns error when target sample rate is not supported", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 44100, channels: 2 },
      });

      const options: ConversionOptions = { targetSampleRate: 96000 };
      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
        options,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Target sample rate 96000 not supported");
    });

    it("successfully converts stereo to mono with forceMonoConversion", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 44100, channels: 2 },
      });

      // Mock WAV decode
      const mockChannelData = [
        new Float32Array([1.0, 0.5, -0.5]),
        new Float32Array([0.5, -0.5, 1.0]),
      ];
      mockWav.decode.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 44100,
      });

      // Mock WAV encode
      const mockEncodedBuffer = Buffer.from("encoded wav data");
      mockWav.encode.mockReturnValue(mockEncodedBuffer);

      // Mock file system operations
      mockFs.readFileSync.mockReturnValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const options: ConversionOptions = { forceMonoConversion: true };
      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data?.convertedFormat.channels).toBe(1);
      expect(mockWav.encode).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          sampleRate: 44100,
          bitDepth: 16,
          float: false,
        }),
      );
    });

    it("converts mono to stereo when target channels is 2", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 44100, channels: 1 },
      });

      const mockChannelData = [new Float32Array([1.0, 0.5, -0.5])];
      mockWav.decode.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 44100,
      });

      mockWav.encode.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.readFileSync.mockReturnValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.statSync.mockReturnValue({ size: 2048 } as any);

      const options: ConversionOptions = { targetChannels: 2 };
      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data?.convertedFormat.channels).toBe(2);
    });

    it("handles sample rate conversion", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 22050, channels: 1 },
      });

      const mockChannelData = [new Float32Array([1.0, 0.5])];
      mockWav.decode.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 22050,
      });

      mockWav.encode.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.readFileSync.mockReturnValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.statSync.mockReturnValue({ size: 1536 } as any);

      const options: ConversionOptions = { targetSampleRate: 44100 };
      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data?.convertedFormat.sampleRate).toBe(44100);
    });

    it("creates output directory if it doesn't exist", async () => {
      mockFs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 44100, channels: 1 },
      });

      const mockChannelData = [new Float32Array([1.0])];
      mockWav.decode.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 44100,
      });

      mockWav.encode.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.readFileSync.mockReturnValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "/output/dir/output.wav",
      );

      expect(mockFs.mkdirSync).toHaveBeenCalledWith("/output/dir", {
        recursive: true,
      });
      expect(result.success).toBe(true);
    });

    it("handles WAV decode failure", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 44100, channels: 1 },
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from("input wav data"));
      mockWav.decode.mockReturnValue(null);

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to decode input WAV file");
    });

    it("handles empty channel data", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 44100, channels: 1 },
      });

      mockFs.readFileSync.mockReturnValue(Buffer.from("input wav data"));
      mockWav.decode.mockReturnValue({ channelData: [], sampleRate: 44100 });

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to decode input WAV file");
    });

    it("handles unexpected errors gracefully", async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error("File system error");
      });

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Audio conversion failed");
    });

    it("pads with silence for missing channels", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 16, sampleRate: 44100, channels: 1 },
      });

      const mockChannelData = [new Float32Array([1.0, 0.5])];
      mockWav.decode.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 44100,
      });

      mockWav.encode.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.readFileSync.mockReturnValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.mkdirSync.mockImplementation(() => {});
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const options: ConversionOptions = { targetChannels: 4 };
      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data?.convertedFormat.channels).toBe(4); // Gets the requested channels, not limited by RAMPLE_FORMAT_REQUIREMENTS
    });
  });

  describe("convertToRampleDefault", () => {
    it("calls convertSampleToRampleFormat with default options", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockGetAudioMetadata.mockReturnValue({
        success: true,
        data: { bitDepth: 24, sampleRate: 48000, channels: 1 },
      });

      const mockChannelData = [new Float32Array([1.0])];
      mockWav.decode.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 48000,
      });

      mockWav.encode.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.readFileSync.mockReturnValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.statSync.mockReturnValue({ size: 1024 } as any);

      const result = await convertToRampleDefault(
        "input.wav",
        "output.wav",
        true,
      );

      expect(result.success).toBe(true);
      expect(result.data?.convertedFormat).toEqual({
        bitDepth: 16,
        sampleRate: 44100,
        channels: 1,
      });
    });
  });

  describe("getRequiredConversionOptions", () => {
    it("returns null when no conversion is needed", () => {
      const metadata = { bitDepth: 16, sampleRate: 44100, channels: 2 };
      const result = getRequiredConversionOptions(metadata);

      expect(result).toBeNull();
    });

    it("suggests conversion for unsupported bit depth", () => {
      const metadata = { bitDepth: 32, sampleRate: 44100, channels: 2 };
      const result = getRequiredConversionOptions(metadata);

      expect(result).toEqual({ targetBitDepth: 16 });
    });

    it("suggests conversion for unsupported sample rate", () => {
      const metadata = { bitDepth: 16, sampleRate: 96000, channels: 2 };
      const result = getRequiredConversionOptions(metadata);

      expect(result).toEqual({ targetSampleRate: 44100 });
    });

    it("suggests conversion for too many channels", () => {
      const metadata = { bitDepth: 16, sampleRate: 44100, channels: 6 };
      const result = getRequiredConversionOptions(metadata);

      expect(result).toEqual({ targetChannels: 2 });
    });

    it("suggests mono conversion when forceMonoConversion is true", () => {
      const metadata = { bitDepth: 16, sampleRate: 44100, channels: 2 };
      const result = getRequiredConversionOptions(metadata, true);

      expect(result).toEqual({
        targetChannels: 1,
        forceMonoConversion: true,
      });
    });

    it("combines multiple conversion requirements", () => {
      const metadata = { bitDepth: 32, sampleRate: 96000, channels: 6 };
      const result = getRequiredConversionOptions(metadata);

      expect(result).toEqual({
        targetBitDepth: 16,
        targetSampleRate: 44100,
        targetChannels: 2,
      });
    });

    it("handles missing metadata gracefully", () => {
      const metadata = {};
      const result = getRequiredConversionOptions(metadata);

      expect(result).toBeNull();
    });

    it("handles undefined values in metadata", () => {
      const metadata = {
        bitDepth: undefined,
        sampleRate: undefined,
        channels: undefined,
      };
      const result = getRequiredConversionOptions(metadata);

      expect(result).toBeNull();
    });
  });
});

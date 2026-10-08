import * as fs from "node:fs";
import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAudioMetadataAsync,
  RAMPLE_FORMAT_REQUIREMENTS,
} from "../audioUtils";
import { cardFileHolds } from "../cardFileMatch";
import {
  type ConversionOptions,
  convertSampleToRampleFormat,
  convertToRampleDefault,
} from "../formatConverter";
import { decodeWav, encodeWav } from "../wavCodec";

// Mock dependencies
vi.mock("node:fs", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:fs")>()),
);
vi.mock("node:path", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:path")>()),
);
vi.mock("../audioUtils");
// What the card already holds has its own tests (cardFileMatch)
vi.mock("../cardFileMatch", () => ({ cardFileHolds: vi.fn() }));
// Decoding and encoding have their own tests (wavCodec.test.ts); these
// cover conversion
vi.mock("../wavCodec");

const mockFs = vi.mocked(fs, true);
const mockDecodeWav = vi.mocked(decodeWav);
const mockEncodeWav = vi.mocked(encodeWav);
const mockPath = vi.mocked(path);
const mockGetAudioMetadata = vi.mocked(getAudioMetadataAsync);
const mockCardFileHolds = vi.mocked(cardFileHolds);

describe("formatConverter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCardFileHolds.mockResolvedValue(false);

    // Mock RAMPLE_FORMAT_REQUIREMENTS
    Object.assign(vi.mocked(RAMPLE_FORMAT_REQUIREMENTS), {
      bitDepths: [16, 24],
      maxChannels: 2,
      sampleRates: [44100, 48000],
    });
  });

  describe("convertSampleToRampleFormat", () => {
    it("returns error when input file does not exist", async () => {
      mockFs.promises.access.mockRejectedValue(new Error("ENOENT"));

      const result = await convertSampleToRampleFormat(
        "nonexistent.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Input file does not exist");
    });

    it("returns error when audio metadata cannot be read", async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        error: "Invalid audio file",
        success: false,
      });

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to read input file metadata");
    });

    it("returns error when target bit depth is not supported", async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 2, sampleRate: 44100 },
        success: true,
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
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 2, sampleRate: 44100 },
        success: true,
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
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 2, sampleRate: 44100 },
        success: true,
      });

      // Mock WAV decode
      const mockChannelData = [
        new Float32Array([1.0, 0.5, -0.5]),
        new Float32Array([0.5, -0.5, 1.0]),
      ];
      mockDecodeWav.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 44100,
      });

      // Mock WAV encode
      const mockEncodedBuffer = Buffer.from("encoded wav data");
      mockEncodeWav.mockReturnValue(mockEncodedBuffer);

      // Mock file system operations
      mockFs.promises.readFile.mockResolvedValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      mockFs.promises.writeFile.mockResolvedValue(undefined);
      mockFs.promises.stat.mockResolvedValue({ size: 1024 } as fs.Stats);

      const options: ConversionOptions = { forceMonoConversion: true };
      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data?.convertedFormat.channels).toBe(1);
      expect(mockEncodeWav).toHaveBeenCalledWith(expect.any(Array), 44100, 16);
    });

    it("[UC-34] doesn't write output the file already holds (#650)", async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 24, channels: 1, sampleRate: 44100 },
        success: true,
      });
      mockDecodeWav.mockReturnValue({
        channelData: [new Float32Array([0.5, -0.5])],
        sampleRate: 44100,
      });
      const encoded = Buffer.from("encoded wav data");
      mockEncodeWav.mockReturnValue(encoded);
      mockFs.promises.readFile.mockResolvedValue(Buffer.from("input wav data"));
      mockFs.promises.stat.mockResolvedValue({ size: 1024 } as fs.Stats);
      mockCardFileHolds.mockResolvedValue(true);

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
      );

      expect(result.success).toBe(true);
      expect(mockCardFileHolds).toHaveBeenCalledWith("output.wav", encoded);
      expect(mockFs.promises.writeFile).not.toHaveBeenCalled();
    });

    it("converts mono to stereo when target channels is 2", async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 1, sampleRate: 44100 },
        success: true,
      });

      const mockChannelData = [new Float32Array([1.0, 0.5, -0.5])];
      mockDecodeWav.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 44100,
      });

      mockEncodeWav.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.promises.readFile.mockResolvedValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      mockFs.promises.writeFile.mockResolvedValue(undefined);
      mockFs.promises.stat.mockResolvedValue({ size: 2048 } as fs.Stats);

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
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 1, sampleRate: 22050 },
        success: true,
      });

      const mockChannelData = [new Float32Array([1.0, 0.5])];
      mockDecodeWav.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 22050,
      });

      mockEncodeWav.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.promises.readFile.mockResolvedValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      mockFs.promises.writeFile.mockResolvedValue(undefined);
      mockFs.promises.stat.mockResolvedValue({ size: 1536 } as fs.Stats);

      const options: ConversionOptions = { targetSampleRate: 44100 };
      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data?.convertedFormat.sampleRate).toBe(44100);
    });

    it("creates the output directory", async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 1, sampleRate: 44100 },
        success: true,
      });

      const mockChannelData = [new Float32Array([1.0])];
      mockDecodeWav.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 44100,
      });

      mockEncodeWav.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.promises.readFile.mockResolvedValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.promises.writeFile.mockResolvedValue(undefined);
      mockFs.promises.stat.mockResolvedValue({ size: 1024 } as fs.Stats);

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "/output/dir/output.wav",
      );

      expect(mockFs.promises.mkdir).toHaveBeenCalledWith("/output/dir", {
        recursive: true,
      });
      expect(result.success).toBe(true);
    });

    it("handles WAV decode failure", async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 1, sampleRate: 44100 },
        success: true,
      });

      mockFs.promises.readFile.mockResolvedValue(Buffer.from("input wav data"));
      mockDecodeWav.mockImplementation(() => {
        throw new Error("No fmt chunk");
      });

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Audio conversion failed: No fmt chunk");
    });

    it("handles empty channel data", async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 1, sampleRate: 44100 },
        success: true,
      });

      mockFs.promises.readFile.mockResolvedValue(Buffer.from("input wav data"));
      mockDecodeWav.mockReturnValue({ channelData: [], sampleRate: 44100 });

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to decode input WAV file");
    });

    it("handles unexpected errors gracefully", async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 1, sampleRate: 44100 },
        success: true,
      });
      mockFs.promises.readFile.mockRejectedValue(
        new Error("File system error"),
      );

      const result = await convertSampleToRampleFormat(
        "input.wav",
        "output.wav",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Audio conversion failed");
    });

    it("pads with silence for missing channels", async () => {
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 16, channels: 1, sampleRate: 44100 },
        success: true,
      });

      const mockChannelData = [new Float32Array([1.0, 0.5])];
      mockDecodeWav.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 44100,
      });

      mockEncodeWav.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.promises.readFile.mockResolvedValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      mockFs.promises.writeFile.mockResolvedValue(undefined);
      mockFs.promises.stat.mockResolvedValue({ size: 1024 } as fs.Stats);

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
      mockFs.promises.access.mockResolvedValue(undefined);
      mockGetAudioMetadata.mockResolvedValue({
        data: { bitDepth: 24, channels: 1, sampleRate: 48000 },
        success: true,
      });

      const mockChannelData = [new Float32Array([1.0])];
      mockDecodeWav.mockReturnValue({
        channelData: mockChannelData,
        sampleRate: 48000,
      });

      mockEncodeWav.mockReturnValue(Buffer.from("encoded wav data"));
      mockFs.promises.readFile.mockResolvedValue(Buffer.from("input wav data"));
      mockPath.dirname.mockReturnValue("/output/dir");
      mockFs.promises.writeFile.mockResolvedValue(undefined);
      mockFs.promises.stat.mockResolvedValue({ size: 1024 } as fs.Stats);

      const result = await convertToRampleDefault(
        "input.wav",
        "output.wav",
        true,
      );

      expect(result.success).toBe(true);
      expect(result.data?.convertedFormat).toEqual({
        bitDepth: 16,
        channels: 1,
        sampleRate: 44100,
      });
    });
  });
});

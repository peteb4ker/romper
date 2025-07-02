// Tests for WAV analysis scanner

import { beforeEach, describe, expect, it, vi } from "vitest";

import { scanWAVAnalysis } from "../wavAnalysisScanner";

// Mock node-wav
vi.mock("node-wav", () => ({
  decode: vi.fn(),
}));

import * as wav from "node-wav";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("scanWAVAnalysis", () => {
  it("successfully analyzes a valid WAV file", async () => {
    const mockArrayBuffer = new ArrayBuffer(4);
    const mockView = new Uint8Array(mockArrayBuffer);
    mockView.set([1, 2, 3, 4]);
    const mockFileReader = vi.fn().mockResolvedValue(mockArrayBuffer);
    vi.mocked(wav.decode).mockReturnValue({
      sampleRate: 44100,
      channelData: [new Float32Array(100), new Float32Array(100)], // 2 channels
    });

    const input = {
      filePath: "/path/to/test.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      sampleRate: 44100,
      bitDepth: 16,
      channels: 2,
      bitrate: 1411200, // 44100 * 2 * 16
      isStereo: true,
      isValid: true,
    });

    expect(mockFileReader).toHaveBeenCalledWith("/path/to/test.wav");
    expect(wav.decode).toHaveBeenCalledWith(Buffer.from([1, 2, 3, 4]));
  });

  it("successfully analyzes a mono WAV file", async () => {
    const mockArrayBuffer = new ArrayBuffer(4);
    const mockView = new Uint8Array(mockArrayBuffer);
    mockView.set([1, 2, 3, 4]);
    const mockFileReader = vi.fn().mockResolvedValue(mockArrayBuffer);
    vi.mocked(wav.decode).mockReturnValue({
      sampleRate: 48000,
      channelData: [new Float32Array(100)], // 1 channel
    });

    const input = {
      filePath: "/path/to/mono.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      sampleRate: 48000,
      bitDepth: 16,
      channels: 1,
      bitrate: 768000, // 48000 * 1 * 16
      isStereo: false,
      isValid: true,
    });
  });

  it("uses custom file reader when provided", async () => {
    const customFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(44));
    vi.mocked(wav.decode).mockReturnValue({
      sampleRate: 44100,
      channelData: [new Float32Array(100), new Float32Array(100)],
    });

    const input = {
      filePath: "/path/to/test.wav",
      fileReader: customFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(customFileReader).toHaveBeenCalledWith("/path/to/test.wav");
  });

  it("handles file reading errors", async () => {
    const mockFileReader = vi
      .fn()
      .mockRejectedValue(new Error("File not found"));

    const input = {
      filePath: "/path/to/missing.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("File not found");
  });

  it("handles WAV decoding errors", async () => {
    const mockArrayBuffer = new ArrayBuffer(4);
    const mockView = new Uint8Array(mockArrayBuffer);
    mockView.set([1, 2, 3, 4]);
    const mockFileReader = vi.fn().mockResolvedValue(mockArrayBuffer);
    vi.mocked(wav.decode).mockImplementation(() => {
      throw new Error("Invalid WAV format");
    });

    const input = {
      filePath: "/path/to/invalid.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid WAV format");
    expect(result.data).toBeUndefined();
  });

  it("handles invalid WAV decode result", async () => {
    const mockArrayBuffer = new ArrayBuffer(4);
    const mockView = new Uint8Array(mockArrayBuffer);
    mockView.set([1, 2, 3, 4]);
    const mockFileReader = vi.fn().mockResolvedValue(mockArrayBuffer);
    vi.mocked(wav.decode).mockReturnValue(null);

    const input = {
      filePath: "/path/to/corrupted.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid WAV file: /path/to/corrupted.wav");
  });

  it("handles WAV file with no channel data", async () => {
    const mockArrayBuffer = new ArrayBuffer(4);
    const mockView = new Uint8Array(mockArrayBuffer);
    mockView.set([1, 2, 3, 4]);
    const mockFileReader = vi.fn().mockResolvedValue(mockArrayBuffer);
    vi.mocked(wav.decode).mockReturnValue({
      sampleRate: 44100,
      channelData: [],
    });

    const input = {
      filePath: "/path/to/empty.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid WAV file: /path/to/empty.wav");
  });

  it("handles custom file reader errors", async () => {
    const customFileReader = vi
      .fn()
      .mockRejectedValue(new Error("Custom reader failed"));

    const input = {
      filePath: "/path/to/test.wav",
      fileReader: customFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Custom reader failed");
  });
});

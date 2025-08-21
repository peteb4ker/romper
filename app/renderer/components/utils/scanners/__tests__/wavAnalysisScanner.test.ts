// Tests for WAV analysis scanner - now using IPC calls to main process

import { beforeEach, describe, expect, it, vi } from "vitest";

import { scanWAVAnalysis } from "../wavAnalysisScanner";

// Mock the window.electronAPI
const mockGetAudioMetadata = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // Setup global mock for window.electronAPI
  Object.defineProperty(global, 'window', {
    value: {
      electronAPI: {
        getAudioMetadata: mockGetAudioMetadata,
      },
    },
    writable: true,
  });
});

describe("scanWAVAnalysis", () => {
  it("returns accurate analysis for native Rample format (44.1kHz, 16-bit, mono)", async () => {
    mockGetAudioMetadata.mockResolvedValue({
      data: {
        bitDepth: 16,
        channels: 1,
        duration: 2.5,
        fileSize: 220500,
        sampleRate: 44100,
      },
      success: true,
    });

    const input = {
      filePath: "/path/to/test.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bitDepth: 16,
      bitrate: 705600, // 44100 * 1 * 16
      channels: 1,
      isStereo: false,
      isValid: true,
      sampleRate: 44100,
    });

    expect(mockGetAudioMetadata).toHaveBeenCalledWith("/path/to/test.wav");
  });

  it("returns accurate analysis for stereo files", async () => {
    mockGetAudioMetadata.mockResolvedValue({
      data: {
        bitDepth: 16,
        channels: 2,
        duration: 1.5,
        fileSize: 264600,
        sampleRate: 44100,
      },
      success: true,
    });

    const input = {
      filePath: "/path/to/stereo.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bitDepth: 16,
      bitrate: 1411200, // 44100 * 2 * 16
      channels: 2,
      isStereo: true,
      isValid: true,
      sampleRate: 44100,
    });
  });

  it("handles 24-bit files that need conversion", async () => {
    mockGetAudioMetadata.mockResolvedValue({
      data: {
        bitDepth: 24,
        channels: 1,
        duration: 3.0,
        fileSize: 396900,
        sampleRate: 44100,
      },
      success: true,
    });

    const input = {
      filePath: "/path/to/24bit.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bitDepth: 24,
      bitrate: 1058400, // 44100 * 1 * 24
      channels: 1,
      isStereo: false,
      isValid: true, // Still valid, just needs conversion
      sampleRate: 44100,
    });
  });

  it("handles 48kHz files that need conversion", async () => {
    mockGetAudioMetadata.mockResolvedValue({
      data: {
        bitDepth: 16,
        channels: 2,
        duration: 2.0,
        fileSize: 384000,
        sampleRate: 48000,
      },
      success: true,
    });

    const input = {
      filePath: "/path/to/48khz.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bitDepth: 16,
      bitrate: 1536000, // 48000 * 2 * 16
      channels: 2,
      isStereo: true,
      isValid: true, // Still valid, just needs conversion
      sampleRate: 48000,
    });
  });

  it("marks files with too many channels as invalid", async () => {
    mockGetAudioMetadata.mockResolvedValue({
      data: {
        bitDepth: 16,
        channels: 6, // 5.1 surround
        duration: 1.0,
        fileSize: 529200,
        sampleRate: 44100,
      },
      success: true,
    });

    const input = {
      filePath: "/path/to/surround.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bitDepth: 16,
      bitrate: 4233600, // 44100 * 6 * 16
      channels: 6,
      isStereo: false, // Not stereo (more than 2 channels)
      isValid: false, // Too many channels for Rample
      sampleRate: 44100,
    });
  });

  it("handles IPC API not available", async () => {
    Object.defineProperty(global, 'window', {
      value: {}, // No electronAPI
      writable: true,
    });

    const input = {
      filePath: "/path/to/test.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Audio metadata API not available");
  });

  it("handles main process failure", async () => {
    mockGetAudioMetadata.mockResolvedValue({
      error: "File not found",
      success: false,
    });

    const input = {
      filePath: "/path/to/missing.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("File not found");
  });

  it("handles main process rejection", async () => {
    mockGetAudioMetadata.mockRejectedValue(
      new Error("IPC communication failed"),
    );

    const input = {
      filePath: "/path/to/test.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe("WAV analysis failed: IPC communication failed");
  });

  it("handles incomplete metadata gracefully", async () => {
    mockGetAudioMetadata.mockResolvedValue({
      data: {
        // Missing bitDepth but has other fields
        channels: 1,
        sampleRate: 44100,
      },
      success: true,
    });

    const input = {
      filePath: "/path/to/incomplete.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bitDepth: 16, // Default fallback
      bitrate: 705600, // 44100 * 1 * 16
      channels: 1,
      isStereo: false,
      isValid: false, // Invalid because missing critical metadata (bitDepth)
      sampleRate: 44100,
    });
  });

  it("handles completely missing metadata gracefully", async () => {
    mockGetAudioMetadata.mockResolvedValue({
      data: {}, // Empty metadata
      success: true,
    });

    const input = {
      filePath: "/path/to/empty-metadata.wav",
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bitDepth: 16, // Default fallback
      bitrate: 705600, // Default calculation
      channels: 1, // Default fallback
      isStereo: false,
      isValid: false, // Invalid because missing critical metadata
      sampleRate: 44100, // Default fallback
    });
  });
});

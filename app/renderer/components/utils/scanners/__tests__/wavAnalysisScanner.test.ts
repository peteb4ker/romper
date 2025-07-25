// Tests for WAV analysis scanner
// Note: WAV analysis is currently disabled and returns default values

import { describe, expect, it, vi } from "vitest";

import { scanWAVAnalysis } from "../wavAnalysisScanner";

describe("scanWAVAnalysis", () => {
  it("returns default analysis values (WAV analysis disabled)", async () => {
    const mockFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(4));
    
    const input = {
      filePath: "/path/to/test.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      sampleRate: 44100,
      bitDepth: 16,
      channels: 1,
      bitrate: 705600,
      isStereo: false,
      isValid: true,
    });
    
    // File reader should not be called since analysis is disabled
    expect(mockFileReader).not.toHaveBeenCalled();
  });

  it("returns default analysis values for any file path", async () => {
    const mockFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(4));
    
    const input = {
      filePath: "/path/to/mono.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      sampleRate: 44100,
      bitDepth: 16,
      channels: 1,
      bitrate: 705600,
      isStereo: false,
      isValid: true,
    });
  });

  it("does not use custom file reader (analysis disabled)", async () => {
    const customFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(8));

    const input = {
      filePath: "/path/to/test.wav",
      fileReader: customFileReader,
    };
    const result = await scanWAVAnalysis(input);

    expect(result.success).toBe(true);
    // Custom file reader should not be called since analysis is disabled
    expect(customFileReader).not.toHaveBeenCalled();
  });

  it("succeeds even with file reading errors (analysis disabled)", async () => {
    const failingFileReader = vi.fn().mockRejectedValue(new Error("File not found"));

    const input = {
      filePath: "/path/to/missing.wav",
      fileReader: failingFileReader,
    };
    const result = await scanWAVAnalysis(input);

    // Should succeed with default values since analysis is disabled
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      sampleRate: 44100,
      bitDepth: 16,
      channels: 1,
      bitrate: 705600,
      isStereo: false,
      isValid: true,
    });
  });

  it("succeeds even with WAV decoding errors (analysis disabled)", async () => {
    const mockFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(4));

    const input = {
      filePath: "/path/to/invalid.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    // Should succeed with default values since analysis is disabled
    expect(result.success).toBe(true);
    expect(result.data?.isValid).toBe(true);
  });

  it("succeeds regardless of file content (analysis disabled)", async () => {
    const mockFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(0));

    const input = {
      filePath: "/path/to/corrupted.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    // Should succeed with default values since analysis is disabled
    expect(result.success).toBe(true);
    expect(result.data?.isValid).toBe(true);
  });

  it("handles empty WAV files (analysis disabled)", async () => {
    const mockFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(0));

    const input = {
      filePath: "/path/to/empty.wav",
      fileReader: mockFileReader,
    };
    const result = await scanWAVAnalysis(input);

    // Should succeed with default values since analysis is disabled
    expect(result.success).toBe(true);
    expect(result.data?.isValid).toBe(true);
  });

  it("handles custom file reader errors gracefully (analysis disabled)", async () => {
    const failingFileReader = vi.fn().mockRejectedValue(new Error("Custom reader failed"));

    const input = {
      filePath: "/path/to/test.wav",
      fileReader: failingFileReader,
    };
    const result = await scanWAVAnalysis(input);

    // Should succeed with default values since analysis is disabled
    expect(result.success).toBe(true);
    expect(result.data?.isValid).toBe(true);
  });
});
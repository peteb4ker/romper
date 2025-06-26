// Tests for orchestration functions

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  executeFullKitScan,
  executeRTFArtistScan,
  executeVoiceInferenceScan,
  executeWAVAnalysisScan,
} from "../orchestrationFunctions";
import type { ProgressCallback } from "../types";

// Mock the individual scanner operations
vi.mock("../../scannerOperations", () => ({
  scanVoiceInference: vi.fn(),
  scanWAVAnalysis: vi.fn(),
  scanRTFArtist: vi.fn(),
}));

import {
  scanRTFArtist,
  scanVoiceInference,
  scanWAVAnalysis,
} from "../../scannerOperations";

// Global mock progress callback for all tests
let mockProgressCallback: ProgressCallback;

beforeEach(() => {
  vi.clearAllMocks();
  mockProgressCallback = vi.fn();
});

describe("executeFullKitScan", () => {
  it("executes all scanning operations successfully", async () => {
    vi.mocked(scanVoiceInference).mockReturnValue({
      success: true,
      data: { voiceNames: { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" } },
    });

    vi.mocked(scanWAVAnalysis).mockResolvedValue({
      success: true,
      data: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        bitrate: 1411200,
        isStereo: true,
        isValid: true,
      },
    });

    vi.mocked(scanRTFArtist).mockReturnValue({
      success: true,
      data: { bankArtists: { A: "Artist Name" } },
    });

    const kitData = {
      samples: { 1: ["kick.wav"], 2: ["snare.wav"] },
      wavFiles: ["kick.wav", "snare.wav"],
      rtfFiles: ["A - Artist Name.rtf"],
    };

    const result = await executeFullKitScan(kitData, mockProgressCallback);

    expect(result.success).toBe(true);
    expect(result.results.voiceInference).toEqual({
      voiceNames: { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" },
    });
    expect(result.results.wavAnalysis).toHaveLength(2);
    expect(result.results.rtfArtist).toEqual({
      bankArtists: { A: "Artist Name" },
    });
    expect(result.errors).toEqual([]);
    expect(result.completedOperations).toBe(3);
  });

  it("handles partial failures with continue strategy", async () => {
    vi.mocked(scanVoiceInference).mockReturnValue({
      success: false,
      error: "Voice inference failed",
    });

    vi.mocked(scanWAVAnalysis).mockResolvedValue({
      success: true,
      data: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        bitrate: 1411200,
        isStereo: true,
        isValid: true,
      },
    });

    vi.mocked(scanRTFArtist).mockReturnValue({
      success: true,
      data: { bankArtists: { A: "Artist Name" } },
    });

    const kitData = {
      samples: { 1: ["kick.wav"] },
      wavFiles: ["kick.wav"],
      rtfFiles: ["A - Artist Name.rtf"],
    };

    const result = await executeFullKitScan(
      kitData,
      mockProgressCallback,
      "continue",
    );

    expect(result.success).toBe(false);
    expect(result.results.voiceInference).toBeUndefined();
    expect(result.results.wavAnalysis).toHaveLength(1);
    expect(result.results.rtfArtist).toEqual({
      bankArtists: { A: "Artist Name" },
    });
    expect(result.errors).toEqual([
      { operation: "voiceInference", error: "Voice inference failed" },
    ]);
    expect(result.completedOperations).toBe(2);
  });

  it("handles WAV analysis failures gracefully", async () => {
    vi.mocked(scanVoiceInference).mockReturnValue({
      success: true,
      data: { voiceNames: { 1: "Kick" } },
    });

    vi.mocked(scanWAVAnalysis)
      .mockResolvedValueOnce({
        success: true,
        data: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          bitrate: 1411200,
          isStereo: true,
          isValid: true,
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: "Invalid WAV format",
      });

    vi.mocked(scanRTFArtist).mockReturnValue({
      success: true,
      data: { bankArtists: { A: "Artist Name" } },
    });

    const kitData = {
      samples: { 1: ["kick.wav"] },
      wavFiles: ["kick.wav", "invalid.wav"],
      rtfFiles: ["A - Artist Name.rtf"],
    };

    const result = await executeFullKitScan(kitData, mockProgressCallback);

    expect(result.success).toBe(false);
    expect(result.results.voiceInference).toEqual({
      voiceNames: { 1: "Kick" },
    });
    expect(result.results.wavAnalysis).toBeUndefined();
    expect(result.results.rtfArtist).toEqual({
      bankArtists: { A: "Artist Name" },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].operation).toBe("wavAnalysis");
  });

  it("passes custom file reader to WAV analysis", async () => {
    const customFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(44));

    vi.mocked(scanVoiceInference).mockReturnValue({
      success: true,
      data: { voiceNames: { 1: "Kick" } },
    });

    vi.mocked(scanWAVAnalysis).mockResolvedValue({
      success: true,
      data: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        bitrate: 1411200,
        isStereo: true,
        isValid: true,
      },
    });

    vi.mocked(scanRTFArtist).mockReturnValue({
      success: true,
      data: { bankArtists: {} },
    });

    const kitData = {
      samples: { 1: ["kick.wav"] },
      wavFiles: ["kick.wav"],
      rtfFiles: [],
      fileReader: customFileReader,
    };

    await executeFullKitScan(kitData);

    expect(vi.mocked(scanWAVAnalysis)).toHaveBeenCalledWith({
      filePath: "kick.wav",
      fileReader: customFileReader,
    });
  });

  it("handles empty kit data", async () => {
    vi.mocked(scanVoiceInference).mockReturnValue({
      success: false,
      error: "No voice types could be inferred from filenames",
    });

    vi.mocked(scanRTFArtist).mockReturnValue({
      success: false,
      error: "No valid RTF files found",
    });

    const kitData = {
      samples: {},
      wavFiles: [],
      rtfFiles: [],
    };

    const result = await executeFullKitScan(
      kitData,
      mockProgressCallback,
      "stop",
    );

    expect(result.success).toBe(false);
    expect(result.completedOperations).toBe(0); // Should stop at first failure
  });
});

describe("executeVoiceInferenceScan", () => {
  it("executes voice inference successfully", async () => {
    vi.mocked(scanVoiceInference).mockReturnValue({
      success: true,
      data: { voiceNames: { 1: "Kick", 2: "Snare" } },
    });

    const samples = { 1: ["kick.wav"], 2: ["snare.wav"] };
    const result = await executeVoiceInferenceScan(
      samples,
      mockProgressCallback,
    );

    expect(result.success).toBe(true);
    expect(result.results.voiceInference).toEqual({
      voiceNames: { 1: "Kick", 2: "Snare" },
    });
    expect(result.errors).toEqual([]);
    expect(result.completedOperations).toBe(1);
  });

  it("handles voice inference failure", async () => {
    vi.mocked(scanVoiceInference).mockReturnValue({
      success: false,
      error: "Voice inference failed",
    });

    const samples = { 1: ["kick.wav"] };
    const result = await executeVoiceInferenceScan(
      samples,
      mockProgressCallback,
    );

    expect(result.success).toBe(false);
    expect(result.results.voiceInference).toBeUndefined();
    expect(result.errors).toEqual([
      { operation: "voiceInference", error: "Voice inference failed" },
    ]);
    expect(result.completedOperations).toBe(0);
  });
});

describe("executeWAVAnalysisScan", () => {
  it("analyzes multiple WAV files successfully", async () => {
    vi.mocked(scanWAVAnalysis)
      .mockResolvedValueOnce({
        success: true,
        data: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          bitrate: 1411200,
          isStereo: true,
          isValid: true,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          sampleRate: 48000,
          bitDepth: 24,
          channels: 1,
          bitrate: 1152000,
          isStereo: false,
          isValid: true,
        },
      });

    const wavFiles = ["kick.wav", "snare.wav"];
    const result = await executeWAVAnalysisScan(
      wavFiles,
      undefined,
      mockProgressCallback,
    );

    expect(result.success).toBe(true);
    expect(result.results.wavAnalysis).toHaveLength(2);
    expect(result.results.wavAnalysis![0].sampleRate).toBe(44100);
    expect(result.results.wavAnalysis![1].sampleRate).toBe(48000);
    expect(result.errors).toEqual([]);
  });

  it("handles partial WAV analysis failures", async () => {
    vi.mocked(scanWAVAnalysis)
      .mockResolvedValueOnce({
        success: true,
        data: {
          sampleRate: 44100,
          bitDepth: 16,
          channels: 2,
          bitrate: 1411200,
          isStereo: true,
          isValid: true,
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: "Invalid WAV format",
      });

    const wavFiles = ["kick.wav", "invalid.wav"];
    const result = await executeWAVAnalysisScan(
      wavFiles,
      undefined,
      mockProgressCallback,
    );

    expect(result.success).toBe(true); // Success because at least one file was analyzed
    expect(result.results.wavAnalysis).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it("handles complete WAV analysis failure", async () => {
    vi.mocked(scanWAVAnalysis).mockResolvedValue({
      success: false,
      error: "Invalid WAV format",
    });

    const wavFiles = ["invalid1.wav", "invalid2.wav"];
    const result = await executeWAVAnalysisScan(
      wavFiles,
      undefined,
      mockProgressCallback,
    );

    expect(result.success).toBe(false);
    expect(result.results.wavAnalysis).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].operation).toBe("wavAnalysis");
  });

  it("passes custom file reader to individual WAV analyses", async () => {
    const customFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(44));

    vi.mocked(scanWAVAnalysis).mockResolvedValue({
      success: true,
      data: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 2,
        bitrate: 1411200,
        isStereo: true,
        isValid: true,
      },
    });

    const wavFiles = ["kick.wav"];
    await executeWAVAnalysisScan(wavFiles, customFileReader);

    expect(vi.mocked(scanWAVAnalysis)).toHaveBeenCalledWith({
      filePath: "kick.wav",
      fileReader: customFileReader,
    });
  });

  it("handles empty WAV files array", async () => {
    const result = await executeWAVAnalysisScan(
      [],
      undefined,
      mockProgressCallback,
    );

    expect(result.success).toBe(false);
    expect(result.results.wavAnalysis).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].operation).toBe("wavAnalysis");
    expect(result.errors[0].error).toContain("failed for all files");
  });
});

describe("executeRTFArtistScan", () => {
  it("executes RTF artist scan successfully", async () => {
    vi.mocked(scanRTFArtist).mockReturnValue({
      success: true,
      data: { bankArtists: { A: "Artist One", B: "Artist Two" } },
    });

    const rtfFiles = ["A - Artist One.rtf", "B - Artist Two.rtf"];
    const result = await executeRTFArtistScan(rtfFiles, mockProgressCallback);

    expect(result.success).toBe(true);
    expect(result.results.rtfArtist).toEqual({
      bankArtists: { A: "Artist One", B: "Artist Two" },
    });
    expect(result.errors).toEqual([]);
    expect(result.completedOperations).toBe(1);
  });

  it("handles RTF artist scan failure", async () => {
    vi.mocked(scanRTFArtist).mockReturnValue({
      success: false,
      error: "No valid RTF files found",
    });

    const rtfFiles = ["invalid.txt"];
    const result = await executeRTFArtistScan(rtfFiles, mockProgressCallback);

    expect(result.success).toBe(false);
    expect(result.results.rtfArtist).toBeUndefined();
    expect(result.errors).toEqual([
      { operation: "rtfArtist", error: "No valid RTF files found" },
    ]);
    expect(result.completedOperations).toBe(0);
  });

  it("handles empty RTF files array", async () => {
    vi.mocked(scanRTFArtist).mockReturnValue({
      success: false,
      error: "No valid RTF files found",
    });

    const result = await executeRTFArtistScan([], mockProgressCallback);

    expect(result.success).toBe(false);
    expect(result.results.rtfArtist).toBeUndefined();
    expect(result.errors).toHaveLength(1);
  });
});

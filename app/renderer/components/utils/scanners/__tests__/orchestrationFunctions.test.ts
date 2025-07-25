// Tests for orchestration functions

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  executeFullKitScan,
  executeVoiceInferenceScan,
  executeWAVAnalysisScan,
} from "../orchestrationFunctions";
import type { ProgressCallback } from "../types";

// Mock the individual scanner operations
vi.mock("../../scannerOperations", () => ({
  scanVoiceInference: vi.fn(),
  scanWAVAnalysis: vi.fn(),
}));

import { scanVoiceInference, scanWAVAnalysis } from "../../scannerOperations";

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

    const kitData = {
      samples: { 1: ["kick.wav"], 2: ["snare.wav"] },
      wavFiles: ["kick.wav", "snare.wav"],
      fileReader: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    };

    const result = await executeFullKitScan(kitData, mockProgressCallback);

    expect(result.success).toBe(true);
    expect(result.results?.voiceInference).toEqual({
      voiceNames: { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" },
    });
    expect(result.completedOperations).toBe(2);
    expect(result.totalOperations).toBe(2);
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

    const kitData = {
      samples: { 1: ["kick.wav"], 2: ["snare.wav"] },
      wavFiles: ["kick.wav", "snare.wav"],
      fileReader: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    };

    const result = await executeFullKitScan(kitData, mockProgressCallback);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].operation).toBe("voiceInference");
    expect(result.completedOperations).toBe(1);
  });

  it("calls progress callback for each operation", async () => {
    vi.mocked(scanVoiceInference).mockReturnValue({
      success: true,
      data: { voiceNames: { 1: "Kick", 2: "Snare" } },
    });

    vi.mocked(scanWAVAnalysis).mockResolvedValue({
      success: true,
      data: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 1,
        bitrate: 705600,
        isStereo: false,
        isValid: true,
      },
    });

    const kitData = {
      samples: { 1: ["kick.wav"], 2: ["snare.wav"] },
      wavFiles: ["kick.wav", "snare.wav"],
      fileReader: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    };

    await executeFullKitScan(kitData, mockProgressCallback);

    // Should be called for each operation at least once, plus once for initialization
    expect(mockProgressCallback).toHaveBeenCalledTimes(3);
  });
});

// Test individual scan operations
describe("executeVoiceInferenceScan", () => {
  it("executes only voice inference operation", async () => {
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
    expect(result.completedOperations).toBe(1);
    expect(result.totalOperations).toBe(1);
    expect(scanVoiceInference).toHaveBeenCalledTimes(1);
    expect(scanVoiceInference).toHaveBeenCalledWith({ samples });
    expect(scanWAVAnalysis).not.toHaveBeenCalled();
  });

  it("handles failures correctly", async () => {
    vi.mocked(scanVoiceInference).mockReturnValue({
      success: false,
      error: "Voice inference failed",
    });

    const samples = { 1: ["kick.wav"], 2: ["snare.wav"] };

    const result = await executeVoiceInferenceScan(samples);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].operation).toBe("voiceInference");
    expect(result.completedOperations).toBe(0);
  });
});

describe("executeWAVAnalysisScan", () => {
  it("executes only WAV analysis operation", async () => {
    vi.mocked(scanWAVAnalysis).mockResolvedValue({
      success: true,
      data: {
        sampleRate: 44100,
        bitDepth: 16,
        channels: 1,
        bitrate: 705600,
        isStereo: false,
        isValid: true,
      },
    });

    const wavFiles = ["kick.wav", "snare.wav"];
    const fileReader = vi.fn().mockResolvedValue(new ArrayBuffer(10));

    const result = await executeWAVAnalysisScan(
      wavFiles,
      fileReader,
      mockProgressCallback,
    );

    expect(result.success).toBe(true);
    expect(result.completedOperations).toBe(1);
    expect(result.totalOperations).toBe(1);
    expect(scanVoiceInference).not.toHaveBeenCalled();
  });

  it("handles file reader errors", async () => {
    const wavFiles = ["kick.wav", "snare.wav"];
    const fileReader = vi.fn().mockRejectedValue(new Error("File read error"));

    const result = await executeWAVAnalysisScan(wavFiles, fileReader);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].operation).toBe("wavAnalysis");
  });
});

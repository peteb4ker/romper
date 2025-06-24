import { describe, expect, it, vi } from "vitest";

import {
  ScannerOrchestrator,
  scanRTFArtist,
  scanVoiceInference,
} from "../scannerOrchestrator";

// Mock file system operations
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

describe("scannerOrchestrator", () => {
  describe("scanVoiceInference", () => {
    it("should extract voice names from sample data", () => {
      const input = {
        samples: {
          1: ["/path/to/kick.wav"],
          2: ["/path/to/snare.wav"],
          3: ["/path/to/hihat.wav"],
        },
      };

      const result = scanVoiceInference(input);

      expect(result.success).toBe(true);
      expect(result.data?.voiceNames).toEqual({
        1: "Kick",
        2: "Snare",
        3: "HH", // hihat gets converted to "HH"
        4: null, // voice 4 not provided
      });
    });

    it("should handle empty sample data", () => {
      const input = { samples: {} };

      const result = scanVoiceInference(input);

      expect(result.success).toBe(true);
      expect(result.data?.voiceNames).toEqual({
        1: null,
        2: null,
        3: null,
        4: null,
      });
    });
  });

  describe("scanRTFArtist", () => {
    it("should return empty metadata when no RTF files present", () => {
      const input = { files: [] };

      const result = scanRTFArtist(input);

      expect(result.success).toBe(true);
      expect(result.data?.bankArtists).toEqual({});
    });

    it("should handle invalid file names gracefully", () => {
      const input = { files: ["not-an-rtf.txt", "invalid-format.rtf"] };

      const result = scanRTFArtist(input);

      expect(result.success).toBe(true);
      expect(result.data?.bankArtists).toEqual({});
    });
  });

  describe("ScannerOrchestrator", () => {
    it("should create an orchestrator instance", () => {
      const orchestrator = new ScannerOrchestrator();
      expect(orchestrator).toBeInstanceOf(ScannerOrchestrator);
    });

    it("should create an orchestrator with progress callback", () => {
      const progressCallback = vi.fn();
      const orchestrator = new ScannerOrchestrator(progressCallback);
      expect(orchestrator).toBeInstanceOf(ScannerOrchestrator);
    });
  });
});

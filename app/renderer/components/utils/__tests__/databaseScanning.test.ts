// Tests for database-backed scanning operations

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type KitScanData,
  scanKitToDatabase,
  scanMultipleKitsToDatabase,
  scanVoiceNamesToDatabase,
  scanWavFilesToDatabase,
  setDatabaseOperations,
} from "../databaseScanning";

// Mock the scanner orchestrator
vi.mock("../scanners", () => ({
  executeFullKitScan: vi.fn(),
  executeVoiceInferenceScan: vi.fn(),
  executeWAVAnalysisScan: vi.fn(),
}));

import {
  executeFullKitScan,
  executeVoiceInferenceScan,
  executeWAVAnalysisScan,
} from "../scanners";

describe("databaseScanning", () => {
  // Mock database operations
  const mockDbOps = {
    updateVoiceAlias: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up mock database operations
    setDatabaseOperations(mockDbOps);
  });

  describe("scanKitToDatabase", () => {
    const mockKitData: KitScanData = {
      kitId: 1,
      kitName: "Test Kit",
      kitPath: "/path/to/kit",
      samples: { 1: ["kick.wav"], 2: ["snare.wav"] },
      wavFiles: ["kick.wav", "snare.wav"],
      rtfFiles: ["A - Artist Name.rtf"],
    };

    it("successfully scans kit and stores results in database", async () => {
      // Mock successful orchestration
      vi.mocked(executeFullKitScan).mockResolvedValue({
        success: true,
        results: {
          voiceInference: {
            voiceNames: { 1: "Kick", 2: "Snare" },
          },
          wavAnalysis: [
            {
              sampleRate: 44100,
              bitDepth: 16,
              channels: 2,
              bitrate: 1411200,
              isStereo: true,
              isValid: true,
            },
            {
              sampleRate: 44100,
              bitDepth: 16,
              channels: 1,
              bitrate: 705600,
              isStereo: false,
              isValid: true,
            },
          ],
          rtfArtist: {
            bankArtists: { A: "Artist Name" },
          },
        },
        errors: [],
        completedOperations: 3,
        totalOperations: 3,
      });

      // Mock successful database updates
      mockDbOps.updateVoiceAlias.mockResolvedValue({ success: true });

      const result = await scanKitToDatabase("/mock/db", mockKitData);

      expect(result.success).toBe(true);
      expect(result.scannedKits).toBe(1);
      expect(result.scannedVoices).toBe(2);
      expect(result.scannedWavFiles).toBe(2);
      expect(result.scannedRtfFiles).toBe(0); // RTF scanning removed
      expect(result.errors).toEqual([]);

      // Check that voice aliases were updated
      expect(mockDbOps.updateVoiceAlias).toHaveBeenCalledWith(
        "/mock/db",
        "Test Kit",
        1,
        "Kick",
      );
      expect(mockDbOps.updateVoiceAlias).toHaveBeenCalledWith(
        "/mock/db",
        "Test Kit",
        2,
        "Snare",
      );
    });

    it("handles partial scanning failures gracefully", async () => {
      // Mock orchestration with partial failure
      vi.mocked(executeFullKitScan).mockResolvedValue({
        success: false,
        results: {
          voiceInference: {
            voiceNames: { 1: "Kick" },
          },
          // WAV analysis failed
          rtfArtist: {
            bankArtists: { A: "Artist Name" },
          },
        },
        errors: [{ operation: "wavAnalysis", error: "WAV analysis failed" }],
        completedOperations: 2,
        totalOperations: 3,
      });

      // Mock successful database update
      mockDbOps.updateVoiceAlias.mockResolvedValue({ success: true });

      const result = await scanKitToDatabase("/mock/db", mockKitData);

      expect(result.success).toBe(false);
      expect(result.scannedKits).toBe(0); // Kit not fully scanned due to WAV analysis failure
      expect(result.scannedVoices).toBe(1);
      expect(result.scannedWavFiles).toBe(0);
      expect(result.scannedRtfFiles).toBe(0); // RTF scanning removed
      expect(result.errors).toContainEqual({
        operation: "wavAnalysis",
        error: "WAV analysis failed",
      });

      // Only one voice should have been updated
      expect(mockDbOps.updateVoiceAlias).toHaveBeenCalledTimes(1);
      expect(mockDbOps.updateVoiceAlias).toHaveBeenCalledWith(
        "/mock/db",
        "Test Kit",
        1,
        "Kick",
      );
    });

    it("handles database update failures", async () => {
      // Mock successful orchestration
      vi.mocked(executeFullKitScan).mockResolvedValue({
        success: true,
        results: {
          voiceInference: {
            voiceNames: { 1: "Kick", 2: "Snare" },
          },
        },
        errors: [],
        completedOperations: 1,
        totalOperations: 1,
      });

      // Mock database failures
      mockDbOps.updateVoiceAlias
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: "Database error" });

      const result = await scanKitToDatabase("/mock/db", mockKitData);

      expect(result.success).toBe(false);
      expect(result.scannedVoices).toBe(1);
      expect(result.errors).toContainEqual({
        operation: "voice-2",
        error: "Database error",
      });
    });

    it("handles unexpected exceptions", async () => {
      // Mock orchestration throwing an exception
      vi.mocked(executeFullKitScan).mockRejectedValue(
        new Error("Unexpected error"),
      );

      const result = await scanKitToDatabase("/mock/db", mockKitData);

      expect(result.success).toBe(false);
      expect(result.scannedKits).toBe(0);
      expect(result.errors).toContainEqual({
        operation: "kit-scan",
        error: "Unexpected error",
      });
    });

    it("calls progress callback if provided", async () => {
      const mockProgressCallback = vi.fn();

      vi.mocked(executeFullKitScan).mockResolvedValue({
        success: true,
        results: {},
        errors: [],
        completedOperations: 0,
        totalOperations: 0,
      });

      await scanKitToDatabase("/mock/db", mockKitData, mockProgressCallback);

      expect(executeFullKitScan).toHaveBeenCalledWith(
        expect.any(Object),
        mockProgressCallback,
        "continue",
      );
    });
  });

  describe("scanMultipleKitsToDatabase", () => {
    const mockKitData1: KitScanData = {
      kitId: 1,
      kitName: "Kit 1",
      kitPath: "/path/to/kit1",
      samples: { 1: ["kick1.wav"] },
      wavFiles: ["kick1.wav"],
      rtfFiles: [],
    };

    const mockKitData2: KitScanData = {
      kitId: 2,
      kitName: "Kit 2",
      kitPath: "/path/to/kit2",
      samples: { 1: ["kick2.wav"] },
      wavFiles: ["kick2.wav"],
      rtfFiles: [],
    };

    it("scans multiple kits and combines results", async () => {
      // Mock successful orchestration for each kit
      vi.mocked(executeFullKitScan).mockResolvedValue({
        success: true,
        results: {
          voiceInference: { voiceNames: { 1: "Kick" } },
        },
        errors: [],
        completedOperations: 1,
        totalOperations: 1,
      });

      mockDbOps.updateVoiceAlias.mockResolvedValue({ success: true });

      const mockProgressCallback = vi.fn();
      const result = await scanMultipleKitsToDatabase(
        "/mock/db",
        [mockKitData1, mockKitData2],
        mockProgressCallback,
      );

      expect(result.success).toBe(true);
      expect(result.scannedKits).toBe(2);
      expect(result.scannedVoices).toBe(2);
      expect(result.errors).toEqual([]);

      // Check progress callbacks
      expect(mockProgressCallback).toHaveBeenCalledWith(
        0,
        2,
        "Scanning kit Kit 1",
      );
      expect(mockProgressCallback).toHaveBeenCalledWith(
        1,
        2,
        "Scanning kit Kit 2",
      );
      expect(mockProgressCallback).toHaveBeenCalledWith(
        2,
        2,
        "Scanning complete",
      );
    });

    it("handles partial failures across multiple kits", async () => {
      // Mock first kit success, second kit failure
      vi.mocked(executeFullKitScan)
        .mockResolvedValueOnce({
          success: true,
          results: { voiceInference: { voiceNames: { 1: "Kick" } } },
          errors: [],
          completedOperations: 1,
          totalOperations: 1,
        })
        .mockResolvedValueOnce({
          success: false,
          results: {},
          errors: [
            { operation: "voiceInference", error: "Failed to infer voices" },
          ],
          completedOperations: 0,
          totalOperations: 1,
        });

      mockDbOps.updateVoiceAlias.mockResolvedValue({ success: true });

      const result = await scanMultipleKitsToDatabase("/mock/db", [
        mockKitData1,
        mockKitData2,
      ]);

      expect(result.success).toBe(false);
      expect(result.scannedKits).toBe(1); // Only first kit succeeded
      expect(result.scannedVoices).toBe(1);
      expect(result.errors).toContainEqual({
        operation: "voiceInference",
        error: "Failed to infer voices",
      });
    });
  });

  describe("scanVoiceNamesToDatabase", () => {
    it("scans voice names and updates database", async () => {
      vi.mocked(executeVoiceInferenceScan).mockResolvedValue({
        success: true,
        results: {
          voiceInference: { voiceNames: { 1: "Kick", 2: "Snare", 3: "Hat" } },
        },
        errors: [],
        completedOperations: 1,
        totalOperations: 1,
      });

      mockDbOps.updateVoiceAlias.mockResolvedValue({ success: true });

      const samples = { 1: ["kick.wav"], 2: ["snare.wav"], 3: ["hat.wav"] };
      const result = await scanVoiceNamesToDatabase("/mock/db", 1, samples);

      expect(result.success).toBe(true);
      expect(result.scannedVoices).toBe(3);
      expect(result.errors).toEqual([]);

      expect(mockDbOps.updateVoiceAlias).toHaveBeenCalledWith(
        "/mock/db",
        1,
        1,
        "Kick",
      );
      expect(mockDbOps.updateVoiceAlias).toHaveBeenCalledWith(
        "/mock/db",
        1,
        2,
        "Snare",
      );
      expect(mockDbOps.updateVoiceAlias).toHaveBeenCalledWith(
        "/mock/db",
        1,
        3,
        "Hat",
      );
    });

    it("handles voice inference failure", async () => {
      vi.mocked(executeVoiceInferenceScan).mockResolvedValue({
        success: false,
        results: {},
        errors: [
          { operation: "voiceInference", error: "No recognizable voices" },
        ],
        completedOperations: 0,
        totalOperations: 1,
      });

      const result = await scanVoiceNamesToDatabase("/mock/db", 1, {});

      expect(result.success).toBe(false);
      expect(result.scannedVoices).toBe(0);
      expect(result.errors).toContainEqual({
        operation: "voiceInference",
        error: "No recognizable voices",
      });
    });
  });

  describe("scanWavFilesToDatabase", () => {
    it("scans WAV files successfully", async () => {
      vi.mocked(executeWAVAnalysisScan).mockResolvedValue({
        success: true,
        results: {
          wavAnalysis: [
            {
              sampleRate: 44100,
              bitDepth: 16,
              channels: 2,
              bitrate: 1411200,
              isStereo: true,
              isValid: true,
            },
            {
              sampleRate: 48000,
              bitDepth: 24,
              channels: 1,
              bitrate: 1152000,
              isStereo: false,
              isValid: true,
            },
          ],
        },
        errors: [],
        completedOperations: 1,
        totalOperations: 1,
      });

      const wavFiles = ["kick.wav", "snare.wav"];
      const result = await scanWavFilesToDatabase("/mock/db", wavFiles);

      expect(result.success).toBe(true);
      expect(result.scannedWavFiles).toBe(2);
      expect(result.errors).toEqual([]);
    });

    it("handles WAV analysis failure", async () => {
      vi.mocked(executeWAVAnalysisScan).mockResolvedValue({
        success: false,
        results: {},
        errors: [{ operation: "wavAnalysis", error: "Invalid WAV format" }],
        completedOperations: 0,
        totalOperations: 1,
      });

      const result = await scanWavFilesToDatabase("/mock/db", ["invalid.wav"]);

      expect(result.success).toBe(false);
      expect(result.scannedWavFiles).toBe(0);
      expect(result.errors).toContainEqual({
        operation: "wavAnalysis",
        error: "Invalid WAV format",
      });
    });
  });

  // RTF scanning tests removed - functionality moved to bank scanning system
});

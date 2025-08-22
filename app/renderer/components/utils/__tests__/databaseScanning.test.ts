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

    // Mock window.electronAPI for WAV metadata processing
    Object.defineProperty(window, "electronAPI", {
      value: {
        getAllSamplesForKit: vi.fn().mockResolvedValue({
          data: [
            { filename: "kick.wav", id: 1, source_path: "kick.wav" },
            { filename: "snare.wav", id: 2, source_path: "snare.wav" },
          ],
          success: true,
        }),
        updateSampleMetadata: vi.fn().mockResolvedValue({ success: true }),
      },
      writable: true,
    });
  });

  describe("scanKitToDatabase", () => {
    const mockKitData: KitScanData = {
      kitId: 1,
      kitName: "Test Kit",
      kitPath: "/path/to/kit",
      rtfFiles: ["A - Artist Name.rtf"],
      samples: { 1: ["kick.wav"], 2: ["snare.wav"] },
      wavFiles: ["kick.wav", "snare.wav"],
    };

    it("successfully scans kit and stores results in database", async () => {
      // Mock successful orchestration
      vi.mocked(executeFullKitScan).mockResolvedValue({
        completedOperations: 3,
        errors: [],
        results: {
          rtfArtist: {
            bankArtists: { A: "Artist Name" },
          },
          voiceInference: {
            voiceNames: { 1: "Kick", 2: "Snare" },
          },
          wavAnalysis: [
            {
              bitDepth: 16,
              bitrate: 1411200,
              channels: 2,
              isStereo: true,
              isValid: true,
              sampleRate: 44100,
            },
            {
              bitDepth: 16,
              bitrate: 705600,
              channels: 1,
              isStereo: false,
              isValid: true,
              sampleRate: 44100,
            },
          ],
        },
        success: true,
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
        completedOperations: 2,
        errors: [{ error: "WAV analysis failed", operation: "wavAnalysis" }],
        results: {
          // WAV analysis failed
          rtfArtist: {
            bankArtists: { A: "Artist Name" },
          },
          voiceInference: {
            voiceNames: { 1: "Kick" },
          },
        },
        success: false,
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
        error: "WAV analysis failed",
        operation: "wavAnalysis",
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
        completedOperations: 1,
        errors: [],
        results: {
          voiceInference: {
            voiceNames: { 1: "Kick", 2: "Snare" },
          },
        },
        success: true,
        totalOperations: 1,
      });

      // Mock database failures
      mockDbOps.updateVoiceAlias
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ error: "Database error", success: false });

      const result = await scanKitToDatabase("/mock/db", mockKitData);

      expect(result.success).toBe(false);
      expect(result.scannedVoices).toBe(1);
      expect(result.errors).toContainEqual({
        error: "Database error",
        operation: "voice-2",
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
        error: "Unexpected error",
        operation: "kit-scan",
      });
    });

    it("calls progress callback if provided", async () => {
      const mockProgressCallback = vi.fn();

      vi.mocked(executeFullKitScan).mockResolvedValue({
        completedOperations: 0,
        errors: [],
        results: {},
        success: true,
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
      rtfFiles: [],
      samples: { 1: ["kick1.wav"] },
      wavFiles: ["kick1.wav"],
    };

    const mockKitData2: KitScanData = {
      kitId: 2,
      kitName: "Kit 2",
      kitPath: "/path/to/kit2",
      rtfFiles: [],
      samples: { 1: ["kick2.wav"] },
      wavFiles: ["kick2.wav"],
    };

    it("scans multiple kits and combines results", async () => {
      // Mock successful orchestration for each kit
      vi.mocked(executeFullKitScan).mockResolvedValue({
        completedOperations: 1,
        errors: [],
        results: {
          voiceInference: { voiceNames: { 1: "Kick" } },
        },
        success: true,
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
          completedOperations: 1,
          errors: [],
          results: { voiceInference: { voiceNames: { 1: "Kick" } } },
          success: true,
          totalOperations: 1,
        })
        .mockResolvedValueOnce({
          completedOperations: 0,
          errors: [
            { error: "Failed to infer voices", operation: "voiceInference" },
          ],
          results: {},
          success: false,
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
        error: "Failed to infer voices",
        operation: "voiceInference",
      });
    });
  });

  describe("scanVoiceNamesToDatabase", () => {
    it("scans voice names and updates database", async () => {
      vi.mocked(executeVoiceInferenceScan).mockResolvedValue({
        completedOperations: 1,
        errors: [],
        results: {
          voiceInference: { voiceNames: { 1: "Kick", 2: "Snare", 3: "Hat" } },
        },
        success: true,
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
        completedOperations: 0,
        errors: [
          { error: "No recognizable voices", operation: "voiceInference" },
        ],
        results: {},
        success: false,
        totalOperations: 1,
      });

      const result = await scanVoiceNamesToDatabase("/mock/db", 1, {});

      expect(result.success).toBe(false);
      expect(result.scannedVoices).toBe(0);
      expect(result.errors).toContainEqual({
        error: "No recognizable voices",
        operation: "voiceInference",
      });
    });
  });

  describe("scanWavFilesToDatabase", () => {
    it("scans WAV files successfully", async () => {
      vi.mocked(executeWAVAnalysisScan).mockResolvedValue({
        completedOperations: 1,
        errors: [],
        results: {
          wavAnalysis: [
            {
              bitDepth: 16,
              bitrate: 1411200,
              channels: 2,
              isStereo: true,
              isValid: true,
              sampleRate: 44100,
            },
            {
              bitDepth: 24,
              bitrate: 1152000,
              channels: 1,
              isStereo: false,
              isValid: true,
              sampleRate: 48000,
            },
          ],
        },
        success: true,
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
        completedOperations: 0,
        errors: [{ error: "Invalid WAV format", operation: "wavAnalysis" }],
        results: {},
        success: false,
        totalOperations: 1,
      });

      const result = await scanWavFilesToDatabase("/mock/db", ["invalid.wav"]);

      expect(result.success).toBe(false);
      expect(result.scannedWavFiles).toBe(0);
      expect(result.errors).toContainEqual({
        error: "Invalid WAV format",
        operation: "wavAnalysis",
      });
    });

    it("handles WAV files with missing metadata gracefully", async () => {
      vi.mocked(executeWAVAnalysisScan).mockResolvedValue({
        completedOperations: 1,
        errors: [],
        results: {
          wavAnalysis: [
            {
              bitDepth: undefined,
              bitrate: undefined,
              channels: undefined,
              isStereo: false,
              isValid: true,
              sampleRate: undefined,
            },
          ],
        },
        success: true,
        totalOperations: 1,
      });

      const result = await scanWavFilesToDatabase("/mock/db", ["partial.wav"]);

      expect(result.success).toBe(true);
      expect(result.scannedWavFiles).toBe(1);
      expect(result.errors).toEqual([]);
    });

    it("handles mixed valid and invalid WAV files", async () => {
      vi.mocked(executeWAVAnalysisScan).mockResolvedValue({
        completedOperations: 1,
        errors: [],
        results: {
          wavAnalysis: [
            {
              bitDepth: 16,
              bitrate: 1411200,
              channels: 2,
              isStereo: true,
              isValid: true,
              sampleRate: 44100,
            },
            {
              bitDepth: undefined,
              bitrate: undefined,
              channels: undefined,
              isStereo: false,
              isValid: false,
              sampleRate: undefined,
            },
          ],
        },
        success: true,
        totalOperations: 1,
      });

      const result = await scanWavFilesToDatabase("/mock/db", [
        "valid.wav",
        "invalid.wav",
      ]);

      expect(result.success).toBe(true);
      expect(result.scannedWavFiles).toBe(2); // Both files are counted in the analysis results
    });

    it("handles custom file reader for testing", async () => {
      const mockFileReader = vi.fn().mockResolvedValue(new ArrayBuffer(1024));

      vi.mocked(executeWAVAnalysisScan).mockResolvedValue({
        completedOperations: 1,
        errors: [],
        results: {
          wavAnalysis: [
            {
              bitDepth: 16,
              bitrate: 1411200,
              channels: 2,
              isStereo: true,
              isValid: true,
              sampleRate: 44100,
            },
          ],
        },
        success: true,
        totalOperations: 1,
      });

      const result = await scanWavFilesToDatabase(
        "/mock/db",
        ["test.wav"],
        mockFileReader,
      );

      expect(result.success).toBe(true);
      expect(executeWAVAnalysisScan).toHaveBeenCalledWith(
        ["test.wav"],
        mockFileReader,
      );
    });
  });

  describe("WAV processing integration in scanKitToDatabase", () => {
    const mockKitData: KitScanData = {
      kitId: 1,
      kitName: "Test Kit",
      kitPath: "/path/to/kit",
      rtfFiles: [],
      samples: { 1: ["kick.wav"] },
      wavFiles: ["kick.wav"],
    };

    it("processes WAV analysis errors gracefully", async () => {
      // Mock database operations
      Object.defineProperty(window, "electronAPI", {
        value: {
          getAllSamplesForKit: vi.fn().mockResolvedValue({
            data: [{ filename: "kick.wav", id: 1, source_path: "kick.wav" }],
            success: true,
          }),
          updateSampleMetadata: vi.fn().mockResolvedValue({
            error: "Database update failed",
            success: false,
          }),
        },
        writable: true,
      });

      vi.mocked(executeFullKitScan).mockResolvedValue({
        completedOperations: 1,
        errors: [],
        results: {
          wavAnalysis: [
            {
              bitDepth: 16,
              bitrate: 1411200,
              channels: 2,
              isStereo: true,
              isValid: true,
              sampleRate: 44100,
            },
          ],
        },
        success: true,
        totalOperations: 1,
      });

      const result = await scanKitToDatabase("/mock/db", mockKitData);

      expect(result.success).toBe(true);
      expect(result.scannedKits).toBe(1);
      expect(result.errors).toContainEqual({
        error: "Failed to update metadata for kick.wav: Database update failed",
        operation: "wav-kick.wav",
      });
    });

    it("handles missing sample records during WAV processing", async () => {
      // Mock database operations with missing sample
      Object.defineProperty(window, "electronAPI", {
        value: {
          getAllSamplesForKit: vi.fn().mockResolvedValue({
            data: [], // No samples found
            success: true,
          }),
          updateSampleMetadata: vi.fn(),
        },
        writable: true,
      });

      vi.mocked(executeFullKitScan).mockResolvedValue({
        completedOperations: 1,
        errors: [],
        results: {
          wavAnalysis: [
            {
              bitDepth: 16,
              bitrate: 1411200,
              channels: 2,
              isStereo: true,
              isValid: true,
              sampleRate: 44100,
            },
          ],
        },
        success: true,
        totalOperations: 1,
      });

      const result = await scanKitToDatabase("/mock/db", mockKitData);

      expect(result.success).toBe(true);
      expect(result.scannedKits).toBe(1);
      expect(result.errors).toContainEqual({
        error: "Could not find sample record for kick.wav",
        operation: "wav-kick.wav",
      });
    });

    it("handles exception during WAV metadata processing", async () => {
      // Mock database operations that throw
      Object.defineProperty(window, "electronAPI", {
        value: {
          getAllSamplesForKit: vi
            .fn()
            .mockRejectedValue(new Error("Database connection error")),
        },
        writable: true,
      });

      vi.mocked(executeFullKitScan).mockResolvedValue({
        completedOperations: 1,
        errors: [],
        results: {
          wavAnalysis: [
            {
              bitDepth: 16,
              bitrate: 1411200,
              channels: 2,
              isStereo: true,
              isValid: true,
              sampleRate: 44100,
            },
          ],
        },
        success: true,
        totalOperations: 1,
      });

      const result = await scanKitToDatabase("/mock/db", mockKitData);

      expect(result.success).toBe(true);
      expect(result.scannedKits).toBe(1);
      expect(result.errors).toContainEqual({
        error: "Error processing kick.wav: Database connection error",
        operation: "wav-kick.wav",
      });
    });
  });

  // RTF scanning tests removed - functionality moved to bank scanning system
});

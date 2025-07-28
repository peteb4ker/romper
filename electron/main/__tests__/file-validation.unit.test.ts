import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Mock electron module
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock the db operations module
vi.mock("../db/romperDbCoreORM.js", () => ({
  getKitSamples: vi.fn(), // This is the actual function name used in the handler
  addSample: vi.fn(),
  deleteSamples: vi.fn(),
}));

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  openSync: vi.fn(),
  readSync: vi.fn(),
  closeSync: vi.fn(),
}));

import { ipcMain } from "electron";
import { registerDbIpcHandlers } from "../dbIpcHandlers";
import { getKitSamples } from "../db/romperDbCoreORM.js";

const mockFs = vi.mocked(fs);
const mockGetKitSamples = vi.mocked(getKitSamples);

describe("File Validation - Task 5.2.5", () => {
  const mockInMemorySettings = {
    localStorePath: "/test/path",
  };

  let handlers: Record<string, Function> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};

    // Mock ipcMain.handle to capture handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler;
    });

    // Set up default successful mock responses
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ size: 1024 } as any); // WAV files should be larger than 44 bytes
    mockFs.openSync.mockReturnValue(3 as any); // Mock file descriptor
    mockFs.readSync.mockReturnValue(12 as any); // Mock bytes read
    mockFs.closeSync.mockReturnValue(undefined);

    // Register handlers
    registerDbIpcHandlers(mockInMemorySettings);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Enhanced WAV file validation", () => {
    it("validates basic WAV file structure in add-sample-to-slot", async () => {
      const handler = handlers["add-sample-to-slot"];
      
      // Mock a valid WAV file header (RIFF + size + WAVE)
      const validWavHeader = Buffer.from("RIFF\x20\x00\x00\x00WAVE");
      mockFs.readSync.mockImplementation((fd, buffer, offset, length, position) => {
        validWavHeader.copy(buffer as Buffer, offset, 0, Math.min(length, validWavHeader.length));
        return 12;
      });

      const result = await handler(null, "TestKit", 1, 0, "/test/valid.wav");
      
      expect(mockFs.existsSync).toHaveBeenCalledWith("/test/valid.wav");
      expect(mockFs.statSync).toHaveBeenCalledWith("/test/valid.wav");
      expect(mockFs.openSync).toHaveBeenCalledWith("/test/valid.wav", "r");
      expect(mockFs.readSync).toHaveBeenCalled();
      expect(mockFs.closeSync).toHaveBeenCalled();
    });

    it("rejects non-existent files", async () => {
      const handler = handlers["add-sample-to-slot"];
      mockFs.existsSync.mockReturnValue(false);

      const result = await handler(null, "TestKit", 1, 0, "/test/missing.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sample file not found");
    });

    it("rejects non-WAV files by extension", async () => {
      const handler = handlers["add-sample-to-slot"];

      const result = await handler(null, "TestKit", 1, 0, "/test/audio.mp3");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Only WAV files are supported");
    });

    it("rejects files too small to be valid WAV", async () => {
      const handler = handlers["add-sample-to-slot"];
      mockFs.statSync.mockReturnValue({ size: 20 } as any); // Too small for WAV header

      const result = await handler(null, "TestKit", 1, 0, "/test/tiny.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("File too small to be a valid WAV file");
    });

    it("rejects files without RIFF signature", async () => {
      const handler = handlers["add-sample-to-slot"];
      
      // Mock invalid header without RIFF signature
      const invalidHeader = Buffer.from("FAKE\x20\x00\x00\x00WAVE");
      mockFs.readSync.mockImplementation((fd, buffer, offset, length, position) => {
        invalidHeader.copy(buffer as Buffer, offset, 0, Math.min(length, invalidHeader.length));
        return 12;
      });

      const result = await handler(null, "TestKit", 1, 0, "/test/invalid.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid WAV file: missing RIFF signature");
    });

    it("rejects files without WAVE format identifier", async () => {
      const handler = handlers["add-sample-to-slot"];
      
      // Mock header with RIFF but invalid format
      const invalidHeader = Buffer.from("RIFF\x20\x00\x00\x00FAKE");
      mockFs.readSync.mockImplementation((fd, buffer, offset, length, position) => {
        invalidHeader.copy(buffer as Buffer, offset, 0, Math.min(length, invalidHeader.length));
        return 12;
      });

      const result = await handler(null, "TestKit", 1, 0, "/test/invalid.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid WAV file: missing WAVE format identifier");
    });

    it("handles file read errors gracefully", async () => {
      const handler = handlers["add-sample-to-slot"];
      mockFs.openSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = await handler(null, "TestKit", 1, 0, "/test/error.wav");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to validate file: Permission denied");
    });
  });

  describe("Sample source validation", () => {
    it("validates all samples for a kit", async () => {
      const handler = handlers["validate-sample-sources"];
      
      // Mock sample data with source paths
      const mockSamples = [
        { filename: "kick.wav", source_path: "/path/to/kick.wav" },
        { filename: "snare.wav", source_path: "/path/to/snare.wav" },
        { filename: "hihat.wav", source_path: "/path/to/hihat.wav" },
      ];
      
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: mockSamples,
      });

      // Mock valid WAV files
      const validWavHeader = Buffer.from("RIFF\x20\x00\x00\x00WAVE");
      mockFs.readSync.mockImplementation((fd, buffer, offset, length, position) => {
        validWavHeader.copy(buffer as Buffer, offset, 0, Math.min(length, validWavHeader.length));
        return 12;
      });

      const result = await handler(null, "TestKit");

      expect(result.success).toBe(true);
      expect(result.data.totalSamples).toBe(3);
      expect(result.data.validSamples).toBe(3);
      expect(result.data.invalidSamples).toHaveLength(0);
    });

    it("identifies invalid sample sources", async () => {
      const handler = handlers["validate-sample-sources"];
      
      const mockSamples = [
        { filename: "kick.wav", source_path: "/path/to/kick.wav" },
        { filename: "missing.wav", source_path: "/path/to/missing.wav" },
        { filename: "corrupt.wav", source_path: "/path/to/corrupt.wav" },
      ];
      
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: mockSamples,
      });

      // Mock file existence checks
      mockFs.existsSync.mockImplementation((path: string) => {
        return !path.includes("missing.wav"); // missing.wav doesn't exist
      });

      // Mock WAV validation
      const validWavHeader = Buffer.from("RIFF\x20\x00\x00\x00WAVE");
      const invalidWavHeader = Buffer.from("FAKE\x20\x00\x00\x00WAVE");
      
      mockFs.readSync.mockImplementation((fd, buffer, offset, length, position) => {
        // Determine which file is being read based on the current call context
        const pathArg = vi.mocked(mockFs.openSync).mock.calls[vi.mocked(mockFs.openSync).mock.calls.length - 1]?.[0];
        
        if (pathArg?.includes("corrupt.wav")) {
          invalidWavHeader.copy(buffer as Buffer, offset, 0, Math.min(length, invalidWavHeader.length));
        } else {
          validWavHeader.copy(buffer as Buffer, offset, 0, Math.min(length, validWavHeader.length));
        }
        return 12;
      });

      const result = await handler(null, "TestKit");

      expect(result.success).toBe(true);
      expect(result.data.totalSamples).toBe(3);
      expect(result.data.validSamples).toBe(1);
      expect(result.data.invalidSamples).toHaveLength(2);
      
      // Check specific error details
      const missingFile = result.data.invalidSamples.find(s => s.filename === "missing.wav");
      expect(missingFile?.error).toBe("Sample file not found");
      
      const corruptFile = result.data.invalidSamples.find(s => s.filename === "corrupt.wav");
      expect(corruptFile?.error).toBe("Invalid WAV file: missing RIFF signature");
    });

    it("handles database query errors", async () => {
      const handler = handlers["validate-sample-sources"];
      
      mockGetKitSamples.mockReturnValue({
        success: false,
        error: "Database connection failed",
      });

      const result = await handler(null, "TestKit");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    it("handles samples without source_path", async () => {
      const handler = handlers["validate-sample-sources"];
      
      const mockSamples = [
        { filename: "legacy.wav", source_path: null }, // Legacy sample without source_path
        { filename: "new.wav", source_path: "/path/to/new.wav" },
      ];
      
      mockGetKitSamples.mockReturnValue({
        success: true,
        data: mockSamples,
      });

      // Mock valid WAV for the sample with source_path
      const validWavHeader = Buffer.from("RIFF\x20\x00\x00\x00WAVE");
      mockFs.readSync.mockImplementation((fd, buffer, offset, length, position) => {
        validWavHeader.copy(buffer as Buffer, offset, 0, Math.min(length, validWavHeader.length));
        return 12;
      });

      const result = await handler(null, "TestKit");

      expect(result.success).toBe(true);
      expect(result.data.totalSamples).toBe(2);
      expect(result.data.validSamples).toBe(2); // Legacy samples without source_path are still counted as valid (2 total - 0 invalid = 2 valid)
      expect(result.data.invalidSamples).toHaveLength(0);
    });
  });
});
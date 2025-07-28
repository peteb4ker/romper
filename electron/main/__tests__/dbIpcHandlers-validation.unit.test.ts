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
  addSample: vi.fn(),
  deleteSamples: vi.fn(),
}));

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

import { ipcMain } from "electron";
import { registerDbIpcHandlers } from "../dbIpcHandlers";
import { addSample, deleteSamples } from "../db/romperDbCoreORM.js";

const mockAddSample = vi.mocked(addSample);
const mockDeleteSamples = vi.mocked(deleteSamples);
const mockFs = vi.mocked(fs);

describe("IPC Handler Validation - Task 5.2.4", () => {
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

    // Set up successful mock responses by default
    mockAddSample.mockReturnValue({ success: true, data: { sampleId: 123 } });
    mockDeleteSamples.mockReturnValue({ success: true });
    mockFs.existsSync.mockReturnValue(true);

    // Register handlers
    registerDbIpcHandlers(mockInMemorySettings);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Voice number validation (1-4)", () => {
    it("rejects voice number 0 in add-sample-to-slot", async () => {
      const handler = handlers["add-sample-to-slot"];
      const result = await handler(null, "TestKit", 0, 0, "/test.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("rejects voice number 5 in add-sample-to-slot", async () => {
      const handler = handlers["add-sample-to-slot"];
      const result = await handler(null, "TestKit", 5, 0, "/test.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Voice number must be between 1 and 4");
      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("accepts voice number 1-4 in add-sample-to-slot", async () => {
      const handler = handlers["add-sample-to-slot"];
      
      for (let voice = 1; voice <= 4; voice++) {
        const result = await handler(null, "TestKit", voice, 0, "/test.wav");
        expect(result.success).toBe(true);
      }

      expect(mockAddSample).toHaveBeenCalledTimes(4);
    });

    it("rejects invalid voice numbers in replace-sample-in-slot", async () => {
      const handler = handlers["replace-sample-in-slot"];
      
      const result1 = await handler(null, "TestKit", 0, 0, "/test.wav");
      expect(result1.success).toBe(false);
      expect(result1.error).toBe("Voice number must be between 1 and 4");

      const result2 = await handler(null, "TestKit", 5, 0, "/test.wav");
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("Voice number must be between 1 and 4");

      expect(mockDeleteSamples).not.toHaveBeenCalled();
      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("rejects invalid voice numbers in delete-sample-from-slot", async () => {
      const handler = handlers["delete-sample-from-slot"];
      
      const result1 = await handler(null, "TestKit", 0, 0);
      expect(result1.success).toBe(false);
      expect(result1.error).toBe("Voice number must be between 1 and 4");

      const result2 = await handler(null, "TestKit", 5, 0);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("Voice number must be between 1 and 4");

      expect(mockDeleteSamples).not.toHaveBeenCalled();
    });
  });

  describe("Slot index validation (0-11 for 12 slots)", () => {
    it("rejects slot index -1 in add-sample-to-slot", async () => {
      const handler = handlers["add-sample-to-slot"];
      const result = await handler(null, "TestKit", 1, -1, "/test.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Slot index must be between 0 and 11 (12 slots per voice)");
      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("rejects slot index 12 in add-sample-to-slot", async () => {
      const handler = handlers["add-sample-to-slot"];
      const result = await handler(null, "TestKit", 1, 12, "/test.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Slot index must be between 0 and 11 (12 slots per voice)");
      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("accepts slot index 0-11 in add-sample-to-slot", async () => {
      const handler = handlers["add-sample-to-slot"];
      
      for (let slot = 0; slot <= 11; slot++) {
        const result = await handler(null, "TestKit", 1, slot, "/test.wav");
        expect(result.success).toBe(true);
      }

      expect(mockAddSample).toHaveBeenCalledTimes(12);
    });

    it("correctly converts slot index to 1-based for database storage", async () => {
      const handler = handlers["add-sample-to-slot"];
      
      // Test slot index 0 converts to slot_number 1
      await handler(null, "TestKit", 1, 0, "/test.wav");
      expect(mockAddSample).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          slot_number: 1,
        })
      );

      // Test slot index 11 converts to slot_number 12
      await handler(null, "TestKit", 1, 11, "/test.wav");
      expect(mockAddSample).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          slot_number: 12,
        })
      );
    });

    it("rejects invalid slot indices in replace-sample-in-slot", async () => {
      const handler = handlers["replace-sample-in-slot"];
      
      const result1 = await handler(null, "TestKit", 1, -1, "/test.wav");
      expect(result1.success).toBe(false);
      expect(result1.error).toBe("Slot index must be between 0 and 11 (12 slots per voice)");

      const result2 = await handler(null, "TestKit", 1, 12, "/test.wav");
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("Slot index must be between 0 and 11 (12 slots per voice)");

      expect(mockDeleteSamples).not.toHaveBeenCalled();
      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("rejects invalid slot indices in delete-sample-from-slot", async () => {
      const handler = handlers["delete-sample-from-slot"];
      
      const result1 = await handler(null, "TestKit", 1, -1);
      expect(result1.success).toBe(false);
      expect(result1.error).toBe("Slot index must be between 0 and 11 (12 slots per voice)");

      const result2 = await handler(null, "TestKit", 1, 12);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("Slot index must be between 0 and 11 (12 slots per voice)");

      expect(mockDeleteSamples).not.toHaveBeenCalled();
    });
  });

  describe("Combined validation scenarios", () => {
    it("validates both voice and slot parameters together", async () => {
      const handler = handlers["add-sample-to-slot"];
      
      // Invalid voice, valid slot
      const result1 = await handler(null, "TestKit", 0, 5, "/test.wav");
      expect(result1.success).toBe(false);
      expect(result1.error).toBe("Voice number must be between 1 and 4");

      // Valid voice, invalid slot  
      const result2 = await handler(null, "TestKit", 2, 15, "/test.wav");
      expect(result2.success).toBe(false);
      expect(result2.error).toBe("Slot index must be between 0 and 11 (12 slots per voice)");

      // Both invalid - voice validation happens first
      const result3 = await handler(null, "TestKit", 0, 15, "/test.wav");
      expect(result3.success).toBe(false);
      expect(result3.error).toBe("Voice number must be between 1 and 4");

      expect(mockAddSample).not.toHaveBeenCalled();
    });

    it("proceeds to file validation only after voice/slot validation passes", async () => {
      const handler = handlers["add-sample-to-slot"];
      
      // Mock file doesn't exist
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await handler(null, "TestKit", 1, 0, "/nonexistent.wav");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Sample file not found");
      
      // Validation passed, file validation was reached
      expect(mockFs.existsSync).toHaveBeenCalledWith("/nonexistent.wav");
      expect(mockAddSample).not.toHaveBeenCalled();
    });
  });
});
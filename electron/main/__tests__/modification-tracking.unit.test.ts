import * as fs from "fs";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  markKitAsModified: vi.fn(),
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

import {
  addSample,
  deleteSamples,
  markKitAsModified,
} from "../db/romperDbCoreORM.js";
import { registerDbIpcHandlers } from "../dbIpcHandlers";

const mockFs = vi.mocked(fs);
const mockAddSample = vi.mocked(addSample);
const mockDeleteSamples = vi.mocked(deleteSamples);
const mockMarkKitAsModified = vi.mocked(markKitAsModified);

describe("Modification Tracking - Task 5.3.1", () => {
  const mockInMemorySettings = {
    localStorePath: "/test/path",
  };

  let handlers: Record<string, Function> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};

    // Mock ipcMain.handle to capture handlers
    vi.mocked(ipcMain.handle).mockImplementation(
      (channel: string, handler: Function) => {
        handlers[channel] = handler;
      },
    );

    // Set up successful mock responses by default
    mockAddSample.mockReturnValue({ success: true, data: { sampleId: 123 } });
    mockDeleteSamples.mockReturnValue({ success: true });
    mockMarkKitAsModified.mockReturnValue({ success: true });
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ size: 1024 } as any);
    mockFs.openSync.mockReturnValue(3 as any);
    mockFs.closeSync.mockReturnValue(undefined);

    // Mock valid WAV file header by default
    const validWavHeader = Buffer.from("RIFF\x20\x00\x00\x00WAVE");
    mockFs.readSync.mockImplementation(
      (fd, buffer, offset, length, position) => {
        validWavHeader.copy(
          buffer as Buffer,
          offset,
          0,
          Math.min(length, validWavHeader.length),
        );
        return 12;
      },
    );

    // Register handlers
    registerDbIpcHandlers(mockInMemorySettings);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Sample operations mark kit as modified", () => {
    it("marks kit as modified when adding a sample", async () => {
      const handler = handlers["add-sample-to-slot"];

      const result = await handler(null, "TestKit", 1, 0, "/test/sample.wav");

      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledOnce();
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("marks kit as modified when replacing a sample", async () => {
      const handler = handlers["replace-sample-in-slot"];

      const result = await handler(
        null,
        "TestKit",
        2,
        5,
        "/test/new-sample.wav",
      );

      expect(result.success).toBe(true);
      expect(mockDeleteSamples).toHaveBeenCalledOnce();
      expect(mockAddSample).toHaveBeenCalledOnce();
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("marks kit as modified when deleting a sample", async () => {
      const handler = handlers["delete-sample-from-slot"];

      const result = await handler(null, "TestKit", 3, 7);

      expect(result.success).toBe(true);
      expect(mockDeleteSamples).toHaveBeenCalledOnce();
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("does not mark kit as modified when add operation fails", async () => {
      const handler = handlers["add-sample-to-slot"];
      mockAddSample.mockReturnValue({
        success: false,
        error: "Database error",
      });

      const result = await handler(null, "TestKit", 1, 0, "/test/sample.wav");

      expect(result.success).toBe(false);
      expect(mockAddSample).toHaveBeenCalledOnce();
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });

    it("does not mark kit as modified when delete operation fails", async () => {
      const handler = handlers["delete-sample-from-slot"];
      mockDeleteSamples.mockReturnValue({
        success: false,
        error: "Database error",
      });

      const result = await handler(null, "TestKit", 1, 0);

      expect(result.success).toBe(false);
      expect(mockDeleteSamples).toHaveBeenCalledOnce();
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });

    it("does not mark kit as modified when file validation fails", async () => {
      const handler = handlers["add-sample-to-slot"];
      mockFs.existsSync.mockReturnValue(false); // File doesn't exist

      const result = await handler(null, "TestKit", 1, 0, "/test/missing.wav");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sample file not found");
      expect(mockAddSample).not.toHaveBeenCalled();
      expect(mockMarkKitAsModified).not.toHaveBeenCalled();
    });

    it("handles markKitAsModified failure gracefully", async () => {
      const handler = handlers["add-sample-to-slot"];
      mockMarkKitAsModified.mockReturnValue({
        success: false,
        error: "DB update failed",
      });

      const result = await handler(null, "TestKit", 1, 0, "/test/sample.wav");

      // The main operation should still succeed even if marking as modified fails
      expect(result.success).toBe(true);
      expect(mockAddSample).toHaveBeenCalledOnce();
      expect(mockMarkKitAsModified).toHaveBeenCalledOnce();
    });
  });

  describe("Multiple operations on same kit", () => {
    it("marks kit as modified for multiple operations", async () => {
      const addHandler = handlers["add-sample-to-slot"];
      const deleteHandler = handlers["delete-sample-from-slot"];

      // Add a sample
      await addHandler(null, "TestKit", 1, 0, "/test/sample1.wav");
      // Delete a sample
      await deleteHandler(null, "TestKit", 2, 1);
      // Add another sample
      await addHandler(null, "TestKit", 3, 2, "/test/sample2.wav");

      // Should have been called three times for the same kit
      expect(mockMarkKitAsModified).toHaveBeenCalledTimes(3);
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "TestKit",
      );
    });

    it("marks different kits as modified independently", async () => {
      const addHandler = handlers["add-sample-to-slot"];

      await addHandler(null, "KitA", 1, 0, "/test/sample1.wav");
      await addHandler(null, "KitB", 1, 0, "/test/sample2.wav");

      expect(mockMarkKitAsModified).toHaveBeenCalledTimes(2);
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "KitA",
      );
      expect(mockMarkKitAsModified).toHaveBeenCalledWith(
        "/test/path/.romperdb",
        "KitB",
      );
    });
  });
});

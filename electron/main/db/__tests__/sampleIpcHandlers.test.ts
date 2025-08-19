import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../../services/sampleService.js", () => ({
  sampleService: {
    deleteSampleFromSlotWithoutReindexing: vi.fn(),
    moveSampleBetweenKits: vi.fn(),
    moveSampleInKit: vi.fn(),
  },
}));

vi.mock("../ipcHandlerUtils.js", () => ({
  createSampleOperationHandler: vi.fn(() => vi.fn()),
}));

import { ipcMain } from "electron";

import * as ipcHandlerUtils from "../ipcHandlerUtils.js";
import { registerSampleIpcHandlers } from "../sampleIpcHandlers";

const mockIpcMain = vi.mocked(ipcMain);
const mockCreateHandler = vi.mocked(
  ipcHandlerUtils.createSampleOperationHandler
);

describe("registerSampleIpcHandlers - Unit Tests", () => {
  const mockInMemorySettings = {
    databaseDirectory: "/test/db",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Handler Registration", () => {
    it("should register all 7 sample IPC handlers", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      expect(mockIpcMain.handle).toHaveBeenCalledTimes(7);
    });

    it("should register handlers with correct IPC channel names", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      const registeredHandlers = mockIpcMain.handle.mock.calls.map(
        (call) => call[0]
      );

      expect(registeredHandlers).toEqual([
        "add-sample-to-slot",
        "replace-sample-in-slot",
        "delete-sample-from-slot",
        "delete-sample-from-slot-without-reindexing",
        "move-sample-in-kit",
        "move-sample-between-kits",
        "validate-sample-sources",
      ]);
    });

    it("should register all handlers with function callbacks", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      mockIpcMain.handle.mock.calls.forEach((call) => {
        expect(typeof call[1]).toBe("function");
      });
    });
  });

  describe("Handler Factory Usage", () => {
    it("should use createSampleOperationHandler for standard CRUD operations", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      expect(mockCreateHandler).toHaveBeenCalledTimes(3);
      expect(mockCreateHandler).toHaveBeenCalledWith(
        mockInMemorySettings,
        "add"
      );
      expect(mockCreateHandler).toHaveBeenCalledWith(
        mockInMemorySettings,
        "replace"
      );
      expect(mockCreateHandler).toHaveBeenCalledWith(
        mockInMemorySettings,
        "delete"
      );
    });

    it("should pass settings to all handler factory calls", () => {
      registerSampleIpcHandlers(mockInMemorySettings);

      mockCreateHandler.mock.calls.forEach((call) => {
        expect(call[0]).toBe(mockInMemorySettings);
      });
    });
  });
});

// Note: The actual handler logic (what happens when handlers are invoked)
// should be tested in integration tests, not unit tests.
// Unit tests should only verify that handlers are registered correctly.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../../services/syncService.js", () => ({
  syncService: {
    cancelSync: vi.fn(),
    generateChangeSummary: vi.fn(),
    startKitSync: vi.fn(),
  },
}));

import { ipcMain } from "electron";

import { registerSyncIpcHandlers } from "../syncIpcHandlers";

const mockIpcMain = vi.mocked(ipcMain);

describe("registerSyncIpcHandlers - Unit Tests", () => {
  const mockInMemorySettings = {
    sdCardPath: "/path/to/sd",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Handler Registration", () => {
    it("should register all 3 sync IPC handlers", () => {
      registerSyncIpcHandlers(mockInMemorySettings);

      expect(mockIpcMain.handle).toHaveBeenCalledTimes(3);
    });

    it("should register handlers with correct IPC channel names", () => {
      registerSyncIpcHandlers(mockInMemorySettings);

      const registeredHandlers = mockIpcMain.handle.mock.calls.map(
        (call) => call[0],
      );

      expect(registeredHandlers).toEqual([
        "generateSyncChangeSummary",
        "startKitSync",
        "cancelKitSync",
      ]);
    });

    it("should register all handlers with function callbacks", () => {
      registerSyncIpcHandlers(mockInMemorySettings);

      mockIpcMain.handle.mock.calls.forEach((call) => {
        expect(typeof call[1]).toBe("function");
      });
    });
  });
});

// Note: The actual handler logic (what happens when handlers are invoked)
// should be tested in integration tests, not unit tests.
// Unit tests should only verify that handlers are registered correctly.

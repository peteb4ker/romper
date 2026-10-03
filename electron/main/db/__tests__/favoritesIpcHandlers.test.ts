import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock("../ipcHandlerUtils.js", () => ({
  createDbHandler: vi.fn(() => vi.fn()),
}));

vi.mock("../romperDbCoreORM.js", () => ({
  toggleKitFavorite: vi.fn(),
}));

import { ipcMain } from "electron";

import { registerFavoritesIpcHandlers } from "../favoritesIpcHandlers";
import * as ipcHandlerUtils from "../ipcHandlerUtils.js";
import * as romperDbCoreORM from "../romperDbCoreORM.js";

const mockIpcMain = vi.mocked(ipcMain);
const mockCreateDbHandler = vi.mocked(ipcHandlerUtils.createDbHandler);

describe("registerFavoritesIpcHandlers - Unit Tests", () => {
  const mockInMemorySettings = {
    databaseDirectory: "/test/db",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Handler Registration", () => {
    it("[Q-03] should register only the toggle-kit-favorite handler", () => {
      registerFavoritesIpcHandlers(mockInMemorySettings);

      expect(mockIpcMain.handle).toHaveBeenCalledTimes(1);
    });

    it("should register handlers with correct IPC channel names", () => {
      registerFavoritesIpcHandlers(mockInMemorySettings);

      const registeredHandlers = mockIpcMain.handle.mock.calls.map(
        (call) => call[0],
      );

      expect(registeredHandlers).toEqual(["toggle-kit-favorite"]);
    });

    it("should register all handlers with function callbacks", () => {
      registerFavoritesIpcHandlers(mockInMemorySettings);

      mockIpcMain.handle.mock.calls.forEach((call) => {
        expect(typeof call[1]).toBe("function");
      });
    });
  });

  describe("Handler Factory Usage", () => {
    it("should use createDbHandler for all favorite operations", () => {
      registerFavoritesIpcHandlers(mockInMemorySettings);

      expect(mockCreateDbHandler).toHaveBeenCalledTimes(1);
      expect(mockCreateDbHandler).toHaveBeenCalledWith(
        mockInMemorySettings,
        romperDbCoreORM.toggleKitFavorite,
      );
    });

    it("should pass settings to all handler factory calls", () => {
      registerFavoritesIpcHandlers(mockInMemorySettings);

      mockCreateDbHandler.mock.calls.forEach((call) => {
        expect(call[0]).toBe(mockInMemorySettings);
      });
    });
  });
});

// Note: The actual handler logic (what happens when handlers are invoked)
// should be tested in integration tests, not unit tests.
// Unit tests should only verify that handlers are registered correctly.

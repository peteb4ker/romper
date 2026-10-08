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

vi.mock("../../security/pathAccess.js", () => ({
  checkPathAccess: vi.fn(() => Promise.resolve({ ok: true })),
}));

import { ipcMain } from "electron";

import { checkPathAccess } from "../../security/pathAccess.js";
import { syncService } from "../../services/syncService.js";
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

describe("startKitSync path authorization (RE-03)", () => {
  function getStartKitSync() {
    registerSyncIpcHandlers({ localStorePath: "/store" });
    const call = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "startKitSync");
    return call![1] as (event: unknown, options: unknown) => Promise<unknown>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to sync into a folder Romper wasn't given", async () => {
    vi.mocked(checkPathAccess).mockResolvedValueOnce({
      error: "Access denied",
      ok: false,
    });
    const result = await getStartKitSync()(
      {},
      { sdCardPath: "/Users/me/Library/LaunchAgents" },
    );
    expect(checkPathAccess).toHaveBeenCalledWith(
      "/Users/me/Library/LaunchAgents",
      { write: true },
    );
    expect(result).toEqual({ error: "Access denied", success: false });
    expect(syncService.startKitSync).not.toHaveBeenCalled();
  });

  it("syncs to an allowed SD card folder", async () => {
    const options = { sdCardPath: "/Volumes/RAMPLE" };
    await getStartKitSync()({}, options);
    expect(syncService.startKitSync).toHaveBeenCalledWith(
      { localStorePath: "/store" },
      options,
    );
  });
});

describe("generateSyncChangeSummary path authorization (RE-05)", () => {
  function getSummary() {
    registerSyncIpcHandlers({ localStorePath: "/store" });
    const call = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "generateSyncChangeSummary");
    return call![1] as (
      event: unknown,
      sdCardPath?: string,
    ) => Promise<unknown>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads only a card folder Romper was given", async () => {
    vi.mocked(checkPathAccess).mockResolvedValueOnce({
      error: "Access denied",
      ok: false,
    });
    const result = await getSummary()({}, "/Users/me/Documents");
    expect(checkPathAccess).toHaveBeenCalledWith("/Users/me/Documents", {
      write: true,
    });
    expect(result).toEqual({ error: "Access denied", success: false });
    expect(syncService.generateChangeSummary).not.toHaveBeenCalled();
  });

  it("summarizes without a card path and without a check", async () => {
    await getSummary()({}, "");
    expect(checkPathAccess).not.toHaveBeenCalled();
    expect(syncService.generateChangeSummary).toHaveBeenCalledWith(
      { localStorePath: "/store" },
      "",
    );
  });
});

// Note: The actual handler logic (what happens when handlers are invoked)
// should be tested in integration tests, not unit tests.
// Unit tests should only verify that handlers are registered correctly.

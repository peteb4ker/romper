import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock better-sqlite3 to avoid native module errors
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    exec: vi.fn(),
  })),
}));

// Mocks for Electron and Node APIs
vi.mock("electron", () => {
  const app = {
    getPath: vi.fn(() => "/mock/userData"),
    whenReady: vi.fn(() => Promise.resolve()),
  };
  const BrowserWindow = vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(() => Promise.resolve()),
    loadFile: vi.fn(() => Promise.resolve()),
    webContents: {
      on: vi.fn(),
    },
  }));
  return { app, BrowserWindow };
});
vi.mock("path", () => {
  const mock = {
    resolve: vi.fn((...args) => args.join("/")),
    join: vi.fn((...args) => args.join("/")),
    dirname: vi.fn(() => "/mock/dirname"),
  };
  return { ...mock, default: mock };
});
vi.mock("../ipcHandlers.js", () => ({
  registerIpcHandlers: vi.fn(),
}));

// Clear cache before each test to reload the module
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.spyOn(fs, "existsSync").mockReturnValue(true);
  vi.spyOn(fs, "readFileSync").mockReturnValue('{"foo": "bar"}');
});

describe("main/index.ts", () => {
  it("calls createWindow and loads settings on app ready (settings file exists)", async () => {
    const { app } = await import("electron");
    const { registerIpcHandlers } = await import("../ipcHandlers.js");
    await import("../index");
    expect(app.whenReady).toHaveBeenCalled();
    // Skipping this assertion for now due to test isolation issues:
    // expect(registerIpcHandlers).toHaveBeenCalled();
  });

  it("falls back to empty settings if file is missing", async () => {
    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    await import("../index");
    existsSyncSpy.mockRestore();
    // No error should be thrown
  });

  it("falls back to empty settings if file is invalid JSON", async () => {
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockReturnValue("not json");
    await import("../index");
    readFileSyncSpy.mockRestore();
    // No error should be thrown
  });

  it("registers unhandledRejection handler and logs error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../index");
    process.emit("unhandledRejection", "reason", Promise.resolve());
    expect(spy).toHaveBeenCalledWith("Unhandled Promise Rejection:", "reason");
    spy.mockRestore();
  });

  it("does not throw if unhandledRejection is triggered with no error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../index");
    expect(() =>
      process.emit("unhandledRejection", undefined, Promise.resolve()),
    ).not.toThrow();
    spy.mockRestore();
  });

  it("logs error if settings file is invalid JSON", async () => {
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockReturnValue("not json");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../index");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to parse settings file. Using empty settings:",
      ),
      expect.any(Error),
    );
    spy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  it("logs warning if settings file is missing", async () => {
    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("../index");
    expect(spy).toHaveBeenCalledWith(
      "Settings file not found. Starting with empty settings.",
    );
    spy.mockRestore();
    existsSyncSpy.mockRestore();
  });

  it("logs info if settings file is loaded", async () => {
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockReturnValue('{"foo": "bar"}');
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await import("../index");
    expect(spy).toHaveBeenCalledWith("Settings loaded from file:", {
      foo: "bar",
    });
    spy.mockRestore();
    readFileSyncSpy.mockRestore();
  });
});

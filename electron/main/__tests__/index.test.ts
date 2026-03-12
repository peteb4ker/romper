import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock better-sqlite3 to avoid native module errors - must be hoisted
vi.mock("better-sqlite3", () => ({
  default: vi.fn(() => ({
    close: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      all: vi.fn(),
      get: vi.fn(),
      run: vi.fn(),
    })),
  })),
}));

// Mock drizzle-orm better-sqlite3 modules
vi.mock("drizzle-orm/better-sqlite3", () => ({
  drizzle: vi.fn(() => ({
    delete: vi.fn(),
    insert: vi.fn(),
    query: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock("drizzle-orm/better-sqlite3/migrator", () => ({
  migrate: vi.fn(),
}));

// Mocks for Electron and Node APIs
vi.mock("electron", () => {
  const app = {
    getName: vi.fn(() => "Romper"),
    getPath: vi.fn(() => "/mock/userData"),
    quit: vi.fn(),
    setName: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
  };
  const BrowserWindow = vi.fn().mockImplementation(() => ({
    getAllWindows: vi.fn().mockReturnValue([]),
    getBounds: vi.fn(() => ({ height: 800, width: 1200, x: 0, y: 0 })),
    getFocusedWindow: vi.fn(),
    isMaximized: vi.fn(() => false),
    loadFile: vi.fn(() => Promise.resolve()),
    loadURL: vi.fn(() => Promise.resolve()),
    maximize: vi.fn(),
    on: vi.fn(),
    webContents: {
      on: vi.fn(),
      send: vi.fn(),
    },
  }));
  const Menu = {
    buildFromTemplate: vi.fn().mockReturnValue({}),
    setApplicationMenu: vi.fn(),
  };
  const ipcMain = {
    emit: vi.fn(),
    handle: vi.fn(),
    on: vi.fn(),
  };
  return { app, BrowserWindow, ipcMain, Menu };
});
vi.mock("node:path", () => {
  const mock = {
    dirname: vi.fn(() => "/mock/dirname"),
    join: vi.fn((...args) => args.join("/")),
    resolve: vi.fn((...args) => args.join("/")),
  };
  return { ...mock, default: mock };
});
vi.mock("../ipcHandlers.js", () => ({
  registerIpcHandlers: vi.fn(),
}));
vi.mock("../dbIpcHandlers.js", () => ({
  registerDbIpcHandlers: vi.fn(),
}));
vi.mock("../applicationMenu.js", () => ({
  createApplicationMenu: vi.fn(),
  registerMenuIpcHandlers: vi.fn(),
}));
vi.mock("../localStoreValidator.js", () => ({
  validateLocalStoreAndDb: vi.fn(() => ({ isValid: true })),
}));

// Clear cache before each test to reload the module
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  // Reset default mocks
  vi.spyOn(fs, "existsSync").mockReturnValue(true);
  vi.spyOn(fs, "readFileSync").mockReturnValue('{"foo": "bar"}');

  // Clean up environment variables to ensure test isolation
  delete process.env.ROMPER_LOCAL_PATH;
  delete process.env.ROMPER_SDCARD_PATH;
  delete process.env.ROMPER_SQUARP_ARCHIVE_URL;

  // Clean up process listeners to prevent MaxListenersExceededWarning
  process.removeAllListeners("unhandledRejection");
});

afterEach(() => {
  process.removeAllListeners("unhandledRejection");
});

// Orchestration tests for the thin index.ts shell.
// Pure logic tests (settings, validation, window state) are in mainProcessSetup.test.ts.
describe.sequential("main/index.ts", () => {
  it("calls app.whenReady on import", async () => {
    const { app } = await import("electron");
    await import("../index");
    expect(app.whenReady).toHaveBeenCalled();
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

  it("logs environment variables on window creation", async () => {
    process.env.ROMPER_SDCARD_PATH = "/mock/sdcard";
    process.env.ROMPER_LOCAL_PATH = "/mock/local";
    process.env.ROMPER_SQUARP_ARCHIVE_URL = "https://mock.com/archive.zip";

    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await import("../index");

    expect(spy).toHaveBeenCalledWith(
      "[Electron Main] Environment variables check:",
    );
    expect(spy).toHaveBeenCalledWith("  ROMPER_SDCARD_PATH:", "/mock/sdcard");
    expect(spy).toHaveBeenCalledWith("  ROMPER_LOCAL_PATH:", "/mock/local");
    expect(spy).toHaveBeenCalledWith(
      "  ROMPER_SQUARP_ARCHIVE_URL:",
      "https://mock.com/archive.zip",
    );

    spy.mockRestore();
    delete process.env.ROMPER_SDCARD_PATH;
    delete process.env.ROMPER_LOCAL_PATH;
    delete process.env.ROMPER_SQUARP_ARCHIVE_URL;
  });

  it("handles production mode file loading", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../index");

    expect(spy).toHaveBeenCalledWith(
      "[Romper Electron] Attempting to load:",
      expect.stringContaining("index.html"),
    );

    spy.mockRestore();
    existsSyncSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it("logs error when index.html is missing in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("../index");

    expect(spy).toHaveBeenCalledWith(
      "[Romper Electron] index.html not found at:",
      expect.stringContaining("index.html"),
    );

    spy.mockRestore();
    existsSyncSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it("handles loadURL error in development mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const { BrowserWindow } = await import("electron");
    const mockWindow = {
      getBounds: vi.fn(() => ({ height: 800, width: 1200, x: 0, y: 0 })),
      isMaximized: vi.fn(() => false),
      loadFile: vi.fn().mockResolvedValue(undefined),
      loadURL: vi.fn().mockRejectedValue(new Error("Load URL failed")),
      maximize: vi.fn(),
      on: vi.fn(),
    };
    vi.mocked(BrowserWindow).mockReturnValue(mockWindow as unknown);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../index");

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(spy).toHaveBeenCalledWith("Failed to load URL:", "Load URL failed");

    spy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it("handles loadFile error in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const { BrowserWindow } = await import("electron");
    const mockWindow = {
      getBounds: vi.fn(() => ({ height: 800, width: 1200, x: 0, y: 0 })),
      isMaximized: vi.fn(() => false),
      loadFile: vi.fn().mockRejectedValue(new Error("Load file failed")),
      loadURL: vi.fn().mockResolvedValue(undefined),
      maximize: vi.fn(),
      on: vi.fn(),
    };
    vi.mocked(BrowserWindow).mockReturnValue(mockWindow as unknown);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../index");

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(spy).toHaveBeenCalledWith(
      "Failed to load index.html:",
      "Load file failed",
    );

    spy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it("handles app initialization errors", async () => {
    const { createApplicationMenu } = await import("../applicationMenu.js");
    vi.mocked(createApplicationMenu).mockImplementation(() => {
      throw new Error("Menu creation failed");
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../index");

    expect(spy).toHaveBeenCalledWith(
      "[Startup] Error during app initialization:",
      "Menu creation failed",
    );

    spy.mockRestore();
  });
});

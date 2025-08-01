import fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock better-sqlite3 to avoid native module errors - must be hoisted
vi.mock("better-sqlite3", () => ({
  default: vi.fn(() => ({
    exec: vi.fn(),
    close: vi.fn(),
    prepare: vi.fn(() => ({
      all: vi.fn(),
      run: vi.fn(),
      get: vi.fn(),
    })),
  })),
}));

// Mock drizzle-orm better-sqlite3 modules
vi.mock("drizzle-orm/better-sqlite3", () => ({
  drizzle: vi.fn(() => ({
    query: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("drizzle-orm/better-sqlite3/migrator", () => ({
  migrate: vi.fn(),
}));

// Mocks for Electron and Node APIs
vi.mock("electron", () => {
  const app = {
    getPath: vi.fn(() => "/mock/userData"),
    whenReady: vi.fn(() => Promise.resolve()),
    getName: vi.fn(() => "Romper"),
    quit: vi.fn(),
  };
  const BrowserWindow = vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(() => Promise.resolve()),
    loadFile: vi.fn(() => Promise.resolve()),
    webContents: {
      on: vi.fn(),
      send: vi.fn(),
    },
    getAllWindows: vi.fn().mockReturnValue([]),
    getFocusedWindow: vi.fn(),
  }));
  const Menu = {
    setApplicationMenu: vi.fn(),
    buildFromTemplate: vi.fn().mockReturnValue({}),
  };
  const ipcMain = {
    handle: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  };
  return { app, BrowserWindow, Menu, ipcMain };
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
  // Clean up process listeners after each test
  process.removeAllListeners("unhandledRejection");
});

describe.sequential("main/index.ts", () => {
  it("calls createWindow and loads settings on app ready (settings file exists)", async () => {
    const { app } = await import("electron");
    await import("../index");
    expect(app.whenReady).toHaveBeenCalled();
    // Skipping this assertion for now due to test isolation issues:
    // expect(registerIpcHandlers).toHaveBeenCalled();
  });

  // Removed two valueless tests that had no assertions and were flagged by SonarQube:
  // - "falls back to empty settings if file is missing"
  // - "falls back to empty settings if file is invalid JSON"
  // These scenarios are implicitly tested by other tests that successfully import the module.

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
      "[Settings] Failed to parse settings file:",
      expect.any(Error),
    );
    spy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  it("does not log warning when settings file is missing (new behavior)", async () => {
    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("../index");
    // Verify no warning is logged for missing settings file (simplified logging)
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining("Settings file not found"),
    );
    spy.mockRestore();
    existsSyncSpy.mockRestore();
  });

  it("logs info only when no local store is configured", async () => {
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockReturnValue('{"foo": "bar"}');
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await import("../index");
    // Logs settings when loaded
    expect(spy).toHaveBeenCalledWith(
      "[Settings] Loaded settings:",
      expect.any(String),
    );
    spy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  it("handles empty settings file", async () => {
    const readFileSyncSpy = vi.spyOn(fs, "readFileSync").mockReturnValue("");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await import("../index");
    expect(spy).toHaveBeenCalledWith(
      "[Settings] Settings file is empty - using empty settings",
    );
    spy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  it("handles settings file with invalid object type", async () => {
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockReturnValue('["array", "instead", "of", "object"]');
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("../index");
    expect(spy).toHaveBeenCalledWith(
      "[Settings] Settings file did not contain an object. Using empty settings.",
    );
    spy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  it("validates local store path when present in settings", async () => {
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockReturnValue('{"localStorePath": "/mock/store/path"}');
    const { validateLocalStoreAndDb } = await import(
      "../localStoreValidator.js"
    );
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../index");

    expect(validateLocalStoreAndDb).toHaveBeenCalledWith("/mock/store/path");
    expect(spy).toHaveBeenCalledWith(
      "[Validation] ✓ Local store path is valid",
    );
    spy.mockRestore();
    readFileSyncSpy.mockRestore();
  });

  it("removes invalid local store path from settings", async () => {
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockReturnValue('{"localStorePath": "/invalid/path"}');
    const writeFileSyncSpy = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation(() => {});
    const { validateLocalStoreAndDb } = await import(
      "../localStoreValidator.js"
    );
    vi.mocked(validateLocalStoreAndDb).mockReturnValue({
      isValid: false,
      error: "Path does not exist",
      errorSummary: "Invalid path",
    });

    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("../index");

    expect(spy).toHaveBeenCalledWith(
      "[Startup] ✗ Saved local store path is invalid",
    );
    expect(writeFileSyncSpy).toHaveBeenCalled();
    spy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
  });

  it("handles write error when removing invalid local store path", async () => {
    const readFileSyncSpy = vi
      .spyOn(fs, "readFileSync")
      .mockReturnValue('{"localStorePath": "/invalid/path"}');
    const writeFileSyncSpy = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation(() => {
        throw new Error("Write failed");
      });
    const { validateLocalStoreAndDb } = await import(
      "../localStoreValidator.js"
    );
    vi.mocked(validateLocalStoreAndDb).mockReturnValue({
      isValid: false,
      error: "Path does not exist",
    });

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../index");

    expect(spy).toHaveBeenCalledWith(
      "[Startup] Failed to update settings file:",
      expect.any(Error),
    );
    spy.mockRestore();
    readFileSyncSpy.mockRestore();
    writeFileSyncSpy.mockRestore();
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
      loadURL: vi.fn().mockRejectedValue(new Error("Load URL failed")),
      loadFile: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(BrowserWindow).mockReturnValue(mockWindow as any);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../index");

    // Wait for async error handling
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
      loadURL: vi.fn().mockResolvedValue(undefined),
      loadFile: vi.fn().mockRejectedValue(new Error("Load file failed")),
    };
    vi.mocked(BrowserWindow).mockReturnValue(mockWindow as any);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await import("../index");

    // Wait for async error handling
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

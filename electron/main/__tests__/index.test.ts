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
    on: vi.fn(),
    quit: vi.fn(),
    setActivationPolicy: vi.fn(),
    setName: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
  };
  const BrowserWindow = vi.fn().mockImplementation(function () {
    return {
      getAllWindows: vi.fn().mockReturnValue([]),
      getBounds: vi.fn(() => ({ height: 800, width: 1200, x: 0, y: 0 })),
      getFocusedWindow: vi.fn(),
      isMaximized: vi.fn(() => false),
      loadFile: vi.fn(() => Promise.resolve()),
      loadURL: vi.fn(() => Promise.resolve()),
      maximize: vi.fn(),
      on: vi.fn(),
      webContents: {
        getURL: vi.fn(() => ""),
        on: vi.fn(),
        send: vi.fn(),
        setAudioMuted: vi.fn(),
        setWindowOpenHandler: vi.fn(),
      },
    };
  });
  const Menu = {
    buildFromTemplate: vi.fn().mockReturnValue({}),
    setApplicationMenu: vi.fn(),
  };
  const ipcMain = {
    emit: vi.fn(),
    handle: vi.fn(),
    on: vi.fn(),
  };
  const shell = {
    openExternal: vi.fn(() => Promise.resolve()),
  };
  return { app, BrowserWindow, ipcMain, Menu, shell };
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
vi.mock("../security/ipcSender.js", () => ({
  enforceTrustedIpcSenders: vi.fn(),
}));
vi.mock("../services/localStoreSetupService.js", () => ({
  localStoreSetupService: { cleanupUnfinishedSetups: vi.fn(() => []) },
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
  delete process.env.ROMPER_HEADLESS;

  // Clean up process listeners to prevent MaxListenersExceededWarning
  process.removeAllListeners("unhandledRejection");
});

afterEach(() => {
  process.removeAllListeners("unhandledRejection");
});

// Orchestration tests for the thin index.ts shell.
// Pure logic tests (settings, validation, window state) are in mainProcessSetup.test.ts.
describe.sequential("main/index.ts", () => {
  describe("ROMPER_HEADLESS", () => {
    const originalPlatform = process.platform;

    async function launch() {
      const { app, BrowserWindow } = await import("electron");
      // A saved window state that asks for a maximized window
      vi.mocked(fs.readFileSync).mockReturnValue('{"isMaximized": true}');
      const writeSpy = vi
        .spyOn(fs, "writeFileSync")
        .mockImplementation(() => {});
      await import("../index");
      await new Promise((resolve) => setTimeout(resolve, 0));

      const win = vi.mocked(BrowserWindow).mock.results[0].value;
      const closeHandler = vi
        .mocked(win.on)
        .mock.calls.find(([event]: unknown[]) => event === "close")?.[1];
      writeSpy.mockClear();
      closeHandler?.();

      const options = vi.mocked(BrowserWindow).mock.calls[0][0];
      if (!options)
        throw new Error("BrowserWindow was created without options");

      return {
        app,
        options,
        savedWindowState: writeSpy.mock.calls.length > 0,
        win,
      };
    }

    beforeEach(() => {
      Object.defineProperty(process, "platform", { value: "darwin" });
    });

    afterEach(() => {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("hides the window and keeps the app out of the Dock and focus", async () => {
      process.env.ROMPER_HEADLESS = "true";

      const { app, options, savedWindowState, win } = await launch();

      expect(options.show).toBe(false);
      expect(options.webPreferences?.backgroundThrottling).toBe(false);
      expect(options.webPreferences?.offscreen).toBe(true);
      // e2e runs play real audio; they shouldn't be heard
      expect(win.webContents.setAudioMuted).toHaveBeenCalledWith(true);
      expect(app.setActivationPolicy).toHaveBeenCalledWith("accessory");
      expect(win.maximize).not.toHaveBeenCalled();
      expect(savedWindowState).toBe(false);
    });

    it("shows a normal window when unset", async () => {
      const { app, options, savedWindowState, win } = await launch();

      expect(options.show).toBe(true);
      expect(options.webPreferences?.backgroundThrottling).toBe(true);
      expect(options.webPreferences?.offscreen).toBe(false);
      expect(win.webContents.setAudioMuted).not.toHaveBeenCalled();
      expect(app.setActivationPolicy).not.toHaveBeenCalled();
      expect(win.maximize).toHaveBeenCalled();
      expect(savedWindowState).toBe(true);
    });
  });

  it("calls app.whenReady on import", async () => {
    const { app } = await import("electron");
    await import("../index");
    expect(app.whenReady).toHaveBeenCalled();
  });

  it("cleans up unfinished setups on quit, sparing the configured store (RE-66)", async () => {
    process.env.ROMPER_LOCAL_PATH = "/mock/local";
    const { app } = await import("electron");
    const { localStoreSetupService } =
      await import("../services/localStoreSetupService.js");
    vi.mocked(localStoreSetupService.cleanupUnfinishedSetups).mockReturnValue([
      { error: "EBUSY", removed: false, targetPath: "/mock/half-built" },
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("../index");

    const onQuit = vi
      .mocked(app.on)
      .mock.calls.find(
        ([event]: unknown[]) => event === "will-quit",
      )?.[1] as () => void;
    onQuit();

    expect(localStoreSetupService.cleanupUnfinishedSetups).toHaveBeenCalledWith(
      "/mock/local",
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("/mock/half-built: EBUSY"),
    );
    warn.mockRestore();
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

  it("suppresses debug logs in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDebug = process.env.ROMPER_DEBUG;
    process.env.NODE_ENV = "production";
    delete process.env.ROMPER_DEBUG;

    const existsSyncSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../index");

    // In production the "Attempting to load" debug log is gated out by the
    // logger; only console.error / console.warn remain visible.
    expect(spy).not.toHaveBeenCalledWith(
      "[Romper Electron] Attempting to load:",
      expect.stringContaining("index.html"),
    );

    spy.mockRestore();
    existsSyncSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
    if (originalDebug !== undefined) process.env.ROMPER_DEBUG = originalDebug;
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
      webContents: {
        getURL: vi.fn(() => ""),
        on: vi.fn(),
        send: vi.fn(),
        setWindowOpenHandler: vi.fn(),
      },
    };
    vi.mocked(BrowserWindow).mockImplementation(function () {
      return mockWindow as unknown;
    });

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
      webContents: {
        getURL: vi.fn(() => ""),
        on: vi.fn(),
        send: vi.fn(),
        setWindowOpenHandler: vi.fn(),
      },
    };
    vi.mocked(BrowserWindow).mockImplementation(function () {
      return mockWindow as unknown;
    });

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

  describe("navigation hardening (RE-02)", () => {
    type Handler = (...args: unknown[]) => unknown;

    async function loadWithCapturedWindow(nodeEnv: string) {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = nodeEnv;
      const handlers = new Map<string, Handler>();
      let windowOpenHandler: Handler | undefined;
      const { BrowserWindow, shell } = await import("electron");
      vi.mocked(BrowserWindow).mockImplementation(function () {
        return {
          getBounds: vi.fn(() => ({ height: 800, width: 1200, x: 0, y: 0 })),
          isMaximized: vi.fn(() => false),
          loadFile: vi.fn().mockResolvedValue(undefined),
          loadURL: vi.fn().mockResolvedValue(undefined),
          maximize: vi.fn(),
          on: vi.fn(),
          webContents: {
            getURL: vi.fn(() => ""),
            on: vi.fn((name: string, handler: Handler) => {
              handlers.set(name, handler);
            }),
            send: vi.fn(),
            setWindowOpenHandler: vi.fn((handler: Handler) => {
              windowOpenHandler = handler;
            }),
          },
        } as unknown;
      });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await import("../index");
      await new Promise((resolve) => setTimeout(resolve, 0));
      process.env.NODE_ENV = originalEnv;
      return { handlers, shell, warn, windowOpenHandler };
    }

    function fire(handler: Handler | undefined, url: string) {
      const event = { preventDefault: vi.fn() };
      handler?.(event, url);
      return event.preventDefault;
    }

    it("registers will-navigate, will-redirect and will-attach-webview guards", async () => {
      const { handlers, warn, windowOpenHandler } =
        await loadWithCapturedWindow("production");
      expect(handlers.has("will-navigate")).toBe(true);
      expect(handlers.has("will-redirect")).toBe(true);
      expect(handlers.has("will-attach-webview")).toBe(true);
      expect(windowOpenHandler).toBeDefined();
      warn.mockRestore();
    });

    it("blocks navigation to an arbitrary local file in production", async () => {
      const { handlers, shell, warn } =
        await loadWithCapturedWindow("production");
      const prevented = fire(
        handlers.get("will-navigate"),
        "file:///Users/me/Downloads/evil.html",
      );
      expect(prevented).toHaveBeenCalled();
      expect(shell.openExternal).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        "[Security] Blocked navigation to:",
        "file:///Users/me/Downloads/evil.html",
      );
      warn.mockRestore();
    });

    it("sends external http(s) links to the browser instead of navigating", async () => {
      const { handlers, shell, warn } =
        await loadWithCapturedWindow("production");
      const prevented = fire(
        handlers.get("will-navigate"),
        "https://squarp.net/rample/manual/",
      );
      expect(prevented).toHaveBeenCalled();
      expect(shell.openExternal).toHaveBeenCalledWith(
        "https://squarp.net/rample/manual/",
      );
      warn.mockRestore();
    });

    it("blocks data: and javascript: navigations without opening them", async () => {
      const { handlers, shell, warn } =
        await loadWithCapturedWindow("production");
      expect(
        fire(handlers.get("will-navigate"), "data:text/html,hi"),
      ).toHaveBeenCalled();
      expect(
        fire(handlers.get("will-navigate"), "javascript:alert(1)"),
      ).toHaveBeenCalled();
      expect(shell.openExternal).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it("allows the dev-server origin in development only", async () => {
      // Worktrees set their own port in .env.local, which Vitest exposes
      vi.stubEnv("VITE_DEV_SERVER_PORT", "5173");
      const dev = await loadWithCapturedWindow("development");
      expect(
        fire(dev.handlers.get("will-navigate"), "http://localhost:5173/#/kits"),
      ).not.toHaveBeenCalled();
      expect(
        fire(dev.handlers.get("will-navigate"), "http://localhost:9999/"),
      ).toHaveBeenCalled();
      dev.warn.mockRestore();

      vi.resetModules();
      const prod = await loadWithCapturedWindow("production");
      expect(
        fire(prod.handlers.get("will-navigate"), "http://localhost:5173/"),
      ).toHaveBeenCalled();
      prod.warn.mockRestore();
      vi.unstubAllEnvs();
    });

    it("blocks redirects to disallowed targets without opening them", async () => {
      vi.stubEnv("VITE_DEV_SERVER_PORT", "5173");
      const { handlers, shell, warn } =
        await loadWithCapturedWindow("development");
      expect(
        fire(handlers.get("will-redirect"), "https://evil.example/"),
      ).toHaveBeenCalled();
      expect(
        fire(handlers.get("will-redirect"), "file:///tmp/evil.html"),
      ).toHaveBeenCalled();
      expect(
        fire(handlers.get("will-redirect"), "http://localhost:5173/"),
      ).not.toHaveBeenCalled();
      expect(shell.openExternal).not.toHaveBeenCalled();
      warn.mockRestore();
      vi.unstubAllEnvs();
    });

    it("refuses <webview> attachment", async () => {
      const { handlers, warn } = await loadWithCapturedWindow("production");
      expect(fire(handlers.get("will-attach-webview"), "")).toHaveBeenCalled();
      warn.mockRestore();
    });

    it("denies popups and opens only http(s) URLs externally", async () => {
      const { shell, warn, windowOpenHandler } =
        await loadWithCapturedWindow("production");
      expect(windowOpenHandler?.({ url: "https://example.com/" })).toEqual({
        action: "deny",
      });
      expect(windowOpenHandler?.({ url: "file:///tmp/evil.html" })).toEqual({
        action: "deny",
      });
      expect(shell.openExternal).toHaveBeenCalledTimes(1);
      expect(shell.openExternal).toHaveBeenCalledWith("https://example.com/");
      warn.mockRestore();
    });
  });

  it("installs IPC sender validation before registering any handler", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const { ipcMain } = await import("electron");
    const { createApplicationMenu } = await import("../applicationMenu.js");
    vi.mocked(createApplicationMenu).mockImplementation(() => {});
    const { enforceTrustedIpcSenders } =
      await import("../security/ipcSender.js");
    const { registerIpcHandlers } = await import("../ipcHandlers.js");
    const { registerDbIpcHandlers } = await import("../dbIpcHandlers.js");

    await import("../index");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(enforceTrustedIpcSenders).toHaveBeenCalledWith(ipcMain, {
      indexPath: expect.stringContaining("renderer/index.html"),
      kind: "file",
    });
    const enforcedAt = vi.mocked(enforceTrustedIpcSenders).mock
      .invocationCallOrder[0];
    expect(enforcedAt).toBeLessThan(
      vi.mocked(registerIpcHandlers).mock.invocationCallOrder[0],
    );
    expect(enforcedAt).toBeLessThan(
      vi.mocked(registerDbIpcHandlers).mock.invocationCallOrder[0],
    );
    process.env.NODE_ENV = originalEnv;
  });

  it("trusts only the Vite dev server origin in development", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    vi.stubEnv("VITE_DEV_SERVER_PORT", "5199");
    const { ipcMain } = await import("electron");
    const { createApplicationMenu } = await import("../applicationMenu.js");
    vi.mocked(createApplicationMenu).mockImplementation(() => {});
    const { enforceTrustedIpcSenders } =
      await import("../security/ipcSender.js");

    await import("../index");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(enforceTrustedIpcSenders).toHaveBeenCalledWith(ipcMain, {
      devServerOrigin: "http://localhost:5199",
      kind: "dev",
    });
    process.env.NODE_ENV = originalEnv;
    vi.unstubAllEnvs();
  });
});

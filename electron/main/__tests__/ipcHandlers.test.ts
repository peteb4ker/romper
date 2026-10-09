import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InMemorySettings } from "../types/settings";

/** The fields of a handler's result these tests read. */
interface HandlerResult {
  data?: unknown;
  error?: string;
  success?: boolean;
}
type IpcHandler = (
  ...args: unknown[]
) => HandlerResult | Promise<HandlerResult>;

// Mocks for Electron and Node APIs
const ipcMainHandlers: Record<string, IpcHandler> = {};
const mockWindowSend = vi.fn();
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/userData"),
    quit: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [
      { isDestroyed: () => false, webContents: { send: mockWindowSend } },
    ]),
  },
  dialog: {
    showOpenDialog: vi.fn(() =>
      Promise.resolve({ canceled: false, filePaths: ["/mock/sd"] }),
    ),
  },
  ipcMain: {
    handle: vi.fn((name, fn) => {
      ipcMainHandlers[name] = fn;
    }),
  },
  shell: {
    openExternal: vi.fn(() => Promise.resolve()),
    showItemInFolder: vi.fn(),
  },
}));
vi.mock("node:fs", () => {
  const mock = {
    copyFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    lstatSync: vi.fn(() => ({ isDirectory: () => false })),
    mkdirSync: vi.fn(),
    promises: {
      mkdir: vi.fn(() => Promise.resolve()),
      readFile: vi.fn(() => Promise.resolve(Buffer.from("test"))),
      stat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
      writeFile: vi.fn(() => Promise.resolve()),
    },
    readdirSync: vi.fn(() => ["A1", "B2", "notakit"]),
    readFileSync: vi.fn(() => Buffer.from("test")),
    writeFileSync: vi.fn(),
  };
  return { ...mock, default: mock };
});
vi.mock("node:path", () => {
  const mock = {
    dirname: vi.fn(() => "/mock/dirname"),
    join: vi.fn((...args) => args.join("/")),
    resolve: vi.fn((...args) => args.join("/")),
  };
  return { ...mock, default: mock };
});

// Mock all the services
vi.mock("../services/settingsService.js", () => ({
  settingsService: {
    readSettings: vi.fn((settings) => settings),
    writeSetting: vi.fn(),
  },
}));

vi.mock("../services/localStoreService.js", () => ({
  localStoreService: {
    getLocalStoreStatus: vi.fn(() => ({ isValid: true })),
    listFilesInRoot: vi.fn(() =>
      Promise.resolve({ data: ["A0", "A1", "B0"], success: true }),
    ),
    validateExistingLocalStore: vi.fn(() => ({
      path: "/mock/store",
      success: true,
    })),
  },
}));

vi.mock("../services/localStoreSetupService.js", () => ({
  localStoreSetupService: {
    cancelSetup: vi.fn(),
    cleanupFailedSetup: vi.fn(() => ({ removed: false })),
    hasExistingLocalStore: vi.fn(() => ({ exists: true })),
    markSetupComplete: vi.fn(),
    setupSignal: new AbortController().signal,
    // Runs the work, as the real one does around recording what it created
    trackCreatedEntries: vi.fn((_target: string, work: () => unknown) =>
      Promise.resolve(work()),
    ),
  },
}));

vi.mock("../services/kitService.js", () => ({
  kitService: {
    copyKit: vi.fn(() => ({ success: true })),
    createKit: vi.fn(() => ({ success: true })),
  },
}));

vi.mock("../services/sampleService.js", () => ({
  sampleService: {
    getSampleAudioBuffer: vi.fn(async () => ({
      data: { bytes: new ArrayBuffer(1024), version: "v1" },
      success: true,
    })),
  },
}));

vi.mock("../services/sdCardSafety.js", () => ({
  getSdCardDialogDefaultPath: vi.fn(() => "/Volumes"),
}));

vi.mock("../services/archiveService.js", () => ({
  archiveService: {
    copyDirectory: vi.fn(() => Promise.resolve({ success: true })),
    downloadAndExtractArchive: vi.fn(() => Promise.resolve({ success: true })),
    ensureDirectory: vi.fn(() => ({ success: true })),
  },
  getFactorySamplesArchiveUrl: vi.fn(() => "https://factory.test/samples.zip"),
}));

// Path authorization is unit-tested in security/__tests__; here it is a
// switch so each guarded channel can be checked allowed and denied.
vi.mock("../security/pathAccess.js", () => ({
  checkSetupPathAccess: vi.fn(() => Promise.resolve({ ok: true })),
  pathAccess: {
    assertAllowed: vi.fn(() => Promise.resolve()),
    grantRead: vi.fn(() => Promise.resolve()),
    grantRoot: vi.fn(),
    useSettings: vi.fn(),
  },
}));

vi.mock("../security/localStoreAccessPrompt.js", () => ({
  requestLocalStoreAccess: vi.fn(() => Promise.resolve({ granted: true })),
}));

vi.mock("../db/utils/dbConnections.js", () => ({
  closeAllDbConnections: vi.fn(),
  setDatabaseMissingListener: vi.fn(),
}));

const DENIED = { error: "Access denied: outside granted folders", ok: false };

beforeEach(() => {
  Object.keys(ipcMainHandlers).forEach((k) => delete ipcMainHandlers[k]);
  vi.clearAllMocks();
});

describe("registerIpcHandlers", () => {
  it("registers read-settings and returns inMemorySettings", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    const inMemorySettings = { foo: "bar", localStorePath: null };
    registerIpcHandlers(inMemorySettings);
    const result = await ipcMainHandlers["read-settings"]();
    expect(result).toEqual(inMemorySettings);
  });

  it("registers write-settings and updates inMemorySettings", async () => {
    const { settingsService } = await import("../services/settingsService.js");
    const inMemorySettings: InMemorySettings = {
      foo: "bar",
      localStorePath: null,
    };

    // Mock writeSetting to actually modify the settings object
    vi.mocked(settingsService.writeSetting).mockImplementation(
      (settings, key, value) => {
        settings[key] = value;
      },
    );

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers(inMemorySettings);
    await ipcMainHandlers["write-settings"]({}, "baz", 42);
    expect(inMemorySettings.baz).toBe(42);
  });

  it("[Q-02] closes the old store's database when the local store changes (RE-81)", async () => {
    const { settingsService } = await import("../services/settingsService.js");
    const { closeAllDbConnections } =
      await import("../db/utils/dbConnections.js");
    vi.mocked(settingsService.writeSetting).mockImplementation(
      (settings, key, value) => {
        settings[key] = value;
      },
    );
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/stores/one" });

    await ipcMainHandlers["write-settings"](
      {},
      "localStorePath",
      "/stores/one",
    );
    await ipcMainHandlers["write-settings"]({}, "theme", "dark");
    expect(closeAllDbConnections).not.toHaveBeenCalled();

    await ipcMainHandlers["write-settings"](
      {},
      "localStorePath",
      "/stores/two",
    );
    expect(closeAllDbConnections).toHaveBeenCalledTimes(1);
  });

  it("registers open-external and opens https URLs in the system browser", async () => {
    const { shell } = await import("electron");
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["open-external"](
      {},
      "https://github.com/peteb4ker/romper",
    );

    expect(result).toEqual({ success: true });
    expect(shell.openExternal).toHaveBeenCalledWith(
      "https://github.com/peteb4ker/romper",
    );
  });

  it("[Q-07] open-external reports a link it couldn't open in its result, rather than rejecting (#472)", async () => {
    const { shell } = await import("electron");
    vi.mocked(shell.openExternal).mockRejectedValueOnce(
      new Error("No application is registered"),
    );
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    await expect(
      ipcMainHandlers["open-external"](
        {},
        "https://github.com/peteb4ker/romper",
      ),
    ).resolves.toEqual({
      error: "No application is registered",
      success: false,
    });
  });

  it("open-external refuses non-https and invalid URLs", async () => {
    const { shell } = await import("electron");
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const httpResult = await ipcMainHandlers["open-external"](
      {},
      "http://example.com",
    );
    expect(httpResult.success).toBe(false);

    const fileResult = await ipcMainHandlers["open-external"](
      {},
      "file:///etc/passwd",
    );
    expect(fileResult.success).toBe(false);

    const junkResult = await ipcMainHandlers["open-external"]({}, "not a url");
    expect(junkResult.success).toBe(false);

    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it("registers ensure-dir and creates directory", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });
    const result = await ipcMainHandlers["ensure-dir"]({}, "/mock/dir/romper");
    expect(result).toEqual({ success: true });
  });

  it("ensure-dir returns error on failure", async () => {
    const { archiveService } = await import("../services/archiveService.js");
    vi.mocked(archiveService.ensureDirectory).mockReturnValue({
      error: "fail",
      success: false,
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });
    const result = await ipcMainHandlers["ensure-dir"]({}, "/fail/dir");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/);
  });

  it("registers copy-dir and copies directory", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });
    const result = await ipcMainHandlers["copy-dir"](
      {},
      "/mock/src",
      "/mock/dest",
    );
    // copyRecursiveSync is called, but we can't spy directly; just check success
    expect(result).toEqual({ success: true });
  });

  it("copy-dir returns error on failure", async () => {
    const { archiveService } = await import("../services/archiveService.js");
    vi.mocked(archiveService.copyDirectory).mockResolvedValueOnce({
      error: "fail",
      success: false,
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });
    const result = await ipcMainHandlers["copy-dir"](
      {},
      "/fail/src",
      "/fail/dest",
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/);
  });

  it("registers get-local-store-status and returns status", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    const inMemorySettings = { localStorePath: "/mock/local/store" };
    registerIpcHandlers(inMemorySettings);

    const result = await ipcMainHandlers["get-local-store-status"]();
    expect(result).toBeDefined();
  });

  it("[Q-02] tells the renderer when the store's database file is missing (#535)", async () => {
    const { setDatabaseMissingListener } =
      await import("../db/utils/dbConnections.js");
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/local/store" });

    const listener = vi.mocked(setDatabaseMissingListener).mock.calls[0]?.[0];
    expect(listener).toBeTypeOf("function");
    listener?.("/mock/local/store/.romperdb");

    expect(mockWindowSend).toHaveBeenCalledWith("local-store-database-missing");
  });

  it("registers close-app and quits app", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    await ipcMainHandlers["close-app"]();
    const electron = await import("electron");
    expect(vi.mocked(electron.app.quit)).toHaveBeenCalled();
  });

  it("registers select-sd-card and returns selected path", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["select-sd-card"]();
    expect(result).toBe("/mock/sd");
  });

  it("select-sd-card opens the picker at the removable-volume folder, not the home folder", async () => {
    const electron = await import("electron");
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    await ipcMainHandlers["select-sd-card"]();
    expect(vi.mocked(electron.dialog.showOpenDialog)).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "/Volumes" }),
    );
  });

  it("select-sd-card returns null when cancelled", async () => {
    const electron = await import("electron");
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["select-sd-card"]();
    expect(result).toBeNull();
  });

  it("registers create-kit and returns success", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });

    expect(ipcMainHandlers["create-kit"]({}, "A0")).toEqual({
      success: true,
    });
  });

  it("create-kit returns the failure DbResult", async () => {
    const { kitService } = await import("../services/kitService.js");
    vi.mocked(kitService.createKit).mockReturnValue({
      error: "Create failed",
      success: false,
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });

    expect(ipcMainHandlers["create-kit"]({}, "A0")).toEqual({
      error: "Create failed",
      success: false,
    });
  });

  it("registers copy-kit and returns success", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });

    expect(ipcMainHandlers["copy-kit"]({}, "A0", "A1")).toEqual({
      success: true,
    });
  });

  it("copy-kit returns the failure DbResult", async () => {
    const { kitService } = await import("../services/kitService.js");
    vi.mocked(kitService.copyKit).mockReturnValue({
      error: "Copy failed",
      success: false,
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });

    expect(ipcMainHandlers["copy-kit"]({}, "A0", "A1")).toEqual({
      error: "Copy failed",
      success: false,
    });
  });

  it("registers list-files-in-root and returns file list", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["list-files-in-root"](
      {},
      "/mock/path",
    );
    expect(result).toEqual({ data: ["A0", "A1", "B0"], success: true });
  });

  it("registers get-sample-audio-buffer and returns buffer", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });

    const result = await ipcMainHandlers["get-sample-audio-buffer"](
      {},
      "A0",
      1,
      0,
    );
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      bytes: expect.any(ArrayBuffer),
      version: "v1",
    });
  });

  it("[Q-01] get-sample-audio-buffer passes on the version the renderer holds (#478)", async () => {
    const { sampleService } = await import("../services/sampleService.js");
    const { registerIpcHandlers } = await import("../ipcHandlers");
    const settings = { localStorePath: "/mock/store" };
    registerIpcHandlers(settings);

    await ipcMainHandlers["get-sample-audio-buffer"]({}, "A0", 1, 0, "v1");
    expect(sampleService.getSampleAudioBuffer).toHaveBeenLastCalledWith(
      settings,
      "A0",
      1,
      0,
      "v1",
    );
    // Anything but a string is no version
    await ipcMainHandlers["get-sample-audio-buffer"]({}, "A0", 1, 0, 42);
    expect(sampleService.getSampleAudioBuffer).toHaveBeenLastCalledWith(
      settings,
      "A0",
      1,
      0,
      undefined,
    );
  });

  it("get-sample-audio-buffer returns the failure DbResult", async () => {
    const { sampleService } = await import("../services/sampleService.js");
    vi.mocked(sampleService.getSampleAudioBuffer).mockResolvedValue({
      error: "Buffer failed",
      success: false,
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });

    await expect(
      ipcMainHandlers["get-sample-audio-buffer"]({}, "A0", 1, 0),
    ).resolves.toEqual({
      error: "Buffer failed",
      success: false,
    });
  });

  it("registers get-user-home-dir and returns home directory", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["get-user-home-dir"]();
    expect(typeof result).toBe("string");
  });

  it("registers select-local-store-path and returns selected path", async () => {
    const electron = await import("electron");
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/mock/local/store"],
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["select-local-store-path"]();
    expect(result).toBe("/mock/local/store");
  });

  it("[Q-07] select-local-store-path resolves to undefined when cancelled, as the contract says (#472)", async () => {
    const electron = await import("electron");
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["select-local-store-path"]();
    expect(result).toBeUndefined();
  });

  it("[UC-04] registers select-existing-local-store and validates path", async () => {
    const electron = await import("electron");
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/mock/existing/store"],
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["select-existing-local-store"]();
    expect(result).toBeDefined();
    expect(result.success).toBeDefined();
  });

  it("select-existing-local-store returns error when cancelled", async () => {
    const electron = await import("electron");
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["select-existing-local-store"]();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Selection cancelled");
  });

  it("registers download-and-extract-archive and handles success", async () => {
    const mockEvent = {
      sender: {
        send: vi.fn(),
      },
    };

    const progress = { percent: 50, phase: "Downloading" };
    const { archiveService } = await import("../services/archiveService.js");
    vi.mocked(archiveService.downloadAndExtractArchive).mockImplementation(
      (url, dest, callback) => {
        callback?.(progress); // Simulate progress
        return Promise.resolve({ success: true });
      },
    );

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["download-and-extract-archive"](
      mockEvent,
      "/mock/dest",
    );

    expect(result.success).toBe(true);
    // The archive URL comes from main, never from the renderer.
    expect(archiveService.downloadAndExtractArchive).toHaveBeenCalledWith(
      "https://factory.test/samples.zip",
      "/mock/dest",
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(mockEvent.sender.send).toHaveBeenCalledWith(
      "archive-progress",
      progress,
    );
  });

  it("download-and-extract-archive handles failure", async () => {
    const mockEvent = {
      sender: {
        send: vi.fn(),
      },
    };

    const { archiveService } = await import("../services/archiveService.js");
    vi.mocked(archiveService.downloadAndExtractArchive).mockResolvedValue({
      error: "Download failed",
      success: false,
    });

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["download-and-extract-archive"](
      mockEvent,
      "/mock/dest",
    );

    expect(result.success).toBe(false);
    expect(mockEvent.sender.send).toHaveBeenCalledWith("archive-error", {
      message: "Download failed",
    });
  });

  it("download-and-extract-archive handles exceptions", async () => {
    const mockEvent = {
      sender: {
        send: vi.fn(),
      },
    };

    const { archiveService } = await import("../services/archiveService.js");
    vi.mocked(archiveService.downloadAndExtractArchive).mockRejectedValue(
      new Error("Network error"),
    );

    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["download-and-extract-archive"](
      mockEvent,
      "/mock/dest",
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
    expect(mockEvent.sender.send).toHaveBeenCalledWith("archive-error", {
      message: "Network error",
    });
  });

  it("cleanup-partial-init goes through the setup guard with the configured store (RE-10)", async () => {
    const { localStoreSetupService } =
      await import("../services/localStoreSetupService.js");
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/configured/store" });

    const result = await ipcMainHandlers["cleanup-partial-init"](
      {},
      "/mock/target",
    );

    expect(localStoreSetupService.cleanupFailedSetup).toHaveBeenCalledWith(
      "/mock/target",
      "/configured/store",
    );
    expect(result).toEqual({ removed: false });
  });

  it("check-existing-local-store reports an existing store", async () => {
    const { localStoreSetupService } =
      await import("../services/localStoreSetupService.js");
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: null });

    const result = await ipcMainHandlers["check-existing-local-store"](
      {},
      "/mock/target",
    );

    expect(localStoreSetupService.hasExistingLocalStore).toHaveBeenCalledWith(
      "/mock/target",
    );
    expect(result).toEqual({ exists: true });
  });
});

describe("registerIpcHandlers - path authorization (RE-03)", () => {
  async function setup(settings: Record<string, unknown> = {}) {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers(settings as never);
    const access = await import("../security/pathAccess.js");
    return {
      assertAllowed: vi.mocked(access.pathAccess.assertAllowed),
      checkSetupPathAccess: vi.mocked(access.checkSetupPathAccess),
      grantRead: vi.mocked(access.pathAccess.grantRead),
      grantRoot: vi.mocked(access.pathAccess.grantRoot),
      useSettings: vi.mocked(access.pathAccess.useSettings),
    };
  }

  it("points the policy at the live settings object", async () => {
    const settings = { localStorePath: "/store" };
    const { useSettings } = await setup(settings);
    expect(useSettings).toHaveBeenCalledWith(settings);
  });

  it("ensure-dir checks write access and refuses a denied folder", async () => {
    const { archiveService } = await import("../services/archiveService.js");
    const { checkSetupPathAccess } = await setup();

    checkSetupPathAccess.mockResolvedValueOnce(DENIED);
    const denied = await ipcMainHandlers["ensure-dir"](
      {},
      "/Users/me/Library/LaunchAgents",
    );

    expect(checkSetupPathAccess).toHaveBeenCalledWith(
      "/Users/me/Library/LaunchAgents",
      { write: true },
    );
    expect(denied).toEqual({ error: DENIED.error, success: false });
    expect(archiveService.ensureDirectory).not.toHaveBeenCalled();
  });

  it("copy-dir needs read access to the source and write access to the destination", async () => {
    const { archiveService } = await import("../services/archiveService.js");
    const { checkSetupPathAccess } = await setup();

    await ipcMainHandlers["copy-dir"]({}, "/sd/A0", "/store/A0");
    expect(checkSetupPathAccess).toHaveBeenCalledWith("/sd/A0");
    expect(checkSetupPathAccess).toHaveBeenCalledWith("/store/A0", {
      write: true,
    });
    expect(archiveService.copyDirectory).toHaveBeenCalledWith(
      "/sd/A0",
      "/store/A0",
    );

    vi.mocked(archiveService.copyDirectory).mockClear();
    checkSetupPathAccess.mockResolvedValueOnce(DENIED); // source
    const deniedSource = await ipcMainHandlers["copy-dir"](
      {},
      "/Users/me/.ssh",
      "/store/A0",
    );
    expect(deniedSource.success).toBe(false);

    checkSetupPathAccess
      .mockResolvedValueOnce({ ok: true }) // source
      .mockResolvedValueOnce(DENIED); // destination
    const deniedDest = await ipcMainHandlers["copy-dir"](
      {},
      "/sd/A0",
      "/Users/me/Library/LaunchAgents",
    );
    expect(deniedDest.success).toBe(false);
    expect(archiveService.copyDirectory).not.toHaveBeenCalled();
  });

  it("check-path-writable refuses to write its probe outside the roots", async () => {
    const { checkSetupPathAccess } = await setup();
    checkSetupPathAccess.mockResolvedValueOnce(DENIED);
    const result = await ipcMainHandlers["check-path-writable"]({}, "/etc");
    expect(checkSetupPathAccess).toHaveBeenCalledWith("/etc", { write: true });
    expect(result).toEqual({ error: DENIED.error, writable: false });
  });

  it("check-disk-space needs read access", async () => {
    const { checkSetupPathAccess } = await setup();
    checkSetupPathAccess.mockResolvedValueOnce(DENIED);
    const result = await ipcMainHandlers["check-disk-space"]({}, "/etc", 100);
    expect(checkSetupPathAccess).toHaveBeenCalledWith("/etc");
    expect(result).toEqual({
      availableBytes: 0,
      error: DENIED.error,
      requiredBytes: 100,
      sufficient: false,
    });
  });

  it("cleanup-partial-init needs write access to the target", async () => {
    const { checkSetupPathAccess } = await setup();
    checkSetupPathAccess.mockResolvedValueOnce(DENIED);
    const { localStoreSetupService } =
      await import("../services/localStoreSetupService.js");
    const result = await ipcMainHandlers["cleanup-partial-init"]({}, "/other");
    expect(checkSetupPathAccess).toHaveBeenCalledWith("/other", {
      write: true,
    });
    expect(result).toEqual({ error: DENIED.error, removed: false });
    expect(localStoreSetupService.cleanupFailedSetup).not.toHaveBeenCalled();
  });

  it("[UC-01] finish-setup marks the built store finished (#616)", async () => {
    const { localStoreSetupService } =
      await import("../services/localStoreSetupService.js");
    const { checkSetupPathAccess } = await setup();

    const result = await ipcMainHandlers["finish-setup"]({}, "/store");

    expect(checkSetupPathAccess).toHaveBeenCalledWith("/store", {
      write: true,
    });
    expect(result).toEqual({ success: true });
    expect(localStoreSetupService.markSetupComplete).toHaveBeenCalledWith(
      "/store",
    );
  });

  it("finish-setup needs write access to the target", async () => {
    const { checkSetupPathAccess } = await setup();
    checkSetupPathAccess.mockResolvedValueOnce(DENIED);
    const { localStoreSetupService } =
      await import("../services/localStoreSetupService.js");

    const result = await ipcMainHandlers["finish-setup"]({}, "/other");

    expect(result).toEqual({ error: DENIED.error, success: false });
    expect(localStoreSetupService.markSetupComplete).not.toHaveBeenCalled();
  });

  it("check-existing-local-store needs read access and fails closed", async () => {
    const { checkSetupPathAccess } = await setup();
    checkSetupPathAccess.mockResolvedValueOnce(DENIED);
    const { localStoreSetupService } =
      await import("../services/localStoreSetupService.js");
    const result = await ipcMainHandlers["check-existing-local-store"](
      {},
      "/Users/me",
    );
    expect(checkSetupPathAccess).toHaveBeenCalledWith("/Users/me");
    // Can't confirm the folder is free, so the wizard is told to stop
    expect(result).toEqual({ error: DENIED.error, exists: true });
    expect(localStoreSetupService.hasExistingLocalStore).not.toHaveBeenCalled();
  });

  it("list-files-in-root checks read access before listing", async () => {
    const { localStoreService } =
      await import("../services/localStoreService.js");
    const { checkSetupPathAccess } = await setup();
    checkSetupPathAccess.mockResolvedValueOnce(DENIED);
    await expect(
      ipcMainHandlers["list-files-in-root"]({}, "/Users/me"),
    ).resolves.toEqual({ error: DENIED.error, success: false });
    expect(checkSetupPathAccess).toHaveBeenCalledWith("/Users/me");
    expect(localStoreService.listFilesInRoot).not.toHaveBeenCalled();
  });

  // [Q-03] read-file was guarded by checkSampleSourceAccess; the renderer
  // stopped using it, so the channel is gone rather than guarded.
  it("[Q-03] read-file is no longer registered", async () => {
    await setup({ localStorePath: "/store" });
    expect(ipcMainHandlers).not.toHaveProperty("read-file");
  });

  it("download-and-extract-archive refuses a denied destination without downloading", async () => {
    const { archiveService } = await import("../services/archiveService.js");
    const { checkSetupPathAccess } = await setup();
    const event = { sender: { send: vi.fn() } };
    checkSetupPathAccess.mockResolvedValueOnce(DENIED);

    const result = await ipcMainHandlers["download-and-extract-archive"](
      event,
      "/Users/me/Library/LaunchAgents",
    );

    expect(checkSetupPathAccess).toHaveBeenCalledWith(
      "/Users/me/Library/LaunchAgents",
      { write: true },
    );
    expect(result).toEqual({ error: DENIED.error, success: false });
    expect(event.sender.send).toHaveBeenCalledWith("archive-error", {
      message: DENIED.error,
    });
    expect(archiveService.downloadAndExtractArchive).not.toHaveBeenCalled();
  });

  it("write-settings refuses a path setting outside the roots", async () => {
    const { settingsService } = await import("../services/settingsService.js");
    const { assertAllowed } = await setup();
    assertAllowed.mockRejectedValueOnce(new Error(DENIED.error));
    await expect(
      ipcMainHandlers["write-settings"]({}, "localStorePath", "/elsewhere"),
    ).rejects.toThrow(DENIED.error);
    expect(assertAllowed).toHaveBeenCalledWith("/elsewhere", { write: true });
    expect(settingsService.writeSetting).not.toHaveBeenCalled();
  });

  it("write-settings checks sdCardPath but not other keys, and allows clearing", async () => {
    const { settingsService } = await import("../services/settingsService.js");
    const { assertAllowed } = await setup();

    await ipcMainHandlers["write-settings"](
      {},
      "sdCardPath",
      "/Volumes/RAMPLE",
    );
    expect(assertAllowed).toHaveBeenCalledWith("/Volumes/RAMPLE", {
      write: true,
    });

    assertAllowed.mockClear();
    await ipcMainHandlers["write-settings"]({}, "themeMode", "dark");
    await ipcMainHandlers["write-settings"]({}, "localStorePath", null);
    await ipcMainHandlers["write-settings"]({}, "sdCardPath", undefined);
    await ipcMainHandlers["write-settings"]({}, "sdCardPath", "");
    expect(assertAllowed).not.toHaveBeenCalled();
    expect(settingsService.writeSetting).toHaveBeenCalledTimes(5);
  });

  it("saving the local store marks its setup finished (RE-66)", async () => {
    const { localStoreSetupService } =
      await import("../services/localStoreSetupService.js");
    await setup();

    await ipcMainHandlers["write-settings"](
      {},
      "sdCardPath",
      "/Volumes/RAMPLE",
    );
    await ipcMainHandlers["write-settings"]({}, "localStorePath", null);
    expect(localStoreSetupService.markSetupComplete).not.toHaveBeenCalled();

    await ipcMainHandlers["write-settings"](
      {},
      "localStorePath",
      "/Users/me/store",
    );
    expect(localStoreSetupService.markSetupComplete).toHaveBeenCalledWith(
      "/Users/me/store",
    );
  });

  it("folder dialogs grant the picked folder as a root", async () => {
    const electron = await import("electron");
    const { grantRoot } = await setup();
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/picked"],
    });

    await ipcMainHandlers["select-sd-card"]();
    await ipcMainHandlers["select-local-store-path"]();
    await ipcMainHandlers["select-existing-local-store"]();

    expect(grantRoot).toHaveBeenCalledTimes(3);
    expect(grantRoot).toHaveBeenCalledWith("/picked");
  });

  it("cancelled folder dialogs grant nothing", async () => {
    const electron = await import("electron");
    const { grantRoot } = await setup();
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    await ipcMainHandlers["select-sd-card"]();
    await ipcMainHandlers["select-local-store-path"]();
    await ipcMainHandlers["select-existing-local-store"]();

    expect(grantRoot).not.toHaveBeenCalled();
  });

  it("register-dropped-file grants read access to the dropped file only", async () => {
    const { grantRead, grantRoot } = await setup();
    await ipcMainHandlers["register-dropped-file"]({}, "/Music/kick.wav");
    expect(grantRead).toHaveBeenCalledWith("/Music/kick.wav");
    expect(grantRoot).not.toHaveBeenCalled();
  });

  it("request-local-store-access delegates to main's confirmation prompt", async () => {
    const { requestLocalStoreAccess } =
      await import("../security/localStoreAccessPrompt.js");
    await setup();
    const sender = { id: 1 };
    const result = await ipcMainHandlers["request-local-store-access"](
      { sender },
      "/typed/romper",
    );
    expect(requestLocalStoreAccess).toHaveBeenCalledWith(
      sender,
      "/typed/romper",
    );
    expect(result).toEqual({ granted: true });
  });
});

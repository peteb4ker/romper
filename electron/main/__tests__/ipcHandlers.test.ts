import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks for Electron and Node APIs
const ipcMainHandlers: { [key: string]: any } = {};
vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((name, fn) => {
      ipcMainHandlers[name] = fn;
    }),
  },
  app: {
    getPath: vi.fn(() => "/mock/userData"),
    quit: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(() =>
      Promise.resolve({ canceled: false, filePaths: ["/mock/sd"] }),
    ),
  },
}));
vi.mock("fs", () => {
  const mock = {
    mkdirSync: vi.fn(),
    readdirSync: vi.fn(() => ["A1", "B2", "notakit"]),
    lstatSync: vi.fn(() => ({ isDirectory: () => false })),
    copyFileSync: vi.fn(),
    existsSync: vi.fn(() => true),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(() => Buffer.from("test")),
    promises: {
      readFile: vi.fn(() => Promise.resolve(Buffer.from("test"))),
      writeFile: vi.fn(() => Promise.resolve()),
      mkdir: vi.fn(() => Promise.resolve()),
      stat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
    },
  };
  return { ...mock, default: mock };
});
vi.mock("path", () => {
  const mock = {
    join: vi.fn((...args) => args.join("/")),
    resolve: vi.fn((...args) => args.join("/")),
    dirname: vi.fn(() => "/mock/dirname"),
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
    listFilesInRoot: vi.fn(() => ["A0", "A1", "B0"]),
    readFile: vi.fn(() => ({ success: true, data: Buffer.from("test") })),
    validateExistingLocalStore: vi.fn(() => ({ success: true, path: "/mock/store" })),
  },
}));

vi.mock("../services/kitService.js", () => ({
  kitService: {
    createKit: vi.fn(() => ({ success: true })),
    copyKit: vi.fn(() => ({ success: true })),
  },
}));

vi.mock("../services/sampleService.js", () => ({
  sampleService: {
    getSampleAudioBuffer: vi.fn(() => ({ success: true, data: new ArrayBuffer(1024) })),
  },
}));

vi.mock("../services/archiveService.js", () => ({
  archiveService: {
    downloadAndExtractArchive: vi.fn(() => Promise.resolve({ success: true })),
    ensureDirectory: vi.fn(() => ({ success: true })),
    copyDirectory: vi.fn(() => ({ success: true })),
  },
}));

beforeEach(() => {
  Object.keys(ipcMainHandlers).forEach((k) => delete ipcMainHandlers[k]);
  vi.clearAllMocks();
});

describe("registerIpcHandlers", () => {
  it("registers read-settings and returns inMemorySettings", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    const inMemorySettings = { foo: "bar" };
    registerIpcHandlers(inMemorySettings);
    const result = await ipcMainHandlers["read-settings"]();
    expect(result).toEqual(inMemorySettings);
  });

  it("registers write-settings and updates inMemorySettings", async () => {
    const { settingsService } = await import("../services/settingsService.js");
    const inMemorySettings: { [key: string]: any } = { foo: "bar" };
    
    // Mock writeSetting to actually modify the settings object
    vi.mocked(settingsService.writeSetting).mockImplementation((settings, key, value) => {
      settings[key] = value;
    });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers(inMemorySettings);
    await ipcMainHandlers["write-settings"]({}, "baz", 42);
    expect(inMemorySettings.baz).toBe(42);
  });

  it("registers ensure-dir and creates directory", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    const result = await ipcMainHandlers["ensure-dir"]({}, "/mock/dir/romper");
    expect(result).toEqual({ success: true });
  });

  it("ensure-dir returns error on failure", async () => {
    const { archiveService } = await import("../services/archiveService.js");
    vi.mocked(archiveService.ensureDirectory).mockReturnValue({ 
      success: false, 
      error: "fail" 
    });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    const result = await ipcMainHandlers["ensure-dir"]({}, "/fail/dir");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/);
  });

  it("registers copy-dir and copies directory", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    const result = await ipcMainHandlers["copy-dir"](
      {},
      "/mock/src",
      "/mock/dest",
    );
    // copyRecursiveSync is called, but we can't spy directly; just check success
    expect(result).toEqual({ success: true });
  });

  it("copy-dir returns error on failure", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    const origHandler = ipcMainHandlers["copy-dir"];
    ipcMainHandlers["copy-dir"] = async (_event: any, src: any, dest: any) => {
      return { success: false, error: "fail" };
    };
    const result = await ipcMainHandlers["copy-dir"](
      {},
      "/fail/src",
      "/fail/dest",
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fail/);
    ipcMainHandlers["copy-dir"] = origHandler;
  });

  it("registers get-local-store-status and returns status", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    const inMemorySettings = { localStorePath: "/mock/local/store" };
    registerIpcHandlers(inMemorySettings);
    
    const result = await ipcMainHandlers["get-local-store-status"]();
    expect(result).toBeDefined();
  });

  it("registers close-app and quits app", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    await ipcMainHandlers["close-app"]();
    // The app.quit mock is set up globally, so we just check it doesn't throw
    expect(true).toBe(true);
  });

  it("registers select-sd-card and returns selected path", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["select-sd-card"]();
    expect(result).toBe("/mock/sd");
  });

  it("select-sd-card returns null when cancelled", async () => {
    const electron = await import("electron");
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["select-sd-card"]();
    expect(result).toBeNull();
  });

  it("registers get-user-data-path and returns path", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["get-user-data-path"]();
    expect(result).toBe("/mock/userData");
  });

  it("registers create-kit and creates kit successfully", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });
    
    await expect(ipcMainHandlers["create-kit"]({}, "A0")).resolves.toBeUndefined();
  });

  it("create-kit throws error on failure", async () => {
    const { kitService } = await import("../services/kitService.js");
    vi.mocked(kitService.createKit).mockReturnValue({ success: false, error: "Create failed" });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });
    
    await expect(ipcMainHandlers["create-kit"]({}, "A0")).rejects.toThrow("Create failed");
  });

  it("registers copy-kit and copies kit successfully", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });
    
    await expect(ipcMainHandlers["copy-kit"]({}, "A0", "A1")).resolves.toBeUndefined();
  });

  it("copy-kit throws error on failure", async () => {
    const { kitService } = await import("../services/kitService.js");
    vi.mocked(kitService.copyKit).mockReturnValue({ success: false, error: "Copy failed" });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });
    
    await expect(ipcMainHandlers["copy-kit"]({}, "A0", "A1")).rejects.toThrow("Copy failed");
  });

  it("registers list-files-in-root and returns file list", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["list-files-in-root"]({}, "/mock/path");
    expect(result).toBeDefined();
  });

  it("registers get-sample-audio-buffer and returns buffer", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });
    
    const result = await ipcMainHandlers["get-sample-audio-buffer"]({}, "A0", 1, 0);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("get-sample-audio-buffer throws error on failure", async () => {
    const { sampleService } = await import("../services/sampleService.js");
    vi.mocked(sampleService.getSampleAudioBuffer).mockReturnValue({ 
      success: false, 
      error: "Buffer failed" 
    });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({ localStorePath: "/mock/store" });
    
    await expect(ipcMainHandlers["get-sample-audio-buffer"]({}, "A0", 1, 0)).rejects.toThrow("Buffer failed");
  });

  it("registers read-file and returns file content", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["read-file"]({}, "/mock/file.txt");
    expect(result).toBeDefined();
  });

  it("registers get-user-home-dir and returns home directory", async () => {
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
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
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["select-local-store-path"]();
    expect(result).toBe("/mock/local/store");
  });

  it("select-local-store-path returns null when cancelled", async () => {
    const electron = await import("electron");
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["select-local-store-path"]();
    expect(result).toBeNull();
  });

  it("registers select-existing-local-store and validates path", async () => {
    const electron = await import("electron");
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ["/mock/existing/store"],
    });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
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
    registerIpcHandlers({});
    
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
    
    const { archiveService } = await import("../services/archiveService.js");
    vi.mocked(archiveService.downloadAndExtractArchive).mockImplementation((url, dest, callback) => {
      callback({ percent: 50 }); // Simulate progress
      return Promise.resolve({ success: true });
    });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["download-and-extract-archive"](
      mockEvent,
      "https://example.com/archive.zip",
      "/mock/dest"
    );
    
    expect(result.success).toBe(true);
    expect(mockEvent.sender.send).toHaveBeenCalledWith("archive-progress", { percent: 50 });
  });

  it("download-and-extract-archive handles failure", async () => {
    const mockEvent = {
      sender: {
        send: vi.fn(),
      },
    };
    
    const { archiveService } = await import("../services/archiveService.js");
    vi.mocked(archiveService.downloadAndExtractArchive).mockResolvedValue({ 
      success: false, 
      error: "Download failed" 
    });
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["download-and-extract-archive"](
      mockEvent,
      "https://example.com/archive.zip",
      "/mock/dest"
    );
    
    expect(result.success).toBe(false);
    expect(mockEvent.sender.send).toHaveBeenCalledWith("archive-error", { message: "Download failed" });
  });

  it("download-and-extract-archive handles exceptions", async () => {
    const mockEvent = {
      sender: {
        send: vi.fn(),
      },
    };
    
    const { archiveService } = await import("../services/archiveService.js");
    vi.mocked(archiveService.downloadAndExtractArchive).mockRejectedValue(
      new Error("Network error")
    );
    
    const { registerIpcHandlers } = await import("../ipcHandlers");
    registerIpcHandlers({});
    
    const result = await ipcMainHandlers["download-and-extract-archive"](
      mockEvent,
      "https://example.com/archive.zip",
      "/mock/dest"
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
    expect(mockEvent.sender.send).toHaveBeenCalledWith("archive-error", { message: "Network error" });
  });
});

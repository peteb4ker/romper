import { beforeEach, describe, expect, it, vi } from "vitest";

// Create mocks that will be used by all tests
const mockContextBridge = { exposeInMainWorld: vi.fn() };
const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
  removeListener: vi.fn(),
};
const mockWebUtils = { getPathForFile: vi.fn() };

const mockElectron = {
  default: {
    contextBridge: mockContextBridge,
    ipcRenderer: mockIpcRenderer,
    webUtils: mockWebUtils,
  },
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
  webUtils: mockWebUtils,
};

// Mock electron module (both require and import styles)
vi.mock("electron", () => mockElectron);
vi.doMock("electron", () => mockElectron);

vi.mock("../../shared/db/types.js", () => ({
  Kit: {},
  NewKit: {},
  NewSample: {},
}));

describe("preload/index.tsx", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Set up module cache mock before importing
    const Module = require("module");
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function (id: string) {
      if (id === "electron") {
        return mockElectron;
      }
      return originalRequire.apply(this, arguments);
    };

    // Mock global window for menuEventForwarder
    global.window = {
      dispatchEvent: vi.fn(),
    } as any;
  });

  it("exposes romperEnv in main world", async () => {
    await import("../index");
    expect(mockElectron.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "romperEnv",
      {
        ROMPER_SDCARD_PATH: process.env.ROMPER_SDCARD_PATH,
        ROMPER_LOCAL_PATH: process.env.ROMPER_LOCAL_PATH,
        ROMPER_SQUARP_ARCHIVE_URL: process.env.ROMPER_SQUARP_ARCHIVE_URL,
      },
    );
  });

  it("exposes electronAPI in main world with all required methods", async () => {
    await import("../index");
    expect(mockElectron.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "electronAPI",
      expect.objectContaining({
        selectSdCard: expect.any(Function),
        getSetting: expect.any(Function),
        setSetting: expect.any(Function),
        readSettings: expect.any(Function),
        getLocalStoreStatus: expect.any(Function),
        createKit: expect.any(Function),
        copyKit: expect.any(Function),
        listFilesInRoot: expect.any(Function),
        closeApp: expect.any(Function),
        playSample: expect.any(Function),
        stopSample: expect.any(Function),
        onSamplePlaybackEnded: expect.any(Function),
        onSamplePlaybackError: expect.any(Function),
        getSampleAudioBuffer: expect.any(Function),
        readFile: expect.any(Function),
        getKit: expect.any(Function),
        updateKit: expect.any(Function),
        getKits: expect.any(Function),
        updateVoiceAlias: expect.any(Function),
        updateStepPattern: expect.any(Function),
        getUserHomeDir: expect.any(Function),
        selectLocalStorePath: expect.any(Function),
        downloadAndExtractArchive: expect.any(Function),
        ensureDir: expect.any(Function),
        copyDir: expect.any(Function),
        createRomperDb: expect.any(Function),
        insertKit: expect.any(Function),
        insertSample: expect.any(Function),
        validateLocalStore: expect.any(Function),
        validateLocalStoreBasic: expect.any(Function),
        getAllSamples: expect.any(Function),
        getAllSamplesForKit: expect.any(Function),
        rescanKit: expect.any(Function),
        getAllBanks: expect.any(Function),
        scanBanks: expect.any(Function),
        selectExistingLocalStore: expect.any(Function),
        addSampleToSlot: expect.any(Function),
        replaceSampleInSlot: expect.any(Function),
        deleteSampleFromSlot: expect.any(Function),
        validateSampleSources: expect.any(Function),
        validateSampleFormat: expect.any(Function),
      }),
    );
  });

  it("exposes electronFileAPI in main world", async () => {
    await import("../index");
    expect(mockElectron.contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "electronFileAPI",
      expect.objectContaining({
        getDroppedFilePath: expect.any(Function),
      }),
    );
  });

  it("initializes menu event forwarding", async () => {
    await import("../index");
    // Check that ipcRenderer.on was called to set up event listeners
    expect(mockElectron.ipcRenderer.on).toHaveBeenCalled();
    // Check for specific menu events
    expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith(
      "menu-scan-all-kits",
      expect.any(Function),
    );
  });

  it("delegates settings operations to settingsManager", async () => {
    await import("../index");

    const electronAPICall =
      mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
        (call) => call[0] === "electronAPI",
      );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];

    // Mock the IPC responses that the SettingsManager will call
    mockElectron.ipcRenderer.invoke.mockImplementation((channel) => {
      if (channel === "read-settings") {
        return Promise.resolve({ testKey: "test-value" });
      }
      if (channel === "write-settings") {
        return Promise.resolve();
      }
      return Promise.resolve();
    });

    // Test getSetting - should call read-settings via IPC
    const result = await api.getSetting("testKey");
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
      "read-settings",
    );
    expect(result).toBe("test-value");

    // Test setSetting - should call write-settings via IPC
    await api.setSetting("testKey", "test-value");
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
      "write-settings",
      "testKey",
      "test-value",
    );

    // Test readSettings - should call read-settings via IPC
    const settings = await api.readSettings();
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
      "read-settings",
    );
    expect(settings).toEqual({ testKey: "test-value" });
  });

  it("handles getDroppedFilePath with webUtils", async () => {
    await import("../index");

    const fileApi =
      mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
        (c) => c[0] === "electronFileAPI",
      )?.[1];

    const file = new File([], "test.wav");
    mockElectron.webUtils.getPathForFile.mockResolvedValue(
      "/mock/path/test.wav",
    );

    const result = await fileApi.getDroppedFilePath(file);
    expect(mockElectron.webUtils.getPathForFile).toHaveBeenCalledWith(file);
    expect(result).toBe("/mock/path/test.wav");
  });

  it("handles getDroppedFilePath error when webUtils unavailable", async () => {
    // Override the module require mock to return null webUtils
    const Module = require("module");
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function (id: string) {
      if (id === "electron") {
        return {
          ...mockElectron,
          webUtils: null,
        };
      }
      return originalRequire.apply(this, arguments);
    };

    vi.resetModules();
    await import("../index");

    const fileApi =
      mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
        (c) => c[0] === "electronFileAPI",
      )?.[1];

    await expect(fileApi.getDroppedFilePath({})).rejects.toThrow(
      "webUtils.getPathForFile is not available.",
    );
  });

  it("forwards IPC calls for basic operations", async () => {
    await import("../index");

    const electronAPICall =
      mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
        (call) => call[0] === "electronAPI",
      );
    const api = electronAPICall[1];

    // Test a few key IPC operations
    mockElectron.ipcRenderer.invoke.mockResolvedValue("mock-result");

    await api.selectSdCard();
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
      "select-sd-card",
    );

    await api.getLocalStoreStatus();
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
      "get-local-store-status",
    );

    await api.createKit("A01");
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
      "create-kit",
      "A01",
    );
  });

  it("logs preload script completion", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../index");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Preload script updated and loaded",
    );

    consoleSpy.mockRestore();
  });

  describe("SettingsManager", () => {
    it("returns environment variable for localStorePath in getSetting", async () => {
      process.env.ROMPER_LOCAL_PATH = "/env/test/path";

      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      const result = await api.getSetting("localStorePath");
      expect(result).toBe("/env/test/path");

      delete process.env.ROMPER_LOCAL_PATH;
    });

    it("returns environment variable in readSettings when settings read fails", async () => {
      process.env.ROMPER_LOCAL_PATH = "/env/fallback/path";

      // Mock console.error to avoid test noise
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockElectron.ipcRenderer.invoke.mockImplementation((channel) => {
        if (channel === "read-settings") {
          throw new Error("Failed to read settings");
        }
        return Promise.resolve();
      });

      vi.resetModules();
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      const result = await api.readSettings();
      expect(result).toEqual({ localStorePath: "/env/fallback/path" });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to read settings:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
      delete process.env.ROMPER_LOCAL_PATH;
    });

    it("handles setSetting write errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockElectron.ipcRenderer.invoke.mockImplementation((channel) => {
        if (channel === "write-settings") {
          throw new Error("Write failed");
        }
        return Promise.resolve();
      });

      vi.resetModules();
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      // Should not throw, but should log error
      await api.setSetting("testKey", "testValue");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to write settings:",
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it("handles JSON parsing in readSettings", async () => {
      mockElectron.ipcRenderer.invoke.mockImplementation((channel) => {
        if (channel === "read-settings") {
          return Promise.resolve('{"testKey": "jsonValue"}');
        }
        return Promise.resolve();
      });

      vi.resetModules();
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      const result = await api.readSettings();
      expect(result).toEqual({ testKey: "jsonValue" });
    });
  });

  describe("MenuEventForwarder", () => {
    it("dispatches DOM events when IPC events are received", async () => {
      await import("../index");

      // Get the callback function that was registered for the menu-scan-all-kits event
      const scanAllKitsCall = mockElectron.ipcRenderer.on.mock.calls.find(
        (call) => call[0] === "menu-scan-all-kits",
      );
      expect(scanAllKitsCall).toBeDefined();

      const callback = scanAllKitsCall[1];

      // Clear previous calls to dispatchEvent
      vi.clearAllMocks();

      // Trigger the callback
      callback();

      // Check that a DOM event was dispatched
      expect(global.window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "menu-scan-all-kits",
        }),
      );
    });

    it("sets up event listeners for all menu events", async () => {
      await import("../index");

      const expectedEvents = [
        "menu-scan-all-kits",
        "menu-scan-banks",
        "menu-validate-database",
        "menu-setup-local-store",
        "menu-change-local-store-directory",
        "menu-preferences",
        "menu-about",
      ];

      expectedEvents.forEach((event) => {
        expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith(
          event,
          expect.any(Function),
        );
      });
    });
  });

  describe("electronAPI event listeners", () => {
    it("sets up onSamplePlaybackEnded listener correctly", async () => {
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      const callback = vi.fn();

      api.onSamplePlaybackEnded(callback);

      expect(mockElectron.ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "sample-playback-ended",
      );
      expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith(
        "sample-playback-ended",
        callback,
      );
    });

    it("sets up onSamplePlaybackError listener correctly", async () => {
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      const callback = vi.fn();

      api.onSamplePlaybackError(callback);

      expect(mockElectron.ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "sample-playback-error",
      );
      expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith(
        "sample-playback-error",
        expect.any(Function),
      );
    });

    it("sets up downloadAndExtractArchive progress listeners", async () => {
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      const onProgress = vi.fn();
      const onError = vi.fn();

      mockElectron.ipcRenderer.invoke.mockResolvedValue("success");

      await api.downloadAndExtractArchive(
        "http://test.com",
        "/dest",
        onProgress,
        onError,
      );

      expect(mockElectron.ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "archive-progress",
      );
      expect(mockElectron.ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "archive-error",
      );
      expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith(
        "archive-progress",
        expect.any(Function),
      );
      expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith(
        "archive-error",
        expect.any(Function),
      );
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        "download-and-extract-archive",
        "http://test.com",
        "/dest",
      );
    });

    it("sets up onSyncProgress listener correctly", async () => {
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      const callback = vi.fn();

      api.onSyncProgress(callback);

      expect(mockElectron.ipcRenderer.removeAllListeners).toHaveBeenCalledWith(
        "sync-progress",
      );
      expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith(
        "sync-progress",
        expect.any(Function),
      );
    });
  });

  describe("electronAPI method coverage", () => {
    it("forwards sample operations correctly", async () => {
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      mockElectron.ipcRenderer.invoke.mockResolvedValue("success");

      await api.addSampleToSlot("testKit", 1, 0, "/path/to/sample.wav", {
        forceMono: true,
      });
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        "add-sample-to-slot",
        "testKit",
        1,
        0,
        "/path/to/sample.wav",
        { forceMono: true },
      );

      await api.replaceSampleInSlot("testKit", 1, 0, "/path/to/sample.wav");
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        "replace-sample-in-slot",
        "testKit",
        1,
        0,
        "/path/to/sample.wav",
        undefined,
      );

      await api.deleteSampleFromSlot("testKit", 1, 0);
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        "delete-sample-from-slot",
        "testKit",
        1,
        0,
      );
    });

    it("forwards sync operations correctly", async () => {
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      mockElectron.ipcRenderer.invoke.mockResolvedValue("success");

      await api.generateSyncChangeSummary();
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        "generateSyncChangeSummary",
      );

      const syncData = { filesToCopy: [], filesToConvert: [] };
      await api.startKitSync(syncData);
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        "startKitSync",
        syncData,
      );

      await api.cancelKitSync();
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        "cancelKitSync",
      );
    });

    it("forwards audio operations correctly", async () => {
      await import("../index");

      const electronAPICall =
        mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
          (call) => call[0] === "electronAPI",
        );
      const api = electronAPICall[1];

      mockElectron.ipcRenderer.invoke.mockResolvedValue("success");

      await api.getAudioMetadata("/path/to/file.wav");
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        "get-audio-metadata",
        "/path/to/file.wav",
      );

      await api.validateSampleFormat("/path/to/file.wav");
      expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
        "validate-sample-format",
        "/path/to/file.wav",
      );
    });
  });
});

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
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function(id: string) {
      if (id === 'electron') {
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
    expect(mockElectron.ipcRenderer.on).toHaveBeenCalledWith("menu-scan-all-kits", expect.any(Function));
  });

  it("delegates settings operations to settingsManager", async () => {
    await import("../index");

    const electronAPICall = mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];

    // Mock the IPC responses that the SettingsManager will call
    mockElectron.ipcRenderer.invoke.mockImplementation((channel, ...args) => {
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
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("read-settings");
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
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("read-settings");
    expect(settings).toEqual({ testKey: "test-value" });
  });

  it("handles getDroppedFilePath with webUtils", async () => {
    await import("../index");

    const fileApi = mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
      (c) => c[0] === "electronFileAPI",
    )?.[1];

    const file = new File([], "test.wav");
    mockElectron.webUtils.getPathForFile.mockResolvedValue("/mock/path/test.wav");

    const result = await fileApi.getDroppedFilePath(file);
    expect(mockElectron.webUtils.getPathForFile).toHaveBeenCalledWith(file);
    expect(result).toBe("/mock/path/test.wav");
  });

  it("handles getDroppedFilePath error when webUtils unavailable", async () => {
    // Override the module require mock to return null webUtils
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    Module.prototype.require = function(id: string) {
      if (id === 'electron') {
        return {
          ...mockElectron,
          webUtils: null,
        };
      }
      return originalRequire.apply(this, arguments);
    };

    vi.resetModules();
    await import("../index");

    const fileApi = mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
      (c) => c[0] === "electronFileAPI",
    )?.[1];

    await expect(fileApi.getDroppedFilePath({})).rejects.toThrow(
      "webUtils.getPathForFile is not available.",
    );
  });

  it("forwards IPC calls for basic operations", async () => {
    await import("../index");

    const electronAPICall = mockElectron.contextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    const api = electronAPICall[1];

    // Test a few key IPC operations
    mockElectron.ipcRenderer.invoke.mockResolvedValue("mock-result");

    await api.selectSdCard();
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("select-sd-card");

    await api.getLocalStoreStatus();
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith(
      "get-local-store-status",
    );

    await api.createKit("A01");
    expect(mockElectron.ipcRenderer.invoke).toHaveBeenCalledWith("create-kit", "A01");
  });

  it("logs preload script completion", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../index");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Preload script updated and loaded",
    );

    consoleSpy.mockRestore();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock electron with proper isolation
vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    removeListener: vi.fn(),
  },
  webUtils: { getPathForFile: vi.fn() },
}));

// Define mock objects at module scope for access in tests
let mockContextBridge: { exposeInMainWorld: ReturnType<typeof vi.fn> };
let mockIpcRenderer: {
  invoke: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
};
let mockWebUtils: { getPathForFile: ReturnType<typeof vi.fn> };
let mockSettingsManager: {
  getSetting: ReturnType<typeof vi.fn>;
  setSetting: ReturnType<typeof vi.fn>;
  readSettings: ReturnType<typeof vi.fn>;
};
let mockMenuEventForwarder: {
  initialize: ReturnType<typeof vi.fn>;
};

vi.mock("./settingsManager", () => {
  mockSettingsManager = {
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    readSettings: vi.fn(),
  };
  return {
    settingsManager: mockSettingsManager,
  };
});

vi.mock("./menuEventForwarding", () => {
  mockMenuEventForwarder = {
    initialize: vi.fn(),
  };
  return {
    menuEventForwarder: mockMenuEventForwarder,
  };
});

vi.mock("../../shared/db/types.js", () => ({
  Kit: {},
  NewKit: {},
  NewSample: {},
}));

describe.skip("preload/index.tsx", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Get fresh references to the mocked electron module
    const electron = (await vi.importMock("electron")) as any;
    mockContextBridge = electron.contextBridge;
    mockIpcRenderer = electron.ipcRenderer;
    mockWebUtils = electron.webUtils;
  });

  it("exposes romperEnv in main world", async () => {
    await import("../index");
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
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
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
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
      }),
    );
  });

  it("exposes electronFileAPI in main world", async () => {
    await import("../index");
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "electronFileAPI",
      expect.objectContaining({
        getDroppedFilePath: expect.any(Function),
      }),
    );
  });

  it("initializes menu event forwarding", async () => {
    await import("../index");
    expect(mockMenuEventForwarder.initialize).toHaveBeenCalled();
  });

  it("delegates settings operations to settingsManager", async () => {
    await import("../index");

    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];

    // Test getSetting delegation
    mockSettingsManager.getSetting.mockResolvedValue("test-value");
    const result = await api.getSetting("testKey");
    expect(mockSettingsManager.getSetting).toHaveBeenCalledWith("testKey");
    expect(result).toBe("test-value");

    // Test setSetting delegation
    await api.setSetting("testKey", "test-value");
    expect(mockSettingsManager.setSetting).toHaveBeenCalledWith(
      "testKey",
      "test-value",
    );

    // Test readSettings delegation
    mockSettingsManager.readSettings.mockResolvedValue({ test: "settings" });
    const settings = await api.readSettings();
    expect(mockSettingsManager.readSettings).toHaveBeenCalled();
    expect(settings).toEqual({ test: "settings" });
  });

  it("handles getDroppedFilePath with webUtils", async () => {
    await import("../index");

    const fileApi = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (c) => c[0] === "electronFileAPI",
    )?.[1];

    const file = new File([], "test.wav");
    mockWebUtils.getPathForFile.mockResolvedValue("/mock/path/test.wav");

    const result = await fileApi.getDroppedFilePath(file);
    expect(mockWebUtils.getPathForFile).toHaveBeenCalledWith(file);
    expect(result).toBe("/mock/path/test.wav");
  });

  it("handles getDroppedFilePath error when webUtils unavailable", async () => {
    // Mock webUtils as null to test error path
    vi.doMock("electron", () => ({
      contextBridge: mockContextBridge,
      ipcRenderer: mockIpcRenderer,
      webUtils: null,
    }));

    vi.resetModules();
    await import("../index");

    const fileApi = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (c) => c[0] === "electronFileAPI",
    )?.[1];

    await expect(fileApi.getDroppedFilePath({})).rejects.toThrow(
      "webUtils.getPathForFile is not available.",
    );
  });

  it("forwards IPC calls for basic operations", async () => {
    await import("../index");

    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    const api = electronAPICall[1];

    // Test a few key IPC operations
    mockIpcRenderer.invoke.mockResolvedValue("mock-result");

    await api.selectSdCard();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("select-sd-card");

    await api.getLocalStoreStatus();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "get-local-store-status",
    );

    await api.createKit("A01");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("create-kit", "A01");
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

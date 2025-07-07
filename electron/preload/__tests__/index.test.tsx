import { beforeEach, describe, expect, it, vi } from "vitest";

// Define mock objects at module scope for access in tests
let mockContextBridge: { exposeInMainWorld: ReturnType<typeof vi.fn> };
let mockIpcRenderer: {
  invoke: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
};
let mockWebUtils: { getPathForFile: ReturnType<typeof vi.fn> };

vi.mock("electron", () => {
  mockContextBridge = { exposeInMainWorld: vi.fn() };
  mockIpcRenderer = {
    invoke: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    removeListener: vi.fn(),
  };
  mockWebUtils = { getPathForFile: vi.fn() };
  return {
    contextBridge: mockContextBridge,
    ipcRenderer: mockIpcRenderer,
    webUtils: mockWebUtils,
  };
});

describe("preload/index.tsx", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("exposes electronAPI in main world", async () => {
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
        getAudioBuffer: expect.any(Function),
        getKitMetadata: expect.any(Function),
        updateKitMetadata: expect.any(Function),
        getAllKits: expect.any(Function),
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

  it("calls webUtils.getPathForFile for getDroppedFilePath", async () => {
    await import("../index");
    // Find the call for electronFileAPI
    const fileApi = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (c) => c[0] === "electronFileAPI",
    )?.[1];
    const file = {};
    mockWebUtils.getPathForFile.mockResolvedValue("/mock/path");
    const result = await fileApi.getDroppedFilePath(file);
    expect(mockWebUtils.getPathForFile).toHaveBeenCalledWith(file);
    expect(result).toBe("/mock/path");
  });

  it("exposes getUserHomeDir and returns a string", async () => {
    await import("../index");
    // Fix: ensure get-user-home-dir returns a string
    mockIpcRenderer.invoke.mockImplementation((channel) => {
      if (channel === "get-user-home-dir") return Promise.resolve("/mock/home");
      return Promise.resolve([]);
    });
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    expect(typeof api.getUserHomeDir).toBe("function");
    const homeDirPromise = api.getUserHomeDir();
    expect(homeDirPromise).toBeInstanceOf(Promise);
    const homeDir = await homeDirPromise;
    // Debug log
    console.log(
      "DEBUG getUserHomeDir resolved value:",
      homeDir,
      typeof homeDir,
    );
    expect(typeof homeDir).toBe("string");
    expect(homeDir.length).toBeGreaterThan(0);
  });

  it("handles error in getDroppedFilePath gracefully", async () => {
    await import("../index");
    const fileApi = mockContextBridge.exposeInMainWorld.mock?.calls.find(
      (c) => c[0] === "electronFileAPI",
    )?.[1];
    mockWebUtils.getPathForFile.mockRejectedValue(new Error("fail"));
    await expect(fileApi.getDroppedFilePath({})).rejects.toThrow("fail");
  });

  it("calls ipcRenderer.invoke for getSetting and setSetting", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue(JSON.stringify({ foo: "bar" }));
    const value = await api.getSetting("foo");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("read-settings");
    expect(value).toBe("bar");
    await api.setSetting("foo", "baz");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "write-settings",
      "foo",
      "baz",
    );
  });

  it("calls ipcRenderer.invoke for readSettings and handles error", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue('{"foo":"bar"}');
    const settings = await api.readSettings();
    expect(settings).toEqual({ foo: "bar" });
    mockIpcRenderer.invoke.mockRejectedValue(new Error("fail"));
    const errorSettings = await api.readSettings();
    expect(errorSettings).toEqual({});
  });

  it("calls ipcRenderer.invoke for ensureDir", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    const result = await api.ensureDir("/mock/dir/romper");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "ensure-dir",
      "/mock/dir/romper",
    );
    expect(result).toEqual({ success: true });
  });

  it("calls ipcRenderer.invoke for selectSdCard", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue("/mock/sd/path");
    const result = await api.selectSdCard();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("select-sd-card");
    expect(result).toBe("/mock/sd/path");
  });

  it("calls ipcRenderer.invoke for createKit", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue();
    await api.createKit("/mock/sd", "A01");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "create-kit",
      "/mock/sd",
      "A01",
    );
  });

  it("calls ipcRenderer.invoke for copyKit", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue();
    await api.copyKit("/mock/sd", "A01", "A02");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "copy-kit",
      "/mock/sd",
      "A01",
      "A02",
    );
  });

  it("calls ipcRenderer.invoke for listFilesInRoot", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue(["file1.wav", "file2.wav"]);
    const result = await api.listFilesInRoot("/mock/sd");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "list-files-in-root",
      "/mock/sd",
    );
    expect(result).toEqual(["file1.wav", "file2.wav"]);
  });

  it("calls ipcRenderer.invoke for playSample", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue();
    await api.playSample("/mock/sample.wav");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "play-sample",
      "/mock/sample.wav",
    );
  });

  it("calls ipcRenderer.invoke for stopSample", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue();
    await api.stopSample();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith("stop-sample");
  });

  it("registers onSamplePlaybackEnded listener", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    const callback = vi.fn();
    api.onSamplePlaybackEnded(callback);
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith(
      "sample-playback-ended",
    );
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      "sample-playback-ended",
      callback,
    );
  });

  it("registers onSamplePlaybackError listener with event wrapper", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    const callback = vi.fn();
    api.onSamplePlaybackError(callback);
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith(
      "sample-playback-error",
    );
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      "sample-playback-error",
      expect.any(Function),
    );

    // Test the wrapper function that extracts error message from event
    const onCall = mockIpcRenderer.on.mock.calls.find(
      (call) => call[0] === "sample-playback-error",
    );
    const wrappedCallback = onCall[1];
    wrappedCallback({}, "error message");
    expect(callback).toHaveBeenCalledWith("error message");
  });

  it("calls ipcRenderer.invoke for getAudioBuffer", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    const mockBuffer = new ArrayBuffer(1024);
    mockIpcRenderer.invoke.mockResolvedValue(mockBuffer);
    const result = await api.getAudioBuffer("/mock/sample.wav");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "get-audio-buffer",
      "/mock/sample.wav",
    );
    expect(result).toBe(mockBuffer);
  });

  it("calls ipcRenderer.invoke for selectLocalStorePath", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue("/mock/local/store");
    const result = await api.selectLocalStorePath();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "select-local-store-path",
    );
    expect(result).toBe("/mock/local/store");
  });

  it("handles downloadAndExtractArchive with progress and error callbacks", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    const onProgress = vi.fn();
    const onError = vi.fn();

    mockIpcRenderer.invoke.mockResolvedValue({ success: true });

    const result = await api.downloadAndExtractArchive(
      "https://example.com/archive.zip",
      "/mock/dest",
      onProgress,
      onError,
    );

    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "download-and-extract-archive",
      "https://example.com/archive.zip",
      "/mock/dest",
    );
    expect(result).toEqual({ success: true });

    // Verify progress listener was registered
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      "archive-progress",
      expect.any(Function),
    );
    // Verify error listener was registered
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      "archive-error",
      expect.any(Function),
    );
  });

  it("handles downloadAndExtractArchive without callbacks", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];

    mockIpcRenderer.invoke.mockResolvedValue({ success: true });

    const result = await api.downloadAndExtractArchive(
      "https://example.com/archive.zip",
      "/mock/dest",
    );

    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "download-and-extract-archive",
      "https://example.com/archive.zip",
      "/mock/dest",
    );
    expect(result).toEqual({ success: true });
  });

  it("handles downloadAndExtractArchive error and cleans up listeners", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    const onProgress = vi.fn();
    const onError = vi.fn();

    mockIpcRenderer.invoke.mockRejectedValue(new Error("Download failed"));

    await expect(
      api.downloadAndExtractArchive(
        "https://example.com/archive.zip",
        "/mock/dest",
        onProgress,
        onError,
      ),
    ).rejects.toThrow("Download failed");

    // Verify listeners were set up
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith(
      "archive-progress",
    );
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledWith(
      "archive-error",
    );
  });

  it("calls ipcRenderer.invoke for copyDir", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    const result = await api.copyDir("/mock/src", "/mock/dest");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "copy-dir",
      "/mock/src",
      "/mock/dest",
    );
    expect(result).toEqual({ success: true });
  });

  it("calls ipcRenderer.invoke for createRomperDb", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    const result = await api.createRomperDb("/mock/db/dir");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "create-romper-db",
      "/mock/db/dir",
    );
    expect(result).toEqual({ success: true });
  });

  it("calls ipcRenderer.invoke for insertKit", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    const kit = {
      name: "Test Kit",
      alias: "TK",
      artist: "Test Artist",
      plan_enabled: true,
    };
    mockIpcRenderer.invoke.mockResolvedValue({ id: 1 });
    const result = await api.insertKit("/mock/db/dir", kit);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "insert-kit",
      "/mock/db/dir",
      kit,
    );
    expect(result).toEqual({ id: 1 });
  });

  it("calls ipcRenderer.invoke for insertSample", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];
    const sample = {
      kit_id: 1,
      filename: "kick.wav",
      slot_number: 0,
      is_stereo: false,
    };
    mockIpcRenderer.invoke.mockResolvedValue({ id: 1 });
    const result = await api.insertSample("/mock/db/dir", sample);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "insert-sample",
      "/mock/db/dir",
      sample,
    );
    expect(result).toEqual({ id: 1 });
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

  it("handles getDroppedFilePath when webUtils is available", async () => {
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

  it("handles getDroppedFilePath when webUtils.getPathForFile is not available", async () => {
    // Mock webUtils as undefined to test the error path
    const originalMockWebUtils = mockWebUtils;
    vi.doMock("electron", () => {
      return {
        contextBridge: mockContextBridge,
        ipcRenderer: mockIpcRenderer,
        webUtils: null,
      };
    });

    vi.resetModules();
    await import("../index");

    const fileApi = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (c) => c[0] === "electronFileAPI",
    )?.[1];

    await expect(fileApi.getDroppedFilePath({})).rejects.toThrow(
      "webUtils.getPathForFile is not available.",
    );

    // Restore the original mock
    vi.doMock("electron", () => {
      return {
        contextBridge: mockContextBridge,
        ipcRenderer: mockIpcRenderer,
        webUtils: originalMockWebUtils,
      };
    });
  });

  it("handles writeSettings error gracefully", async () => {
    await import("../index");
    const electronAPICall = mockContextBridge.exposeInMainWorld.mock.calls.find(
      (call) => call[0] === "electronAPI",
    );
    expect(electronAPICall).toBeDefined();
    const api = electronAPICall[1];

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockIpcRenderer.invoke.mockRejectedValue(new Error("Write failed"));

    // Should not throw, but should log error
    await expect(api.setSetting("test", "value")).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to write settings:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});

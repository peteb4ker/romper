import * as electron from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

function getElectronMocks() {
  return {
    mockContextBridge: electron.contextBridge,
    mockIpcRenderer: electron.ipcRenderer,
    mockWebUtils: electron.webUtils,
  };
}

describe("preload/index.tsx", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.mock("electron", () => {
      const mockContextBridge = { exposeInMainWorld: vi.fn() };
      const mockIpcRenderer = {
        invoke: vi.fn(),
        on: vi.fn(),
        removeAllListeners: vi.fn(),
      };
      const mockWebUtils = { getPathForFile: vi.fn() };
      return {
        contextBridge: mockContextBridge,
        ipcRenderer: mockIpcRenderer,
        webUtils: mockWebUtils,
      };
    });
  });

  it("exposes electronAPI in main world", async () => {
    await import("../index");
    const { mockContextBridge } = getElectronMocks();
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "electronAPI",
      expect.objectContaining({
        scanSdCard: expect.any(Function),
        selectSdCard: expect.any(Function),
        watchSdCard: expect.any(Function),
        getSetting: expect.any(Function),
        setSetting: expect.any(Function),
        readSettings: expect.any(Function),
        createKit: expect.any(Function),
        copyKit: expect.any(Function),
        listFilesInRoot: expect.any(Function),
        playSample: expect.any(Function),
        stopSample: expect.any(Function),
        onSamplePlaybackEnded: expect.any(Function),
        onSamplePlaybackError: expect.any(Function),
        getAudioBuffer: expect.any(Function),
        readRampleLabels: expect.any(Function),
        writeRampleLabels: expect.any(Function),
        rescanAllVoiceNames: expect.any(Function),
      }),
    );
  });

  it("exposes electronFileAPI in main world", async () => {
    await import("../index");
    const { mockContextBridge } = getElectronMocks();
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      "electronFileAPI",
      expect.objectContaining({
        getDroppedFilePath: expect.any(Function),
      }),
    );
  });

  it("calls ipcRenderer.invoke for scanSdCard", async () => {
    await import("../index");
    const { mockContextBridge, mockIpcRenderer } = getElectronMocks();
    const api = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    mockIpcRenderer.invoke.mockResolvedValue(["file1", "file2"]);
    const result = await api.scanSdCard("/mock/sd");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "scan-sd-card",
      "/mock/sd",
    );
    expect(result).toEqual(["file1", "file2"]);
  });

  it("calls webUtils.getPathForFile for getDroppedFilePath", async () => {
    await import("../index");
    const { mockContextBridge, mockWebUtils } = getElectronMocks();
    const fileApi = mockContextBridge.exposeInMainWorld.mock?.calls.find(
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
    const { mockContextBridge, mockIpcRenderer } = getElectronMocks();
    // Fix: ensure get-user-home-dir returns a string
    mockIpcRenderer.invoke.mockImplementation((channel) => {
      if (channel === "get-user-home-dir") return Promise.resolve("/mock/home");
      return Promise.resolve([]);
    });
    const api = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
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
    const { mockContextBridge, mockWebUtils } = getElectronMocks();
    const fileApi = mockContextBridge.exposeInMainWorld.mock?.calls.find(
      (c) => c[0] === "electronFileAPI",
    )?.[1];
    mockWebUtils.getPathForFile.mockRejectedValue(new Error("fail"));
    await expect(fileApi.getDroppedFilePath({})).rejects.toThrow("fail");
  });

  it("calls ipcRenderer.invoke for getSetting and setSetting", async () => {
    await import("../index");
    const { mockContextBridge, mockIpcRenderer } = getElectronMocks();
    const api = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
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
    const { mockContextBridge, mockIpcRenderer } = getElectronMocks();
    const api = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    mockIpcRenderer.invoke.mockResolvedValue('{"foo":"bar"}');
    const settings = await api.readSettings();
    expect(settings).toEqual({ foo: "bar" });
    mockIpcRenderer.invoke.mockRejectedValue(new Error("fail"));
    const errorSettings = await api.readSettings();
    expect(errorSettings).toEqual({});
  });

  it("watchSdCard returns close method and calls unwatch", async () => {
    await import("../index");
    const { mockContextBridge, mockIpcRenderer } = getElectronMocks();
    const api = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    let closeCalled = false;
    mockIpcRenderer.invoke.mockResolvedValueOnce("watcher-id");
    mockIpcRenderer.invoke.mockResolvedValueOnce(undefined);
    const watcher = api.watchSdCard("/mock/sd", () => {});
    // Wait for watcherId to be set
    await new Promise((r) => setTimeout(r, 60));
    await watcher.close();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "unwatch-sd-card",
      "watcher-id",
    );
  });

  it("calls ipcRenderer.invoke for ensureDir", async () => {
    await import("../index");
    const { mockContextBridge, mockIpcRenderer } = getElectronMocks();
    const api = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    mockIpcRenderer.invoke.mockResolvedValue({ success: true });
    const result = await api.ensureDir("/mock/dir/romper");
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(
      "ensure-dir",
      "/mock/dir/romper",
    );
    expect(result).toEqual({ success: true });
  });
});

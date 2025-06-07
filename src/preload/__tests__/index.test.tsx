vi.mock('electron', () => {
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

import * as electron from 'electron';
import { beforeEach,describe, expect, it, vi } from 'vitest';

function getElectronMocks() {
  return {
    mockContextBridge: electron.contextBridge,
    mockIpcRenderer: electron.ipcRenderer,
    mockWebUtils: electron.webUtils,
  };
}

describe('preload/index.tsx', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('exposes electronAPI in main world', async () => {
    await import('../index');
    const { mockContextBridge } = getElectronMocks();
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
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
        readRampleBinAll: expect.any(Function),
        getAudioBuffer: expect.any(Function),
        readRampleLabels: expect.any(Function),
        writeRampleLabels: expect.any(Function),
        rescanAllVoiceNames: expect.any(Function),
      })
    );
  });

  it('exposes electronFileAPI in main world', async () => {
    await import('../index');
    const { mockContextBridge } = getElectronMocks();
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronFileAPI',
      expect.objectContaining({
        getDroppedFilePath: expect.any(Function),
      })
    );
  });

  it('calls ipcRenderer.invoke for scanSdCard', async () => {
    await import('../index');
    const { mockContextBridge, mockIpcRenderer } = getElectronMocks();
    const api = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    mockIpcRenderer.invoke.mockResolvedValue(['file1', 'file2']);
    const result = await api.scanSdCard('/mock/sd');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('scan-sd-card', '/mock/sd');
    expect(result).toEqual(['file1', 'file2']);
  });

  it('calls webUtils.getPathForFile for getDroppedFilePath', async () => {
    await import('../index');
    const { mockContextBridge, mockWebUtils } = getElectronMocks();
    const fileApi = mockContextBridge.exposeInMainWorld.mock?.calls.find(c => c[0] === 'electronFileAPI')?.[1];
    const file = {};
    mockWebUtils.getPathForFile.mockResolvedValue('/mock/path');
    const result = await fileApi.getDroppedFilePath(file);
    expect(mockWebUtils.getPathForFile).toHaveBeenCalledWith(file);
    expect(result).toBe('/mock/path');
  });
});

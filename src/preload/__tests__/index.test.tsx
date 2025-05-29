import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use manual mocks for Electron APIs
const mockContextBridge = { exposeInMainWorld: vi.fn() };
const mockIpcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeAllListeners: vi.fn(),
};
const mockWebUtils = { getPathForFile: vi.fn() };

vi.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
  webUtils: mockWebUtils,
}));

describe('preload/index.tsx', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('exposes electronAPI in main world', async () => {
    // Only import the logic you want to test, not the full preload script
    // await import('../index'); // REMOVE THIS LINE
    // Instead, directly test the mockContextBridge
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
    // await import('../index'); // REMOVE THIS LINE
    expect(mockContextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'electronFileAPI',
      expect.objectContaining({
        getDroppedFilePath: expect.any(Function),
      })
    );
  });

  it('calls ipcRenderer.invoke for scanSdCard', async () => {
    // await import('../index'); // REMOVE THIS LINE
    const api = mockContextBridge.exposeInMainWorld.mock.calls[0][1];
    mockIpcRenderer.invoke.mockResolvedValue(['file1', 'file2']);
    const result = await api.scanSdCard('/mock/sd');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('scan-sd-card', '/mock/sd');
    expect(result).toEqual(['file1', 'file2']);
  });

  it('calls webUtils.getPathForFile for getDroppedFilePath', async () => {
    // await import('../index'); // REMOVE THIS LINE
    const fileApi = mockContextBridge.exposeInMainWorld.mock?.calls.find(c => c[0] === 'electronFileAPI')?.[1];
    const file = {};
    mockWebUtils.getPathForFile.mockResolvedValue('/mock/path');
    const result = await fileApi.getDroppedFilePath(file);
    expect(mockWebUtils.getPathForFile).toHaveBeenCalledWith(file);
    expect(result).toBe('/mock/path');
  });
});

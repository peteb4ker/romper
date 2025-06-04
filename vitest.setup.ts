import { vi, beforeAll } from 'vitest';

import { TextEncoder } from 'util';

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}

// Mock ElectronAPI and AudioContext for all tests
beforeAll(() => {
  globalThis.window = globalThis.window || {};
  window.electronFileAPI = {
    getDroppedFilePath: async (file) => {
      if (file && typeof file === 'object' && 'path' in file) {
        return file.path;
      }
      if (file && typeof file === 'object' && 'name' in file) {
        return file.name;
      }
      return '';
    }
  };
  window.electronAPI = {
    scanSdCard: vi.fn(async (sdCardPath) => ['KitA', 'KitB', 'KitC']),
    selectSdCard: vi.fn(async () => '/sd'),
    watchSdCard: vi.fn(() => ({ close: () => {} })),
    readSettings: vi.fn(async () => ({ sdCardPath: '/sd' })),
    setSetting: vi.fn(async () => {}),
    getSetting: vi.fn(async () => '/sd'),
    createKit: vi.fn(async () => {}),
    copyKit: vi.fn(async () => {}),
    listFilesInRoot: vi.fn(async (kitPath) => ['1 kick.wav', '2 snare.wav', '3 hat.wav', '4 tom.wav']),
    readRampleLabels: vi.fn(async (sdCardPath) => ({
      kits: {
        KitA: { label: 'KitA', voiceNames: { 1: 'kick', 2: 'snare', 3: 'hat', 4: 'tom' } },
        KitB: { label: 'KitB', voiceNames: { 1: 'kick', 2: 'snare', 3: 'hat', 4: 'tom' } },
        KitC: { label: 'KitC', voiceNames: { 1: 'kick', 2: 'snare', 3: 'hat', 4: 'tom' } },
      }
    })),
    writeRampleLabels: vi.fn(async (sdCardPath, labels) => {}),
    getAudioBuffer: vi.fn(async () => new ArrayBuffer(8)),
  };

  // Mock scrollIntoView for all elements
  window.HTMLElement.prototype.scrollIntoView = vi.fn();

  // Mock SettingsContext
  vi.mock('./utils/SettingsContext', () => ({
    useSettings: () => ({ sdCardPath: '/sd' })
  }));

  // Mock AudioContext for SampleWaveform
  window.AudioContext = function () {
    return {
      decodeAudioData: (arrayBuffer, cb) => cb({}),
      close: () => {},
      state: 'running',
    };
  };
});

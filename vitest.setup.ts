import * as matchers from '@testing-library/jest-dom/matchers';
import { TextEncoder } from 'util';
import { beforeAll, expect,vi } from 'vitest';
expect.extend(matchers);

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
    scanSdCard: async (sdCardPath) => ['KitA', 'KitB', 'KitC'],
    selectSdCard: async () => '/sd',
    watchSdCard: () => ({ close: () => {} }),
    readSettings: async () => ({ sdCardPath: '/sd' }),
    setSetting: async () => {},
    getSetting: async () => '/sd',
    createKit: async () => {},
    copyKit: async () => {},
    listFilesInRoot: async (kitPath) => ['1 kick.wav', '2 snare.wav', '3 hat.wav', '4 tom.wav'],
    readRampleLabels: async (sdCardPath) => ({
      kits: {
        KitA: { label: 'KitA', voiceNames: { 1: 'kick', 2: 'snare', 3: 'hat', 4: 'tom' } },
        KitB: { label: 'KitB', voiceNames: { 1: 'kick', 2: 'snare', 3: 'hat', 4: 'tom' } },
        KitC: { label: 'KitC', voiceNames: { 1: 'kick', 2: 'snare', 3: 'hat', 4: 'tom' } },
      }
    }),
    writeRampleLabels: async (sdCardPath, labels) => {},
    getAudioBuffer: async () => new ArrayBuffer(8),
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

  // Mock Worker for tests (step sequencer, etc.)
  if (typeof globalThis.Worker === 'undefined') {
    class MockWorker {
      onmessage = null;
      constructor() {}
      postMessage(msg) {
        // Simulate immediate step event for sequencer tests
        if (msg.type === 'START' && this.onmessage) {
          // Simulate a STEP event
          setTimeout(() => {
            this.onmessage({ data: { type: 'STEP', payload: { currentStep: 0 } } });
          }, 1);
        }
      }
      terminate() {}
    }
    globalThis.Worker = MockWorker;
  }
});

// Removed electron vi.mock and getElectronMocks from global setup

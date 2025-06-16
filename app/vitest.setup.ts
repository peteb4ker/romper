// Re-export the root vitest setup for app tests
export * from '../vitest.setup';

import { vi } from 'vitest';

if (typeof window !== "undefined") {
  globalThis.window = globalThis.window || {};
  window.electronFileAPI = {
    getDroppedFilePath: async (file) => {
      if (file && typeof file === "object" && "path" in file) {
        return file.path;
      }
      if (file && typeof file === "object" && "name" in file) {
        return file.name;
      }
      return "";
    },
  };
  window.electronAPI = {
    scanSdCard: async (sdCardPath) => ["KitA", "KitB", "KitC"],
    selectSdCard: async () => "/sd",
    watchSdCard: () => ({ close: () => {} }),
    getUserHomeDir: async () => "/mock/home",
    readSettings: async () => ({ sdCardPath: "/sd" }),
    setSetting: async () => {},
    getSetting: async () => "/sd",
    createKit: async () => {},
    copyKit: async () => {},
    listFilesInRoot: async (kitPath) => [
      "1 kick.wav",
      "2 snare.wav",
      "3 hat.wav",
      "4 tom.wav",
    ],
    readRampleLabels: async (sdCardPath) => ({
      kits: {
        KitA: {
          label: "KitA",
          voiceNames: { 1: "kick", 2: "snare", 3: "hat", 4: "tom" },
        },
        KitB: {
          label: "KitB",
          voiceNames: { 1: "kick", 2: "snare", 3: "hat", 4: "tom" },
        },
        KitC: {
          label: "KitC",
          voiceNames: { 1: "kick", 2: "snare", 3: "hat", 4: "tom" },
        },
      },
    }),
    writeRampleLabels: async (sdCardPath, labels) => {},
    getAudioBuffer: async () => new ArrayBuffer(8),
    selectLocalStorePath: async () => "/mock/custom/path",
  };

  // Mock scrollIntoView for all elements
  if (typeof window.HTMLElement !== "undefined") {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  }

  // Mock AudioContext for SampleWaveform
  window.AudioContext = function () {
    return {
      decodeAudioData: (arrayBuffer, cb) => cb({}),
      close: () => {},
      state: "running",
    };
  };

  // Mock Worker for tests (step sequencer, etc.)
  if (typeof globalThis.Worker === "undefined") {
    class MockWorker {
      onmessage = null;
      constructor() {}
      postMessage(msg) {
        if (msg.type === "START" && this.onmessage) {
          setTimeout(() => {
            this.onmessage({
              data: { type: "STEP", payload: { currentStep: 0 } },
            });
          }, 1);
        }
      }
      terminate() {}
    }
    globalThis.Worker = MockWorker;
  }

  // Mock HTMLCanvasElement.getContext for jsdom (for waveform/canvas tests)
  if (typeof window.HTMLCanvasElement !== "undefined") {
    window.HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      // Provide minimal mock for 2d context
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      drawImage: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      setTransform: vi.fn(),
      // ...add more as needed
    }));
  }

  // Ensure window.electronAPI.getAudioBuffer is always defined
  if (!window.electronAPI) {
    window.electronAPI = {};
  }
  if (typeof window.electronAPI.getAudioBuffer !== "function") {
    window.electronAPI.getAudioBuffer = async () => new ArrayBuffer(8);
  }
}

// Mock SettingsContext for app tests
vi.mock("./utils/SettingsContext", () => ({
  useSettings: () => ({ sdCardPath: "/sd" }),
}));

import * as matchers from "@testing-library/jest-dom/matchers";
import { TextEncoder } from "util";
import { beforeAll, expect, vi } from "vitest";
expect.extend(matchers);

if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder;
}

// Mock ElectronAPI and AudioContext for all tests
beforeAll(() => {
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
      getUserHomeDir: async () => "/mock/home", // Fix: make this async to match production API
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
      selectLocalStorePath: async () => "/mock/custom/path", // mock for tests
    };

    // Mock scrollIntoView for all elements
    if (typeof window.HTMLElement !== "undefined") {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }

    // Mock AudioContext for SampleWaveform
    window.AudioContext = function () {
      return {
        decodeAudioData: (arrayBuffer, cb) => {
          // Create a mock AudioBuffer with getChannelData method
          const mockAudioBuffer = {
            length: 1024,
            duration: 1.0,
            sampleRate: 44100,
            numberOfChannels: 1,
            getChannelData: (channel) => {
              // Return mock audio data (sine wave for testing)
              const data = new Float32Array(1024);
              for (let i = 0; i < data.length; i++) {
                data[i] = Math.sin((2 * Math.PI * i) / data.length) * 0.5;
              }
              return data;
            },
          };
          cb(mockAudioBuffer);
        },
        close: () => {},
        state: "running",
      };
    };
  }

  // Mock SettingsContext
  vi.mock("./utils/SettingsContext", () => ({
    useSettings: () => ({ sdCardPath: "/sd" }),
  }));

  // Mock Worker for tests (step sequencer, etc.)
  if (typeof globalThis.Worker === "undefined") {
    class MockWorker {
      onmessage = null;
      constructor() {}
      postMessage(msg) {
        // Simulate immediate step event for sequencer tests
        if (msg.type === "START" && this.onmessage) {
          // Simulate a STEP event
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

  // Mock HTMLCanvasElement.getContext with all required methods
  if (typeof HTMLCanvasElement !== "undefined") {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: vi.fn(() => ({
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        arc: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
        setTransform: vi.fn(),
        resetTransform: vi.fn(),
        drawImage: vi.fn(),
        canvas: { width: 100, height: 100 },
        fillStyle: "#000000",
        strokeStyle: "#000000",
        lineWidth: 1,
        font: "10px sans-serif",
        textAlign: "start",
        textBaseline: "alphabetic",
        globalAlpha: 1,
        globalCompositeOperation: "source-over",
      })),
      writable: true,
    });
  }
});

// Removed electron vi.mock and getElectronMocks from global setup

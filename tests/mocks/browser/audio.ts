import { vi } from "vitest";

/**
 * Mock Web Audio API for tests that need audio context
 */
export const createAudioContextMock = (
  overrides: Record<string, any> = {}
) => ({
  close: vi.fn().mockResolvedValue(undefined),
  createAnalyser: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
  }),
  createBuffer: vi.fn().mockReturnValue({
    getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
    length: 1024,
    numberOfChannels: 2,
    sampleRate: 44100,
  }),
  // Audio context methods
  createBufferSource: vi.fn().mockReturnValue({
    addEventListener: vi.fn(),
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeEventListener: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }),
  createGain: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 1 },
  }),

  currentTime: 0,

  decodeAudioData: vi.fn().mockResolvedValue({
    getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
    length: 1024,
    numberOfChannels: 2,
    sampleRate: 44100,
  }),

  destination: {},

  listener: {},

  resume: vi.fn().mockResolvedValue(undefined),

  sampleRate: 44100,
  // Audio context state
  state: "running",
  suspend: vi.fn().mockResolvedValue(undefined),

  ...overrides,
});

/**
 * Mock HTMLAudioElement for basic audio playback tests
 */
export const createHTMLAudioElementMock = (
  overrides: Record<string, any> = {}
) => ({
  // Event handling
  addEventListener: vi.fn(),
  canPlayType: vi.fn().mockReturnValue("probably"),
  currentTime: 0,
  dispatchEvent: vi.fn(),
  duration: 0,
  ended: false,
  load: vi.fn(),
  muted: false,

  pause: vi.fn(),
  paused: true,
  // Audio element methods
  play: vi.fn().mockResolvedValue(undefined),
  readyState: 4, // HAVE_ENOUGH_DATA

  removeEventListener: vi.fn(),
  // Audio element properties
  src: "",
  volume: 1,

  ...overrides,
});

/**
 * Sets up Web Audio API mocks globally
 */
export const setupAudioMocks = () => {
  // Mock AudioContext
  globalThis.AudioContext = vi
    .fn()
    .mockImplementation(() => createAudioContextMock());
  globalThis.webkitAudioContext = globalThis.AudioContext;

  // Mock HTMLAudioElement
  globalThis.Audio = vi
    .fn()
    .mockImplementation(() => createHTMLAudioElementMock());

  // Mock MediaDevices for audio input tests
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    value: {
      enumerateDevices: vi.fn().mockResolvedValue([
        {
          deviceId: "default",
          kind: "audioinput",
          label: "Default Microphone",
        },
      ]),
      getUserMedia: vi.fn().mockResolvedValue({
        addEventListener: vi.fn(),
        addTrack: vi.fn(),
        getTracks: () => [
          {
            addEventListener: vi.fn(),
            kind: "audio",
            removeEventListener: vi.fn(),
            stop: vi.fn(),
          },
        ],
        removeEventListener: vi.fn(),
        removeTrack: vi.fn(),
      }),
    },
    writable: true,
  });
};

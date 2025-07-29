import { vi } from "vitest";

/**
 * Mock Web Audio API for tests that need audio context
 */
export const createAudioContextMock = (
  overrides: Record<string, any> = {},
) => ({
  // Audio context state
  state: "running",
  sampleRate: 44100,
  currentTime: 0,
  destination: {},
  listener: {},

  // Audio context methods
  createBufferSource: vi.fn().mockReturnValue({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),

  createGain: vi.fn().mockReturnValue({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),

  createBuffer: vi.fn().mockReturnValue({
    length: 1024,
    numberOfChannels: 2,
    sampleRate: 44100,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
  }),

  decodeAudioData: vi.fn().mockResolvedValue({
    length: 1024,
    numberOfChannels: 2,
    sampleRate: 44100,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(1024)),
  }),

  createAnalyser: vi.fn().mockReturnValue({
    fftSize: 2048,
    frequencyBinCount: 1024,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteFrequencyData: vi.fn(),
    getFloatFrequencyData: vi.fn(),
  }),

  suspend: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),

  ...overrides,
});

/**
 * Mock HTMLAudioElement for basic audio playback tests
 */
export const createHTMLAudioElementMock = (
  overrides: Record<string, any> = {},
) => ({
  // Audio element properties
  src: "",
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  paused: true,
  ended: false,
  readyState: 4, // HAVE_ENOUGH_DATA

  // Audio element methods
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  canPlayType: vi.fn().mockReturnValue("probably"),

  // Event handling
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),

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
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [
          {
            kind: "audio",
            stop: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          },
        ],
        addTrack: vi.fn(),
        removeTrack: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
      enumerateDevices: vi.fn().mockResolvedValue([
        {
          deviceId: "default",
          kind: "audioinput",
          label: "Default Microphone",
        },
      ]),
    },
    writable: true,
  });
};

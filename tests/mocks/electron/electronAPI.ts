import { vi } from "vitest";

/**
 * Centralized ElectronAPI mock factory
 * Used across renderer tests to avoid duplication of 75+ electronAPI mock instances
 */
export const createElectronAPIMock = (
  overrides: Partial<typeof window.electronAPI> = {},
) => ({
  // Database operations
  getKits: vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        name: "A0",
        bank_letter: "A",
        alias: null,
        artist: null,
        editable: false,
        locked: false,
        step_pattern: null,
        modified_since_sync: false,
      },
      {
        name: "A1",
        bank_letter: "A",
        alias: null,
        artist: null,
        editable: false,
        locked: false,
        step_pattern: null,
        modified_since_sync: false,
      },
    ],
  }),
  getAllSamplesForKit: vi.fn().mockImplementation((kitName: string) => {
    return Promise.resolve({
      success: true,
      data: [
        { filename: "1 Kick.wav", voice_number: 1, slot_number: 0 },
        { filename: "2 Snare.wav", voice_number: 2, slot_number: 0 },
        { filename: "3 Hat.wav", voice_number: 3, slot_number: 0 },
        { filename: "4 Tom.wav", voice_number: 4, slot_number: 0 },
      ],
    });
  }),
  getKit: vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 1,
      name: "A0",
      alias: "A0",
      editable: false,
      locked: false,
      voices: { 1: "kick", 2: "snare", 3: "hat", 4: "tom" },
      step_pattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
    },
  }),
  updateKit: vi.fn().mockResolvedValue({ success: true }),
  updateVoiceAlias: vi.fn().mockResolvedValue({ success: true }),
  updateStepPattern: vi.fn().mockResolvedValue({ success: true }),
  rescanKit: vi.fn().mockResolvedValue({
    success: true,
    data: { scannedSamples: 4, updatedVoices: 4 },
  }),
  getAllBanks: vi.fn().mockResolvedValue({ success: true, data: [] }),
  scanBanks: vi.fn().mockResolvedValue({
    success: true,
    data: { updatedBanks: 2, scannedFiles: 0, scannedAt: new Date() },
  }),

  // Kit operations
  createKit: vi.fn().mockResolvedValue(undefined),
  copyKit: vi.fn().mockResolvedValue(undefined),

  // Sample operations
  addSampleToSlot: vi.fn().mockResolvedValue(undefined),
  replaceSampleInSlot: vi.fn().mockResolvedValue(undefined),
  deleteSampleFromSlot: vi.fn().mockResolvedValue(undefined),
  validateSampleSources: vi.fn().mockResolvedValue({ success: true }),
  validateSampleFormat: vi.fn().mockResolvedValue({ success: true }),

  // Audio operations
  getAudioBuffer: vi
    .fn()
    .mockResolvedValue({ slice: () => new ArrayBuffer(8) }),
  getSampleAudioBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  playSample: vi.fn().mockResolvedValue(undefined),
  stopSample: vi.fn().mockResolvedValue(undefined),
  onSamplePlaybackEnded: vi.fn(),
  onSamplePlaybackError: vi.fn(),

  // File operations
  selectSdCard: vi.fn().mockResolvedValue("/sd"),
  selectLocalStorePath: vi.fn().mockResolvedValue("/mock/custom/path"),
  selectExistingLocalStore: vi.fn().mockResolvedValue("/mock/existing/path"),
  getUserHomeDir: vi.fn().mockResolvedValue("/mock/home"),
  readFile: vi.fn().mockResolvedValue({
    success: true,
    data: new ArrayBuffer(1024),
  }),
  listFilesInRoot: vi.fn().mockImplementation((path: string) => {
    // When called with common local store paths, return kit folders
    if (
      path === "/sd" ||
      path === "/mock/local/store" ||
      path.includes("local")
    ) {
      return Promise.resolve(["A0", "A1", "B0"]);
    }
    // When called with specific kit paths, return WAV files
    return Promise.resolve([
      "1 kick.wav",
      "2 snare.wav",
      "3 hat.wav",
      "4 tom.wav",
    ]);
  }),

  // Settings operations
  getSetting: vi.fn().mockResolvedValue("/mock/local/store"),
  setSetting: vi.fn().mockResolvedValue(undefined),
  readSettings: vi
    .fn()
    .mockResolvedValue({ localStorePath: "/mock/local/store" }),

  // Local store operations
  getLocalStoreStatus: vi
    .fn()
    .mockResolvedValue({ isValid: true, hasLocalStore: true }),
  validateLocalStore: vi.fn().mockResolvedValue({
    isValid: true,
    errors: [],
    errorSummary: undefined,
  }),
  validateLocalStoreBasic: vi.fn().mockResolvedValue({ isValid: true }),

  // Archive operations
  downloadAndExtractArchive: vi.fn().mockResolvedValue(undefined),
  ensureDir: vi.fn().mockResolvedValue(undefined),
  copyDir: vi.fn().mockResolvedValue(undefined),

  // Database setup
  createRomperDb: vi.fn().mockResolvedValue(undefined),
  insertKit: vi.fn().mockResolvedValue(undefined),
  insertSample: vi.fn().mockResolvedValue(undefined),

  // Sync operations
  generateSyncChangeSummary: vi
    .fn()
    .mockResolvedValue({ success: true, data: null }),
  startKitSync: vi.fn().mockResolvedValue(undefined),
  cancelKitSync: vi.fn().mockResolvedValue(undefined),
  onSyncProgress: vi.fn(),

  // Application operations
  closeApp: vi.fn().mockResolvedValue(undefined),
  openExternal: vi.fn().mockResolvedValue(undefined),

  // Apply any overrides
  ...overrides,
});

/**
 * Sets up electronAPI mock on window object for tests
 */
export const setupElectronAPIMock = (
  overrides: Partial<typeof window.electronAPI> = {},
) => {
  window.electronAPI = createElectronAPIMock(overrides);
  return window.electronAPI;
};

/**
 * Default electronAPI mock for vitest setup
 */
export const defaultElectronAPIMock = createElectronAPIMock();

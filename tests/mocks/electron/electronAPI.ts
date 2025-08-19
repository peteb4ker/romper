import { vi } from "vitest";

/**
 * Centralized ElectronAPI mock factory
 * Used across renderer tests to avoid duplication of 75+ electronAPI mock instances
 */
export const createElectronAPIMock = (
  overrides: Partial<typeof window.electronAPI> = {},
) => ({
  // Sample operations
  addSampleToSlot: vi.fn().mockResolvedValue(undefined),
  cancelKitSync: vi.fn().mockResolvedValue(undefined),
  // Application operations
  closeApp: vi.fn().mockResolvedValue(undefined),
  copyDir: vi.fn().mockResolvedValue(undefined),
  copyKit: vi.fn().mockResolvedValue(undefined),
  // Kit operations
  createKit: vi.fn().mockResolvedValue(undefined),
  // Database setup
  createRomperDb: vi.fn().mockResolvedValue(undefined),
  deleteSampleFromSlot: vi.fn().mockResolvedValue(undefined),
  // Archive operations
  downloadAndExtractArchive: vi.fn().mockResolvedValue(undefined),

  ensureDir: vi.fn().mockResolvedValue(undefined),
  // Sync operations
  generateSyncChangeSummary: vi
    .fn()
    .mockResolvedValue({ data: null, success: true }),

  getAllBanks: vi.fn().mockResolvedValue({ data: [], success: true }),
  getAllSamplesForKit: vi.fn().mockImplementation((_: string) => {
    return Promise.resolve({
      data: [
        { filename: "1 Kick.wav", slot_number: 0, voice_number: 1 },
        { filename: "2 Snare.wav", slot_number: 0, voice_number: 2 },
        { filename: "3 Hat.wav", slot_number: 0, voice_number: 3 },
        { filename: "4 Tom.wav", slot_number: 0, voice_number: 4 },
      ],
      success: true,
    });
  }),
  // Audio operations
  getAudioBuffer: vi
    .fn()
    .mockResolvedValue({ slice: () => new ArrayBuffer(8) }),
  getKit: vi.fn().mockResolvedValue({
    data: {
      alias: "A0",
      editable: false,
      id: 1,
      locked: false,
      name: "A0",
      step_pattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
      voices: [
        { id: 1, kit_name: "A0", voice_alias: null, voice_number: 1 },
        { id: 2, kit_name: "A0", voice_alias: null, voice_number: 2 },
        { id: 3, kit_name: "A0", voice_alias: null, voice_number: 3 },
        { id: 4, kit_name: "A0", voice_alias: null, voice_number: 4 },
      ],
    },
    success: true,
  }),
  // Database operations
  getKits: vi.fn().mockResolvedValue({
    data: [
      {
        alias: null,
        artist: null,
        bank_letter: "A",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "A0",
        step_pattern: null,
      },
      {
        alias: null,
        artist: null,
        bank_letter: "A",
        editable: false,
        locked: false,
        modified_since_sync: false,
        name: "A1",
        step_pattern: null,
      },
    ],
    success: true,
  }),

  // Local store operations
  getLocalStoreStatus: vi
    .fn()
    .mockResolvedValue({ hasLocalStore: true, isValid: true }),
  getSampleAudioBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  // Settings operations
  getSetting: vi.fn().mockResolvedValue("/mock/local/store"),
  getUserHomeDir: vi.fn().mockResolvedValue("/mock/home"),
  insertKit: vi.fn().mockResolvedValue(undefined),
  insertSample: vi.fn().mockResolvedValue(undefined),

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
  moveSampleBetweenKits: vi.fn().mockResolvedValue({ success: true }),
  // Move operations
  moveSampleInKit: vi.fn().mockResolvedValue({ success: true }),
  onSamplePlaybackEnded: vi.fn(),
  onSamplePlaybackError: vi.fn(),
  onSyncProgress: vi.fn(),
  openExternal: vi.fn().mockResolvedValue(undefined),

  playSample: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue({
    data: new ArrayBuffer(1024),
    success: true,
  }),
  readSettings: vi.fn().mockResolvedValue({
    darkMode: false,
    localStorePath: "/mock/local/store",
    sdCardPath: "/mock/sd/card",
    themeMode: "light",
  }),
  replaceSampleInSlot: vi.fn().mockResolvedValue(undefined),
  rescanKit: vi.fn().mockResolvedValue({
    data: { scannedSamples: 4, updatedVoices: 4 },
    success: true,
  }),

  scanBanks: vi.fn().mockResolvedValue({
    data: { scannedAt: new Date(), scannedFiles: 0, updatedBanks: 2 },
    success: true,
  }),
  selectExistingLocalStore: vi.fn().mockResolvedValue("/mock/existing/path"),
  selectLocalStorePath: vi.fn().mockResolvedValue("/mock/custom/path"),

  // File operations
  selectSdCard: vi.fn().mockResolvedValue("/sd"),
  setSetting: vi.fn().mockResolvedValue(undefined),
  showItemInFolder: vi.fn().mockResolvedValue(undefined),

  startKitSync: vi.fn().mockResolvedValue(undefined),
  stopSample: vi.fn().mockResolvedValue(undefined),
  updateKit: vi.fn().mockResolvedValue({ success: true }),
  updateKitBpm: vi.fn().mockResolvedValue({ success: true }),
  updateStepPattern: vi.fn().mockResolvedValue({ success: true }),
  updateVoiceAlias: vi.fn().mockResolvedValue({ success: true }),
  validateLocalStore: vi.fn().mockResolvedValue({
    errors: [],
    errorSummary: undefined,
    isValid: true,
  }),
  validateLocalStoreBasic: vi.fn().mockResolvedValue({ isValid: true }),

  validateSampleFormat: vi.fn().mockResolvedValue({ success: true }),
  validateSampleSources: vi.fn().mockResolvedValue({ success: true }),

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

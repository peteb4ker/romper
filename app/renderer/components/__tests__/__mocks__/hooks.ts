// Shared mock fixtures for complex hooks used across multiple tests
import { vi } from "vitest";

// Mock for useLocalStoreWizard - prevents hanging due to complex initialization logic
export const mockUseLocalStoreWizard = () => ({
  state: {
    targetPath: "/mock/path",
    source: "blank",
    sdCardMounted: false,
    isInitializing: false,
    error: null,
    sourceConfirmed: false,
    sdCardSourcePath: undefined,
    kitFolderValidationError: undefined,
  },
  progress: null,
  progressMessage: "",
  setTargetPath: vi.fn(),
  setSource: vi.fn(),
  setSdCardMounted: vi.fn(),
  setError: vi.fn(),
  setIsInitializing: vi.fn(),
  initialize: vi.fn().mockResolvedValue(undefined),
});

// Mock for useKitScan - prevents complex scanning logic from running
export const mockUseKitScan = () => ({
  scanningProgress: null,
  scanAllKits: vi.fn(),
  rescanAllVoiceNames: vi.fn(),
});

// Mock for useStartupActions - prevents startup scanning from running in tests
export const mockUseStartupActions = () => ({
  // No return value, just prevents execution
});

// Mock for focused kit hooks - replaces legacy useKit
export const mockUseKit = (kitName: string = "A0") => ({
  kit: {
    name: kitName,
    alias: kitName,
    editable: false,
    locked: false,
    step_pattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
    voices: [
      { voice_number: 1, voice_alias: "kick" },
      { voice_number: 2, voice_alias: "snare" },
      { voice_number: 3, voice_alias: "hat" },
      { voice_number: 4, voice_alias: "tom" },
    ],
  },
  loading: false,
  error: null,
  reloadKit: vi.fn(),
  updateKitAlias: vi.fn(),
});

// Comprehensive electronAPI mock that matches all current signatures
export const mockElectronAPI = {
  // File system operations
  selectSdCard: vi.fn().mockResolvedValue("/mock/sd"),
  getUserHomeDir: vi.fn().mockResolvedValue("/mock/home"),
  listFilesInRoot: vi.fn().mockResolvedValue(["A0", "A1", "B0"]),
  readFile: vi
    .fn()
    .mockResolvedValue({ success: true, data: new ArrayBuffer(1024) }),

  // Settings operations
  readSettings: vi.fn().mockResolvedValue({ localStorePath: "/mock/path" }),
  setSetting: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue("/mock/path"),

  // Kit operations
  createKit: vi.fn().mockResolvedValue(undefined),
  copyKit: vi.fn().mockResolvedValue(undefined),

  // Database operations (updated signatures without dbDir parameters)
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
  getAllSamplesForKit: vi.fn().mockResolvedValue({ success: true, data: [] }),
  rescanKit: vi.fn().mockResolvedValue({
    success: true,
    data: { scannedSamples: 4, updatedVoices: 4 },
  }),
  getAllBanks: vi.fn().mockResolvedValue({ success: true, data: [] }),
  scanBanks: vi.fn().mockResolvedValue({
    success: true,
    data: { updatedBanks: 0, scannedFiles: 0, scannedAt: new Date() },
  }),

  // Validation operations
  validateLocalStore: vi.fn().mockResolvedValue({
    isValid: true,
    errors: [],
    errorSummary: undefined,
  }),
  validateLocalStoreBasic: vi.fn().mockResolvedValue({
    isValid: true,
    errors: [],
    errorSummary: undefined,
  }),

  // Audio operations
  getAudioBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  getSampleAudioBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  playSample: vi.fn().mockResolvedValue(undefined),
  stopSample: vi.fn().mockResolvedValue(undefined),
  onSamplePlaybackEnded: vi.fn(),
  onSamplePlaybackError: vi.fn(),

  // Archive operations
  downloadAndExtractArchive: vi.fn().mockResolvedValue({ success: true }),
  selectLocalStorePath: vi.fn().mockResolvedValue("/mock/custom/path"),
  selectExistingLocalStore: vi.fn().mockResolvedValue({
    success: true,
    path: "/mock/existing/path",
    error: null,
  }),

  // Directory operations
  ensureDir: vi.fn().mockResolvedValue(undefined),
  copyDir: vi.fn().mockResolvedValue(undefined),

  // Database creation
  createRomperDb: vi
    .fn()
    .mockResolvedValue({ success: true, dbPath: "/mock/db" }),
  insertKit: vi.fn().mockResolvedValue({ success: true }),
  insertSample: vi.fn().mockResolvedValue({ success: true, sampleId: 1 }),

  // App operations
  closeApp: vi.fn().mockResolvedValue(undefined),
  openExternal: vi.fn().mockResolvedValue(undefined),
};

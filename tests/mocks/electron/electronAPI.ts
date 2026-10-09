import type {
  Kit,
  KitWithRelations,
  Sample,
  Voice,
} from "@romper/shared/db/schema";
import type { ElectronAPI } from "@romper/shared/electronApi";

import { vi } from "vitest";

/**
 * A mock of one ElectronAPI method, typed by the contract, so a default
 * result that drifts from shared/electronApi.ts fails typecheck (#472)
 */
function mockMethod<K extends keyof ElectronAPI>(_name: K) {
  return vi.fn<ElectronAPI[K]>();
}

const kitRow = (name: string, overrides: Partial<Kit> = {}): Kit => ({
  alias: null,
  bank_letter: name.charAt(0),
  bpm: 120,
  editable: false,
  is_favorite: false,
  locked: false,
  modified_since_sync: false,
  name,
  slice_steps: null,
  slicer_division: 16,
  step_pattern: null,
  trigger_conditions: null,
  ...overrides,
});

const voiceRow = (id: number, kitName: string, voiceNumber: number): Voice => ({
  id,
  kit_name: kitName,
  sample_mode: "first",
  slice_enabled: false,
  slice_max_length: 2,
  slice_roll_amount: 100,
  slice_vary_length: false,
  stereo_choice: null,
  stereo_mode: false,
  voice_alias: null,
  voice_number: voiceNumber,
  voice_volume: 100,
});

const sampleRow = (
  id: number,
  filename: string,
  voiceNumber: number,
): Sample => ({
  filename,
  gain_db: 0,
  id,
  kit_name: "A0",
  slot_number: 0,
  source_path: `/mock/local/store/A0/${filename}`,
  source_status: null,
  voice_number: voiceNumber,
  wav_bit_depth: null,
  wav_bitrate: null,
  wav_channels: null,
  wav_format_tag: null,
  wav_sample_rate: null,
});

const mockKit: KitWithRelations = {
  ...kitRow("A0", {
    alias: "A0",
    step_pattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
  }),
  voices: [1, 2, 3, 4].map((n) => voiceRow(n, "A0", n)),
};

const emptyScan = {
  addedSamples: 0,
  locked: false,
  metadataUpdated: 0,
  missingSamples: [],
  scannedSamples: 0,
  skippedFiles: [],
  updatedVoices: 0,
};

/**
 * Centralized ElectronAPI mock factory
 * Used across renderer tests to avoid duplication of 75+ electronAPI mock
 * instances. Checked against the contract with `satisfies`, so a member
 * missing here, or one the contract doesn't have, fails typecheck (#472).
 */
export const createElectronAPIMock = (
  overrides: Partial<typeof window.electronAPI> = {},
) => ({
  ...({
    // Sample operations
    addSampleToSlot: mockMethod("addSampleToSlot").mockResolvedValue({
      success: true,
    }),
    cancelKitSync: mockMethod("cancelKitSync").mockResolvedValue(undefined),
    cancelSetup: mockMethod("cancelSetup").mockResolvedValue({
      success: true,
    }),
    // Filesystem pre-checks
    checkDiskSpace: mockMethod("checkDiskSpace").mockResolvedValue({
      availableBytes: 10 * 1024 * 1024 * 1024,
      requiredBytes: 0,
      sufficient: true,
    }),
    checkExistingLocalStore: mockMethod(
      "checkExistingLocalStore",
    ).mockResolvedValue({ exists: false }),
    checkKitSampleFiles: mockMethod("checkKitSampleFiles").mockResolvedValue({
      data: { changed: 0, checked: 0 },
      success: true,
    }),
    checkPathWritable: mockMethod("checkPathWritable").mockResolvedValue({
      writable: true,
    }),
    cleanupPartialInit: mockMethod("cleanupPartialInit").mockResolvedValue({
      removed: true,
    }),
    // Application operations
    closeApp: mockMethod("closeApp").mockResolvedValue(undefined),
    copyDir: mockMethod("copyDir").mockResolvedValue({ success: true }),

    copyKit: mockMethod("copyKit").mockResolvedValue({ success: true }),

    // Kit operations
    createKit: mockMethod("createKit").mockResolvedValue({ success: true }),
    // Database setup
    createRomperDb: mockMethod("createRomperDb").mockResolvedValue({
      success: true,
    }),
    deleteKit: mockMethod("deleteKit").mockResolvedValue({ success: true }),
    deleteSampleFromSlot: mockMethod("deleteSampleFromSlot").mockResolvedValue({
      success: true,
    }),

    // Archive operations
    downloadAndExtractArchive: mockMethod(
      "downloadAndExtractArchive",
    ).mockResolvedValue({ success: true }),

    ensureDir: mockMethod("ensureDir").mockResolvedValue({ success: true }),
    finishSetup: mockMethod("finishSetup").mockResolvedValue({
      success: true,
    }),
    // Sync operations
    generateSyncChangeSummary: mockMethod(
      "generateSyncChangeSummary",
    ).mockResolvedValue({ success: true }),
    getAllBanks: mockMethod("getAllBanks").mockResolvedValue({
      data: [],
      success: true,
    }),
    getAllSamplesForKit: mockMethod("getAllSamplesForKit").mockImplementation(
      () =>
        Promise.resolve({
          data: [
            sampleRow(1, "1 Kick.wav", 1),
            sampleRow(2, "2 Snare.wav", 2),
            sampleRow(3, "3 Hat.wav", 3),
            sampleRow(4, "4 Tom.wav", 4),
          ],
          success: true,
        }),
    ),

    getKit: mockMethod("getKit").mockResolvedValue({
      data: mockKit,
      success: true,
    }),
    getKitDeleteSummary: mockMethod("getKitDeleteSummary").mockResolvedValue({
      data: { kitName: "A0", locked: false, sampleCount: 0, voiceCount: 4 },
      success: true,
    }),
    // Database operations
    getKits: mockMethod("getKits").mockResolvedValue({
      data: [kitRow("A0"), kitRow("A1")],
      success: true,
    }),
    // Local store operations
    getLocalStoreStatus: mockMethod("getLocalStoreStatus").mockResolvedValue({
      hasLocalStore: true,
      isValid: true,
    }),
    getSampleAudioBuffer: mockMethod("getSampleAudioBuffer").mockResolvedValue({
      data: { bytes: new ArrayBuffer(8), version: "mock-version" },
      success: true,
    }),
    // Settings operations
    getUserHomeDir:
      mockMethod("getUserHomeDir").mockResolvedValue("/mock/home"),
    listFilesInRoot: mockMethod("listFilesInRoot").mockImplementation(
      (path: string) => {
        // When called with common local store paths, return kit folders
        if (
          path === "/sd" ||
          path === "/mock/local/store" ||
          path.includes("local")
        ) {
          return Promise.resolve({ data: ["A0", "A1", "B0"], success: true });
        }
        // When called with specific kit paths, return WAV files
        return Promise.resolve({
          data: ["1 kick.wav", "2 snare.wav", "3 hat.wav", "4 tom.wav"],
          success: true,
        });
      },
    ),
    moveSampleBetweenKits: mockMethod(
      "moveSampleBetweenKits",
    ).mockResolvedValue({ success: true }),
    // Move operations
    moveSampleInKit: mockMethod("moveSampleInKit").mockResolvedValue({
      success: true,
    }),
    onLocalStoreDatabaseMissing: mockMethod(
      "onLocalStoreDatabaseMissing",
    ).mockReturnValue(() => {}),
    onSyncProgress: mockMethod("onSyncProgress").mockReturnValue(() => {}),

    openExternal: mockMethod("openExternal").mockResolvedValue({
      success: true,
    }),
    readSettings: mockMethod("readSettings").mockResolvedValue({
      localStorePath: "/mock/local/store",
      sdCardPath: "/mock/sd/card",
      themeMode: "light",
    }),
    requestLocalStoreAccess: mockMethod(
      "requestLocalStoreAccess",
    ).mockResolvedValue({ granted: true }),
    rescanKit: mockMethod("rescanKit").mockResolvedValue({
      data: { ...emptyScan, scannedSamples: 4, updatedVoices: 4 },
      success: true,
    }),
    restoreKitSequence: mockMethod("restoreKitSequence").mockResolvedValue({
      success: true,
    }),
    restoreKitVoices: mockMethod("restoreKitVoices").mockResolvedValue({
      success: true,
    }),
    selectExistingLocalStore: mockMethod(
      "selectExistingLocalStore",
    ).mockResolvedValue({
      error: null,
      path: "/mock/existing/path",
      success: true,
    }),
    selectLocalStorePath: mockMethod("selectLocalStorePath").mockResolvedValue(
      "/mock/custom/path",
    ),

    // File operations
    selectSdCard: mockMethod("selectSdCard").mockResolvedValue("/sd"),
    setSetting: mockMethod("setSetting").mockResolvedValue(undefined),
    setupImportBankNames: mockMethod("setupImportBankNames").mockResolvedValue({
      data: { importedBanks: 0 },
      success: true,
    }),
    setupImportKit: mockMethod("setupImportKit").mockResolvedValue({
      data: emptyScan,
      success: true,
    }),
    showItemInFolder:
      mockMethod("showItemInFolder").mockResolvedValue(undefined),

    startKitSync: mockMethod("startKitSync").mockResolvedValue({
      data: {
        cancelled: false,
        skippedFiles: [],
        syncedFiles: 0,
        warnings: [],
      },
      success: true,
    }),
    toggleKitFavorite: mockMethod("toggleKitFavorite").mockResolvedValue({
      data: { isFavorite: true },
      success: true,
    }),
    updateBank: mockMethod("updateBank").mockResolvedValue({ success: true }),
    updateKit: mockMethod("updateKit").mockResolvedValue({ success: true }),
    updateKitBpm: mockMethod("updateKitBpm").mockResolvedValue({
      success: true,
    }),
    updateKitSlicerDivision: mockMethod(
      "updateKitSlicerDivision",
    ).mockResolvedValue({ success: true }),
    updateSampleGain: mockMethod("updateSampleGain").mockResolvedValue({
      success: true,
    }),
    updateSliceSteps: mockMethod("updateSliceSteps").mockResolvedValue({
      success: true,
    }),
    updateStepPattern: mockMethod("updateStepPattern").mockResolvedValue({
      success: true,
    }),
    updateTriggerConditions: mockMethod(
      "updateTriggerConditions",
    ).mockResolvedValue({ success: true }),
    updateVoiceAlias: mockMethod("updateVoiceAlias").mockResolvedValue({
      success: true,
    }),
    updateVoiceSampleMode: mockMethod(
      "updateVoiceSampleMode",
    ).mockResolvedValue({ success: true }),
    updateVoiceSliceSettings: mockMethod(
      "updateVoiceSliceSettings",
    ).mockResolvedValue({ success: true }),
    updateVoiceStereoMode: mockMethod(
      "updateVoiceStereoMode",
    ).mockResolvedValue({ success: true }),
    updateVoiceVolume: mockMethod("updateVoiceVolume").mockResolvedValue({
      success: true,
    }),
    validateLocalStore: mockMethod("validateLocalStore").mockResolvedValue({
      errors: [],
      errorSummary: undefined,
      isValid: true,
    }),
    validateLocalStoreBasic: mockMethod(
      "validateLocalStoreBasic",
    ).mockResolvedValue({ isValid: true }),

    validateSampleFormat: mockMethod("validateSampleFormat").mockResolvedValue({
      success: true,
    }),
  } satisfies ElectronAPI),

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

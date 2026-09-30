import type { AudioMetadata, FormatValidationResult } from "./audioTypes.js";
import type {
  Bank,
  DbResult,
  Kit,
  KitScanResult,
  KitWithRelations,
  LocalStoreValidationDetailedResult,
  NewKit,
  NewSample,
  Sample,
} from "./db/schema.js";
import type { SliceStep, VoiceSliceSettings } from "./sliceTypes.js";

/**
 * THE canonical contract for the preload bridge (window.electronAPI).
 *
 * Single source of truth, enforced on both sides:
 * - the preload implements it via `satisfies ElectronAPI`, so a missing or
 *   drifted method is a COMPILE ERROR in the preload build;
 * - the renderer's global declaration (app/renderer/electron.d.ts) imports
 *   this same type, so call sites see exactly what the preload exposes.
 *
 * Every member is required: an optional member turns missing wiring into a
 * silent no-op at `?.` call sites — the bug class behind the dead About
 * links, the phantom playback API, and three orphaned IPC channels.
 * tests/unit/ipcChannelParity.test.ts guards the preload<->main layer.
 */

export interface ElectronAPI {
  addSampleToSlot: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<DbResult<{ sampleId: number }>>;
  cancelKitSync: () => Promise<unknown>;
  checkDiskSpace: (
    targetPath: string,
    requiredBytes: number,
  ) => Promise<{
    availableBytes: number;
    error?: string;
    requiredBytes: number;
    sufficient: boolean;
  }>;
  // Whether the folder already holds a local store; setup refuses it (RE-10)
  checkExistingLocalStore: (
    targetPath: string,
  ) => Promise<{ error?: string; exists: boolean }>;
  checkPathWritable: (
    targetPath: string,
  ) => Promise<{ error?: string; writable: boolean }>;
  // Moves aside a .romperdb that setup created this session; refuses others
  cleanupPartialInit: (
    targetPath: string,
  ) => Promise<{ error?: string; movedTo?: string; removed: boolean }>;
  closeApp: () => Promise<void>;
  copyDir: (src: string, dest: string) => Promise<unknown>;
  copyKit: (sourceKit: string, destKit: string) => Promise<DbResult>;
  createKit: (kitSlot: string) => Promise<DbResult>;
  createRomperDb: (dbDir: string) => Promise<RomperDbResult>;
  deleteKit: (kitName: string) => Promise<DbResult>;
  deleteSampleFromSlot: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => Promise<
    DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }>
  >;
  deleteSampleFromSlotWithoutReindexing: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => Promise<DbResult<{ deletedSamples: Sample[] }>>;
  downloadAndExtractArchive: (
    url: string,
    destDir: string,
    onProgress?: (p: unknown) => void,
    onError?: (e: unknown) => void,
  ) => Promise<DbResult>;
  ensureDir: (dir: string) => Promise<unknown>;
  generateSyncChangeSummary: (
    sdCardPath?: string,
  ) => Promise<DbResult<SyncChangeSummary>>;
  getAllBanks: () => Promise<DbResult<Bank[]>>;
  getAllSamples: (dbDir: string) => Promise<DbResult<Sample[]>>;
  getAllSamplesForKit: (kitName: string) => Promise<DbResult<Sample[]>>;
  getAudioMetadata: (filePath: string) => Promise<DbResult<AudioMetadata>>;
  getFavoriteKits: () => Promise<DbResult<KitWithRelations[]>>;
  getFavoriteKitsCount: () => Promise<DbResult<number>>;
  getKit: (kitName: string) => Promise<DbResult<KitWithRelations>>;
  getKitDeleteSummary: (kitName: string) => Promise<
    DbResult<{
      kitName: string;
      locked: boolean;
      sampleCount: number;
      voiceCount: number;
    }>
  >;
  getKits: () => Promise<DbResult<KitWithRelations[]>>;
  getKitsMetadata: () => Promise<DbResult<Kit[]>>;
  getLocalStoreStatus: () => Promise<LocalStoreValidationDetailedResult>;
  getSampleAudioBuffer: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => Promise<DbResult<ArrayBuffer | null>>;
  getSetting: (key: SettingsKey) => Promise<unknown>;
  getUserHomeDir: () => Promise<string>;
  insertKit: (dbDir: string, kit: NewKit) => Promise<DbResult>;
  insertSample: (
    dbDir: string,
    sample: NewSample,
  ) => Promise<DbResult<{ sampleId: number }>>;
  listFilesInRoot: (localStorePath: string) => Promise<string[]>;
  moveSampleBetweenKits: (
    fromKit: string,
    fromVoice: number,
    fromSlot: number,
    toKit: string,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ) => Promise<
    DbResult<{
      affectedSamples: ({ original_slot_number: number } & Sample)[];
      movedSample: Sample;
      replacedSample?: Sample;
    }>
  >;
  moveSampleInKit: (
    kitName: string,
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
  ) => Promise<
    DbResult<{
      affectedSamples: Sample[];
      movedSample: Sample;
      replacedSample?: Sample;
    }>
  >;
  onSyncProgress: (callback: (progress: SyncProgress) => void) => void;
  openExternal: (url: string) => Promise<{ error?: string; success: boolean }>;
  readFile: (filePath: string) => Promise<DbResult<ArrayBuffer>>;
  readSettings: () => Promise<SettingsData>;
  replaceSampleInSlot: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<DbResult<{ sampleId: number }>>;
  rescanKit: (kitName: string) => Promise<DbResult<KitScanResult>>;
  rescanKitsMissingMetadata: () => Promise<
    DbResult<{
      kitsNeedingRescan: string[];
      kitsRescanned: string[];
      totalSamplesUpdated: number;
    }>
  >;
  scanBanks: () => Promise<
    DbResult<{ scannedAt: Date; scannedFiles: number; updatedBanks: number }>
  >;
  selectExistingLocalStore: () => Promise<{
    error: null | string;
    path: null | string;
    success: boolean;
  }>;
  selectLocalStorePath: () => Promise<string | undefined>;
  selectSdCard: () => Promise<null | string>;
  setSetting: (key: SettingsKey, value: unknown) => Promise<void>;
  showItemInFolder: (path: string) => Promise<unknown>;
  startKitSync: (options: SyncOptions) => Promise<DbResult<SyncOutcome>>;
  toggleKitFavorite: (
    kitName: string,
  ) => Promise<DbResult<{ isFavorite: boolean }>>;
  updateBank: (
    bankLetter: string,
    updates: { artist?: null | string; rtf_filename?: null | string },
  ) => Promise<DbResult<void>>;
  updateKit: (
    kitName: string,
    updates: {
      alias?: string;
      artist?: string;
      description?: string;
      editable?: boolean;
      tags?: string[];
    },
  ) => Promise<DbResult>;
  updateKitBpm: (kitName: string, bpm: number) => Promise<DbResult>;
  updateKitSlicerDivision: (
    kitName: string,
    division: number,
  ) => Promise<DbResult>;
  updateSampleGain: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    gainDb: number,
  ) => Promise<DbResult>;
  updateSliceSteps: (
    kitName: string,
    sliceSteps: (null | SliceStep)[][],
  ) => Promise<DbResult>;
  updateStepPattern: (
    kitName: string,
    stepPattern: number[][],
  ) => Promise<DbResult>;
  updateTriggerConditions: (
    kitName: string,
    triggerConditions: (null | string)[][],
  ) => Promise<DbResult>;
  updateVoiceAlias: (
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => Promise<DbResult>;
  updateVoiceSampleMode: (
    kitName: string,
    voiceNumber: number,
    sampleMode: string,
  ) => Promise<DbResult>;
  updateVoiceSliceSettings: (
    kitName: string,
    voiceNumber: number,
    settings: Partial<VoiceSliceSettings>,
  ) => Promise<DbResult>;
  updateVoiceStereoMode: (
    kitName: string,
    voiceNumber: number,
    stereoMode: boolean,
  ) => Promise<DbResult>;
  updateVoiceVolume: (
    kitName: string,
    voiceNumber: number,
    volume: number,
  ) => Promise<DbResult>;
  validateLocalStore: (
    localStorePath?: string,
  ) => Promise<LocalStoreValidationDetailedResult>;
  validateLocalStoreBasic: (
    localStorePath?: string,
  ) => Promise<LocalStoreValidationDetailedResult>;
  validateSampleFormat: (
    filePath: string,
  ) => Promise<DbResult<FormatValidationResult>>;
  validateSampleSources: (kitName: string) => Promise<
    DbResult<{
      invalidSamples: Array<{
        error: string;
        filename: string;
        source_path: string;
      }>;
      totalSamples: number;
      validSamples: number;
    }>
  >;
  writeSettings: (key: string, value: unknown) => Promise<void>;
}

// createRomperDb returns a DbResult extended with the created file path
export interface RomperDbResult extends DbResult<void> {
  dbPath?: string;
}

export interface SettingsData {
  confirmDestructiveActions?: boolean;
  localStorePath?: string;
  sdCardPath?: string;
  theme?: string;
  themeMode?: "dark" | "light" | "system";
}

export type SettingsKey = keyof SettingsData;

export interface SyncBankSummary {
  bank: string;
  fileCount: number;
  hasConversions: boolean;
  kitCount: number;
}

export interface SyncChangeSummary {
  banks: SyncBankSummary[];
  /** Files that will be written to the card */
  fileCount: number;
  kitCount: number;
  /** Samples that can't be written (missing or unreadable source files) */
  validationErrors: SyncValidationError[];
  warnings: string[];
}

export interface SyncOptions {
  sdCardPath: string;
  /**
   * Confirms the user chose to write everything except the samples listed
   * in the summary's validationErrors. Without it, sync refuses to start
   * while any sample would be skipped.
   */
  skipInvalidFiles?: boolean;
  wipeSdCard?: boolean;
}

export interface SyncOutcome {
  skippedFiles: SyncValidationError[];
  syncedFiles: number;
  warnings: string[];
}

// The sync progress events forwarded over the "sync-progress" channel.
// NOTE: this is the renderer-facing shape; reconciling it with the main
// process emitters is tracked as the SyncProgress consolidation follow-up.
export interface SyncProgress {
  bytesCompleted: number;
  currentFile: string;
  currentKitName?: string;
  error?: string;
  errorDetails?: {
    canRetry: boolean;
    error: string;
    fileName: string;
    kitName?: string;
    operation: "convert" | "copy";
  };
  filesCompleted: number;
  status:
    | "completed"
    | "converting"
    | "copying"
    | "error"
    | "finalizing"
    | "preparing";
  totalBytes: number;
  totalFiles: number;
}

export interface SyncValidationError {
  error: string;
  filename: string;
  kitName?: string;
  sourcePath: string;
  type: "access_denied" | "invalid_format" | "missing_file" | "other";
}

import type { FormatValidationResult, SampleAudio } from "./audioTypes.js";
import type {
  Bank,
  DbResult,
  KitScanResult,
  KitWithRelations,
  LocalStoreValidationDetailedResult,
  Sample,
} from "./db/schema.js";
import type { SliceStep, VoiceSliceSettings } from "./sliceTypes.js";
import type { WriteStereoSummary } from "./stereoLinkRules.js";
import type { SequenceSnapshot, VoiceSnapshot } from "./undoTypes.js";

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
  /** Stop the setup download or extraction in progress (RE-66) */
  cancelSetup: () => Promise<{ success: boolean }>;
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
  /**
   * Check the files of a kit's samples that aren't known to be readable
   * (status unknown, missing or unreadable), in one batch, and record what
   * was found (#537). `changed` counts samples whose status or WAV details
   * changed. The kit editor calls it once when a kit opens.
   */
  checkKitSampleFiles: (
    kitName: string,
  ) => Promise<DbResult<{ changed: number; checked: number }>>;
  checkPathWritable: (
    targetPath: string,
  ) => Promise<{ error?: string; writable: boolean }>;
  // Moves aside a .romperdb that setup created this session; refuses others
  cleanupPartialInit: (
    targetPath: string,
  ) => Promise<{ error?: string; movedTo?: string; removed: boolean }>;
  closeApp: () => Promise<void>;
  copyDir: (
    src: string,
    dest: string,
  ) => Promise<{ error?: string; success: boolean }>;
  copyKit: (sourceKit: string, destKit: string) => Promise<DbResult>;
  createKit: (kitSlot: string) => Promise<DbResult>;
  /**
   * Setup-wizard channels (createRomperDb, setupImportKit,
   * setupImportBankNames) name the
   * new store's `.romperdb` folder because it isn't configured yet; main
   * rejects any folder outside the roots it has granted (RE-03).
   */
  createRomperDb: (dbDir: string) => Promise<RomperDbResult>;
  deleteKit: (kitName: string) => Promise<DbResult>;
  deleteSampleFromSlot: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => Promise<
    DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }>
  >;
  /**
   * Installs the Squarp factory samples; main owns the archive URL.
   * `retryable` is set only when downloading again could succeed (RE-77).
   */
  downloadAndExtractArchive: (
    destDir: string,
    onProgress?: (p: unknown) => void,
    onError?: (e: unknown) => void,
  ) => Promise<{ cancelled?: boolean; retryable?: boolean } & DbResult>;
  ensureDir: (dir: string) => Promise<unknown>;
  /**
   * The store setup built at `targetPath` is complete, so quitting no longer
   * cleans it up, even if saving it as the local store fails (#616)
   */
  finishSetup: (
    targetPath: string,
  ) => Promise<{ error?: string; success: boolean }>;
  generateSyncChangeSummary: (
    sdCardPath?: string,
  ) => Promise<DbResult<SyncChangeSummary>>;
  getAllBanks: () => Promise<DbResult<Bank[]>>;
  getAllSamplesForKit: (kitName: string) => Promise<DbResult<Sample[]>>;
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
  getLocalStoreStatus: () => Promise<LocalStoreValidationDetailedResult>;
  /**
   * The slot's audio file, or null for an empty slot. With `knownVersion`
   * (a `SampleAudio.version` from an earlier call), the file isn't read or
   * sent when it's still that version: `bytes` comes back null (#478).
   */
  getSampleAudioBuffer: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    knownVersion?: string,
  ) => Promise<DbResult<null | SampleAudio>>;
  getUserHomeDir: () => Promise<string>;
  /** A folder's entries; setup lists the card with it (#724) */
  listFilesInRoot: (localStorePath: string) => Promise<DbResult<string[]>>;
  moveSampleBetweenKits: (
    fromKit: string,
    fromVoice: number,
    fromSlot: number,
    toKit: string,
    toVoice: number,
    toSlot: number,
    mode: "insert",
  ) => Promise<
    DbResult<{
      affectedSamples: ({ original_slot_number: number } & Sample)[];
      movedSample: Sample;
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
    }>
  >;
  /**
   * Call `callback` when main finds the local store's database file missing
   * (deleted or moved while Romper runs, #535). Returns a function that
   * stops listening.
   */
  onLocalStoreDatabaseMissing: (callback: () => void) => () => void;
  onSyncProgress: (callback: (progress: SyncProgress) => void) => void;
  openExternal: (url: string) => Promise<{ error?: string; success: boolean }>;
  readSettings: () => Promise<SettingsData>;
  /**
   * Ask main to allow a setup-wizard target folder the user typed. Main
   * confirms it with the user in a native prompt unless it is already inside
   * a folder Romper has been given.
   */
  requestLocalStoreAccess: (
    targetPath: string,
  ) => Promise<{ error?: string; granted: boolean }>;
  rescanKit: (kitName: string) => Promise<DbResult<KitScanResult>>;
  /**
   * Put back the given parts of a kit's sequence (steps, trigger conditions,
   * slices) for undo and redo, in one write: all of them or none (#570).
   */
  restoreKitSequence: (
    kitName: string,
    parts: Partial<SequenceSnapshot>,
  ) => Promise<DbResult<void>>;
  /**
   * Put a kit's voices back as an undo snapshot had them: rows, slots,
   * gain and WAV details, in one transaction (RE-86).
   */
  restoreKitVoices: (
    kitName: string,
    voices: VoiceSnapshot[],
  ) => Promise<DbResult<void>>;
  selectExistingLocalStore: () => Promise<{
    error: null | string;
    path: null | string;
    success: boolean;
  }>;
  selectLocalStorePath: () => Promise<string | undefined>;
  selectSdCard: () => Promise<null | string>;
  setSetting: (key: SettingsKey, value: unknown) => Promise<void>;
  /**
   * Import the bank names in `sourcePath`'s name files into the store setup
   * is creating, in main: the card setup is copying from (#564), or the
   * store the factory archive was extracted into (#567).
   */
  setupImportBankNames: (
    dbDir: string,
    sourcePath: string,
  ) => Promise<DbResult<{ importedBanks: number }>>;
  /**
   * Import one kit folder into the store setup is creating, in main: the
   * kit, its samples (12 per voice), WAV metadata and voice names. Files
   * over the limit come back in `skippedFiles` (RE-34).
   */
  setupImportKit: (
    dbDir: string,
    kitName: string,
  ) => Promise<DbResult<KitScanResult>>;
  showItemInFolder: (path: string) => Promise<unknown>;
  startKitSync: (options: SyncOptions) => Promise<DbResult<SyncOutcome>>;
  toggleKitFavorite: (
    kitName: string,
  ) => Promise<DbResult<{ isFavorite: boolean }>>;
  updateBank: (
    bankLetter: string,
    updates: { artist?: null | string },
  ) => Promise<DbResult<void>>;
  updateKit: (
    kitName: string,
    updates: KitMetadataUpdates,
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
}

// createRomperDb returns a DbResult extended with the created file path
/**
 * The kit details `updateKit` may change. Main refuses any other field
 * (RE-22): the rest of a kit has its own channel or belongs to main.
 */
export interface KitMetadataUpdates {
  alias?: null | string;
  editable?: boolean;
}

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
  /**
   * Rample content on the card that sync will delete because the store no
   * longer has it (paths relative to the card). Empty without a card path.
   */
  removals: string[];
  /**
   * Stereo pairs linked automatically, mixdowns, and quarantined kits,
   * which aren't written and whose copy on the card is kept (#537)
   */
  stereo: WriteStereoSummary;
  /** Samples that can't be written (missing source files) */
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
}

export interface SyncOutcome {
  /** The user cancelled; writing stopped after the file in progress */
  cancelled: boolean;
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
  /**
   * While status is "removing": entries removed from the card so far, of
   * those the store no longer has (#653)
   */
  removal?: { completed: number; total: number };
  status:
    | "completed"
    | "converting"
    | "copying"
    | "error"
    | "finalizing"
    | "preparing"
    | "removing";
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

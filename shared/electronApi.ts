import type { FormatValidationResult, SampleAudio } from "./audioTypes.js";
import type {
  Bank,
  DbResult,
  KitEdit,
  KitScanResult,
  KitWithRelations,
  LocalStoreValidationDetailedResult,
  Sample,
} from "./db/schema.js";
import type { RampleKitSaveView } from "./rampleKitSaveView.js";
import type { RampleSaveBackupResult } from "./rampleSave.js";
import type { SliceStep, VoiceSliceSettings } from "./sliceTypes.js";
import type { WriteStereoSummary } from "./stereoLinkRules.js";
import type { SequenceSnapshot, VoiceSnapshot } from "./undoTypes.js";

/** Why the factory-samples install failed, sent over "archive-error" */
export interface ArchiveError {
  message?: string;
}

/**
 * A factory-samples download or extraction progress event, sent over the
 * "archive-progress" channel. `percent` is null while the size is unknown.
 */
export interface ArchiveProgress {
  file?: string;
  percent: null | number;
  phase: string;
}

/**
 * THE canonical contract for the preload bridge (window.electronAPI).
 *
 * Single source of truth, enforced on every side (#472):
 * - the preload implements it via `satisfies ElectronAPI`, so a missing or
 *   drifted method is a COMPILE ERROR in the preload build;
 * - the channels behind it (shared/ipcChannels.ts) are derived from it, and
 *   main registers each handler through that map (electron/main/ipcHandle.ts),
 *   so a handler whose arguments or result drift fails typecheck;
 * - the renderer's global declaration (app/renderer/electron.d.ts) imports
 *   this same type, so call sites see exactly what the preload exposes;
 * - the renderer tests' mock (tests/mocks/electron/electronAPI.ts) is
 *   checked against it too.
 *
 * A member that resolves with a result reports a failure the caller can act
 * on in it (`success: false` with `error`, or its own field such as
 * `isValid`), rather than rejecting.
 *
 * Every member is required: an optional member turns missing wiring into a
 * silent no-op at `?.` call sites — the bug class behind the dead About
 * links, the phantom playback API, and three orphaned IPC channels.
 * tests/unit/ipcChannelParity.test.ts guards that every channel is both
 * invoked and handled.
 */
export interface ElectronAPI {
  addSampleToSlot: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
  ) => Promise<DbResult<{ sampleId: number } & SampleEditKit>>;
  /** Stop the write in progress after the file being written */
  cancelKitSync: () => Promise<void>;
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
  /** Resolves to the new kit, samples and all, when it can be read back (#452) */
  copyKit: (
    sourceKit: string,
    destKit: string,
  ) => Promise<DbResult<KitWithRelations>>;
  /** Resolves to the new kit, when it can be read back (#452) */
  createKit: (kitSlot: string) => Promise<DbResult<KitWithRelations>>;
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
    DbResult<
      { affectedSamples: Sample[]; deletedSamples: Sample[] } & SampleEditKit
    >
  >;
  /**
   * Installs the Squarp factory samples; main owns the archive URL.
   * `retryable` is set only when downloading again could succeed (RE-77).
   */
  downloadAndExtractArchive: (
    destDir: string,
    onProgress?: (progress: ArchiveProgress) => void,
    onError?: (error: ArchiveError) => void,
  ) => Promise<{ cancelled?: boolean; retryable?: boolean } & DbResult>;
  ensureDir: (dir: string) => Promise<{ error?: string; success: boolean }>;
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
  /**
   * The settings the Rample saved for a kit (`_save/<kit>.rpl`), from the
   * latest copy of the card's `_save` folder in the store (#800). Read-only;
   * the card isn't read.
   */
  getKitRampleSave: (kitName: string) => Promise<DbResult<RampleKitSaveView>>;
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
  /**
   * What the background store check has found so far (#812). The kit grid
   * calls it once it has loaded: the first call also starts the check.
   */
  getStoreCheckStatus: () => Promise<DbResult<StoreCheckStatus>>;
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
    DbResult<
      {
        affectedSamples: Sample[];
        movedSample: Sample;
      } & SampleEditKit
    >
  >;
  /**
   * Call `callback` when main finds the local store's database file missing
   * (deleted or moved while Romper runs, #535). Returns a function that
   * stops listening.
   */
  onLocalStoreDatabaseMissing: (callback: () => void) => () => void;
  /**
   * Call `callback` with the kits whose finding changed in a step of the
   * store check (#812). Returns a function that stops listening.
   */
  onStoreCheckUpdated: (
    callback: (update: StoreCheckUpdate) => void,
  ) => () => void;
  /**
   * Call `callback` with each progress event of the write in progress. It
   * replaces the previous callback; returns a function that stops listening.
   */
  onSyncProgress: (callback: (progress: SyncProgress) => void) => () => void;
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
   * Copy the card's `_save` folder into the store setup is creating, in
   * main (#802, stage 2 of #786). Read-only on the card; a copy that fails
   * comes back as `status: "failed"`, not as an error, so setup carries
   * on. A card that stopped responding is an error, with setup's
   * card-not-responding message, and stops setup.
   */
  setupBackupRampleSave: (
    dbDir: string,
    cardPath: string,
  ) => Promise<DbResult<RampleSaveBackupResult>>;
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
  showItemInFolder: (path: string) => Promise<void>;
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
  ) => Promise<DbResult<KitEdit>>;
  updateSampleGain: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    gainDb: number,
  ) => Promise<DbResult>;
  updateSliceSteps: (
    kitName: string,
    sliceSteps: (null | SliceStep)[][],
  ) => Promise<DbResult<KitEdit>>;
  updateStepPattern: (
    kitName: string,
    stepPattern: number[][],
  ) => Promise<DbResult<KitEdit>>;
  updateTriggerConditions: (
    kitName: string,
    triggerConditions: (null | string)[][],
  ) => Promise<DbResult<KitEdit>>;
  updateVoiceAlias: (
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => Promise<DbResult<KitEdit>>;
  updateVoiceSampleMode: (
    kitName: string,
    voiceNumber: number,
    sampleMode: string,
  ) => Promise<DbResult<KitEdit>>;
  updateVoiceSliceSettings: (
    kitName: string,
    voiceNumber: number,
    settings: Partial<VoiceSliceSettings>,
  ) => Promise<DbResult<KitEdit>>;
  updateVoiceStereoMode: (
    kitName: string,
    voiceNumber: number,
    stereoMode: boolean,
  ) => Promise<DbResult<KitEdit>>;
  updateVoiceVolume: (
    kitName: string,
    voiceNumber: number,
    volume: number,
  ) => Promise<DbResult<KitEdit>>;
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

/**
 * The preload's second bridge (window.electronFileAPI): the path of a file
 * the user dropped, which main then allows reading (RE-03).
 */
export interface ElectronFileAPI {
  getDroppedFilePath: (file: File) => Promise<string>;
}

/**
 * The kit details `updateKit` may change. Main refuses any other field
 * (RE-22): the rest of a kit has its own channel or belongs to main.
 */
export interface KitMetadataUpdates {
  alias?: null | string;
  editable?: boolean;
}

/** The arguments `moveSampleBetweenKits` sends over its channel, as one object */
export interface MoveSampleBetweenKitsParams {
  fromKit: string;
  fromSlot: number;
  fromVoice: number;
  mode: "insert";
  toKit: string;
  toSlot: number;
  toVoice: number;
}

// createRomperDb returns a DbResult extended with the created file path
export interface RomperDbResult extends DbResult<void> {
  dbPath?: string;
}

/**
 * The environment the preload exposes as window.romperEnv, for end-to-end
 * tests
 */
export interface RomperEnv {
  ROMPER_LOCAL_PATH?: string;
  ROMPER_SDCARD_PATH?: string;
  ROMPER_SQUARP_ARCHIVE_URL?: string;
  ROMPER_TEST_MODE?: string;
}

/**
 * What a sample edit returns besides its own result (#452): the kit as the
 * edit left it, samples and all, so the renderer shows it instead of
 * reading it again; and for an edit undo can put back, the edited voices'
 * rows as they were before it, so the renderer doesn't read them first.
 * Either is left out if it can't be read.
 */
export interface SampleEditKit {
  kit?: KitWithRelations;
  voicesBefore?: VoiceSnapshot[];
}

export interface SettingsData {
  confirmDestructiveActions?: boolean;
  localStorePath?: null | string;
  sdCardPath?: null | string;
  theme?: string;
  themeMode?: "dark" | "light" | "system";
}

export type SettingsKey = keyof SettingsData;

/**
 * What the store check found about one kit's sample files (#812): rows
 * whose file is missing, rows whose file can't be read, and whether that
 * quarantines the kit. Folder findings come with a later stage of
 * docs/developer/store-check.md.
 */
export interface StoreCheckKitFinding {
  kitName: string;
  missing: number;
  quarantined: boolean;
  unreadable: number;
}

/** Where the store check is */
export type StoreCheckState = "idle" | "paused" | "running";

/** The store check so far; `kits` lists only kits with a finding */
export interface StoreCheckStatus {
  kits: StoreCheckKitFinding[];
  lastCompletedAt: null | number;
  state: StoreCheckState;
}

/**
 * Sent over the "store-check-updated" channel: the kits whose finding
 * changed in a step, a kit that's now clean included with zero counts
 */
export interface StoreCheckUpdate {
  kits: StoreCheckKitFinding[];
  state: StoreCheckState;
}

export interface SyncBankSummary {
  bank: string;
  fileCount: number;
  hasConversions: boolean;
  kitCount: number;
}

export interface SyncChangeSummary {
  banks: SyncBankSummary[];
  /**
   * Files the write re-encodes, by why (#576): their format (including a
   * mixdown to mono), or only to apply their gain
   */
  conversions: { format: number; gain: number };
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

/** A file a write couldn't convert or copy, in a progress event */
export interface SyncErrorDetails {
  canRetry: boolean;
  error: string;
  fileName: string;
  kitName?: string;
  operation: "convert" | "copy";
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
  /**
   * The user cancelled: writing stopped after the file in progress, and
   * nothing was removed from the card or marked as synced. Cancel during
   * the removal of what the store no longer has stops after the entry in
   * progress (#653); the next write removes the rest.
   */
  cancelled: boolean;
  /**
   * The copy of the card's `_save` folder taken before the write (#802,
   * stage 2 of #786). A copy that failed didn't stop the write, and the
   * write panel says so when it finishes; a card that stopped responding
   * during the copy fails the write instead.
   */
  rampleSaveBackup?: RampleSaveBackupResult;
  /** Samples that were not written because they failed validation */
  skippedFiles: SyncValidationError[];
  syncedFiles: number;
  warnings: string[];
}

/**
 * A progress event of the write in progress, sent over the "sync-progress"
 * channel (syncProgressManager in main)
 */
export interface SyncProgress {
  currentFile: string;
  /** 0 when the current file starts, 100 when it's written */
  currentFileProgress?: number;
  currentKitName?: string;
  /** Milliseconds since the write started */
  elapsedTime: number;
  errorDetails?: SyncErrorDetails;
  /** Seconds, from the files written so far */
  estimatedTimeRemaining: number;
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
    | "removing";
  totalFiles: number;
}

export interface SyncValidationError {
  error: string;
  filename: string;
  kitName?: string;
  sourcePath: string;
  type: "access_denied" | "invalid_format" | "missing_file" | "other";
  /**
   * The file is there but its WAV can't be read: the kit is quarantined
   * rather than written without it (#537 rule 4)
   */
  unreadable?: boolean;
}

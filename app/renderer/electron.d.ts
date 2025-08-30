import type {
  Bank,
  DbResult,
  KitValidationError,
  KitWithRelations,
  LocalStoreValidationDetailedResult,
  NewKit,
  NewSample,
  Sample,
} from "@romper/shared/db/schema.js";

// Import shared types from the schema file
import type {
  AudioMetadata,
  FormatIssue,
  FormatValidationResult,
} from "../../electron/main/audioUtils.js";

export {
  Bank,
  DbResult,
  FormatIssue,
  FormatValidationResult,
  KitValidationError,
  LocalStoreValidationDetailedResult,
  NewKit,
  Sample,
};

export interface ElectronAPI {
  // Task 5.2.2 & 5.2.3: Sample management operations for drag-and-drop editing
  addSampleToSlot?: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
    options?: { forceMono?: boolean; forceStereo?: boolean },
  ) => Promise<DbResult<{ sampleId: number }>>;
  cancelKitSync?: () => void;
  closeApp?: () => Promise<void>;
  copyDir?: (src: string, dest: string) => Promise<void>;
  copyKit?: (sourceKit: string, destKit: string) => Promise<void>;
  createKit?: (kitSlot: string) => Promise<void>;
  // Missing methods causing errors
  createRomperDb?: (dbDir: string) => Promise<RomperDbResult>;
  deleteSampleFromSlot?: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => Promise<
    DbResult<{ affectedSamples: Sample[]; deletedSamples: Sample[] }>
  >;
  deleteSampleFromSlotWithoutReindexing?: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => Promise<DbResult<{ deletedSamples: Sample[] }>>;
  downloadAndExtractArchive?: (
    url: string,
    destDir: string,
    onProgress?: (p: unknown) => void,
    onError?: (e: unknown) => void,
  ) => Promise<DbResult>;
  ensureDir?: (dir: string) => Promise<void>;
  // Task 8.1: SD Card Sync Operations
  generateSyncChangeSummary?: (sdCardPath?: string) => Promise<
    DbResult<{
      estimatedSize: number;
      estimatedTime: number;
      filesToConvert: Array<{
        destinationPath: string;
        filename: string;
        operation: "convert" | "copy";
        originalFormat?: string;
        reason?: string;
        sourcePath: string;
        targetFormat?: string;
      }>;
      filesToCopy: Array<{
        destinationPath: string;
        filename: string;
        operation: "convert" | "copy";
        originalFormat?: string;
        reason?: string;
        sourcePath: string;
        targetFormat?: string;
      }>;
      hasFormatWarnings: boolean;
      validationErrors: Array<{
        error: string;
        filename: string;
        sourcePath: string;
        type: "access_denied" | "invalid_format" | "missing_file" | "other";
      }>;
      warnings: string[];
    }>
  >;
  // Bank operations
  getAllBanks?: () => Promise<DbResult<Bank[]>>;
  getAllSamples?: (dbDir: string) => Promise<DbResult<Sample[]>>;
  getAllSamplesForKit?: (kitName: string) => Promise<DbResult<Sample[]>>;
  // Task 6.1: Format validation for WAV files
  getAudioMetadata?: (filePath: string) => Promise<DbResult<AudioMetadata>>;
  getFavoriteKits?: () => Promise<DbResult<KitWithRelations[]>>;
  getFavoriteKitsCount?: () => Promise<DbResult<number>>;
  // Database methods for kit metadata (replacing JSON file dependency)
  getKit?: (kitName: string) => Promise<DbResult<KitWithRelations>>;
  getKits?: () => Promise<
    DbResult<
      Array<{
        alias?: string;
        artist?: string;
        editable: boolean;
        id: number;
        locked: boolean;
        name: string;
        step_pattern?: number[][];
        voices: { [voiceNumber: number]: string };
      }>
    >
  >;
  getKitsMetadata?: () => Promise<
    DbResult<
      Array<{
        alias?: string;
        artist?: string;
        editable: boolean;
        id: number;
        locked: boolean;
        name: string;
        step_pattern?: number[][];
        voices: { [voiceNumber: number]: string };
      }>
    >
  >;
  getLocalStoreStatus: () => Promise<LocalStoreValidationDetailedResult>;
  getSampleAudioBuffer?: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => Promise<ArrayBuffer | null>;
  getSetting: (
    key: keyof {
      confirmDestructiveActions?: boolean;
      defaultToMonoSamples?: boolean;
      localStorePath?: string;
      theme?: string;
      themeMode?: "dark" | "light" | "system";
    },
  ) => Promise<unknown>;
  getUserHomeDir?: () => Promise<string>;
  insertKit?: (dbDir: string, kit: NewKit) => Promise<DbResult>;

  insertSample?: (
    dbDir: string,
    sample: NewSample,
  ) => Promise<InsertSampleResult>;
  listFilesInRoot?: (localStorePath: string) => Promise<string[]>;
  // Cross-kit sample movement with source reindexing
  moveSampleBetweenKits?: (
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
  // Task 22.2: Move samples within kit with contiguity maintenance
  moveSampleInKit?: (
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
  onSamplePlaybackEnded?: (cb: () => void) => void;
  onSamplePlaybackError?: (cb: (errMsg: string) => void) => void;
  onSyncProgress?: (
    callback: (progress: {
      bytesCompleted: number;
      currentFile: string;
      error?: string;
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
    }) => void,
  ) => void;
  openExternal?: (url: string) => Promise<void>;
  playSample?: (
    filePath: string,
    options?: { channel?: "left" | "mono" | "right" | "stereo" },
  ) => Promise<unknown>;
  readAudioFile?: (filePath: string) => Promise<DbResult<ArrayBuffer>>; // ArrayBuffer for audio files
  readFile?: (filePath: string) => Promise<DbResult<ArrayBuffer>>; // Returns file content as ArrayBuffer
  readSettings: () => Promise<{
    confirmDestructiveActions?: boolean;
    defaultToMonoSamples?: boolean;
    localStorePath?: string;
    sdCardPath?: string;
    theme?: string;
    themeMode?: "dark" | "light" | "system";
  }>;
  replaceSampleInSlot?: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
    options?: { forceMono?: boolean; forceStereo?: boolean },
  ) => Promise<DbResult<{ sampleId: number }>>;
  rescanKit: (
    kitName: string,
  ) => Promise<DbResult<{ scannedSamples: number; updatedVoices: number }>>;
  rescanKitsMissingMetadata: () => Promise<
    DbResult<{
      kitsNeedingRescan: string[];
      kitsRescanned: string[];
      totalSamplesUpdated: number;
    }>
  >;
  scanBanks?: () => Promise<
    DbResult<{ scannedAt: Date; scannedFiles: number; updatedBanks: number }>
  >;
  // Search operations
  searchKits?: (params: { limit?: number; query: string }) => Promise<
    DbResult<{
      kits: KitWithRelations[];
      queryTime: number;
      totalCount: number;
    }>
  >;

  // Existing local store selection
  selectExistingLocalStore?: () => Promise<{
    error: null | string;
    path: null | string;
    success: boolean;
  }>;
  selectLocalStorePath?: () => Promise<string | undefined>;
  selectSdCard: () => Promise<null | string>;

  setSetting: (
    key: keyof {
      confirmDestructiveActions?: boolean;
      defaultToMonoSamples?: boolean;
      localStorePath?: string;
      theme?: string;
      themeMode?: "dark" | "light" | "system";
    },
    value: unknown,
  ) => Promise<void>;

  showItemInFolder: (path: string) => Promise<void>;

  startKitSync?: (options: {
    sdCardPath: string;
    wipeSdCard?: boolean;
  }) => Promise<DbResult<{ syncedFiles: number }>>;

  stopSample?: () => Promise<unknown>;
  // Task 20.1: Favorites system
  toggleKitFavorite?: (
    kitName: string,
  ) => Promise<DbResult<{ isFavorite: boolean }>>;
  updateKit?: (
    kitName: string,
    updates: {
      alias?: string;
      artist?: string;
      description?: string;
      editable?: boolean;
      tags?: string[];
    },
  ) => Promise<DbResult>;
  updateKitBpm?: (kitName: string, bpm: number) => Promise<DbResult>;
  updateSampleMetadata?: (
    sampleId: number,
    metadata: {
      wav_bit_depth?: null | number;
      wav_bitrate?: null | number;
      wav_channels?: null | number;
      wav_sample_rate?: null | number;
    },
  ) => Promise<DbResult>;
  updateStepPattern?: (
    kitName: string,
    stepPattern: number[][],
  ) => Promise<DbResult>;
  updateVoiceAlias?: (
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => Promise<DbResult>;
  validateLocalStore: (
    localStorePath?: string,
  ) => Promise<LocalStoreValidationDetailedResult>;

  validateLocalStore: (
    localStorePath?: string,
  ) => Promise<LocalStoreValidationDetailedResult>;
  validateLocalStoreBasic: (
    localStorePath?: string,
  ) => Promise<LocalStoreValidationDetailedResult>;
  validateSampleFormat?: (
    filePath: string,
  ) => Promise<DbResult<FormatValidationResult>>;
  // Task 5.2.5: Validate source_path files for existing samples
  validateSampleSources?: (kitName: string) => Promise<
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

// Custom type for insertSample return value
interface InsertSampleResult extends DbResult<void> {
  sampleId?: number;
}

// Custom type for createRomperDb return value
interface RomperDbResult extends DbResult<void> {
  dbPath?: string;
}

declare global {
  interface ImportMeta {
    env: {
      VITE_APP_VERSION?: string;
    };
  }

  interface Window {
    electronAPI: ElectronAPI;
    electronFileAPI?: {
      getDroppedFilePath: (file: File) => Promise<string>;
    };
  }
}

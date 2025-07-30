// Import shared types from the schema file
import type {
  AudioMetadata,
  FormatValidationResult,
} from "../../electron/main/audioUtils.js";
import type {
  Bank,
  DbResult,
  Kit,
  KitValidationError,
  KitWithRelations,
  LocalStoreValidationDetailedResult,
  NewKit,
  NewSample,
  Sample,
  Voice,
} from "../../shared/db/schema.js";

export {
  Bank,
  DbResult,
  KitValidationError,
  LocalStoreValidationDetailedResult,
  NewKit,
  Sample,
};

// Custom type for createRomperDb return value
interface RomperDbResult extends DbResult<void> {
  dbPath?: string;
}

// Custom type for insertSample return value
interface InsertSampleResult extends DbResult<void> {
  sampleId?: number;
}

export interface ElectronAPI {
  selectSdCard: () => Promise<string | null>;
  showItemInFolder: (path: string) => Promise<void>;
  readSettings: () => Promise<{
    localStorePath?: string;
    themeMode?: "light" | "system" | "dark";
    defaultToMonoSamples?: boolean;
    confirmDestructiveActions?: boolean;
    theme?: string;
  }>;
  setSetting: (
    key: keyof {
      localStorePath?: string;
      themeMode?: "light" | "system" | "dark";
      defaultToMonoSamples?: boolean;
      confirmDestructiveActions?: boolean;
      theme?: string;
    },
    value: any,
  ) => Promise<void>;
  getSetting: (
    key: keyof {
      localStorePath?: string;
      themeMode?: "light" | "system" | "dark";
      defaultToMonoSamples?: boolean;
      confirmDestructiveActions?: boolean;
      theme?: string;
    },
  ) => Promise<any>;
  createKit?: (kitSlot: string) => Promise<void>;
  copyKit?: (sourceKit: string, destKit: string) => Promise<void>;
  listFilesInRoot?: (localStorePath: string) => Promise<string[]>;
  closeApp?: () => Promise<void>;
  playSample?: (
    filePath: string,
    options?: { channel?: "left" | "right" | "mono" | "stereo" },
  ) => Promise<any>;
  stopSample?: () => Promise<any>;
  onSamplePlaybackEnded?: (cb: () => void) => void;
  onSamplePlaybackError?: (cb: (errMsg: string) => void) => void;
  getSampleAudioBuffer?: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => Promise<ArrayBuffer | null>;
  readFile?: (filePath: string) => Promise<DbResult<ArrayBuffer>>; // Returns file content as ArrayBuffer
  readAudioFile?: (filePath: string) => Promise<DbResult<ArrayBuffer>>; // ArrayBuffer for audio files
  validateLocalStore: (
    localStorePath?: string,
  ) => Promise<LocalStoreValidationDetailedResult>;
  getAllSamples?: (dbDir: string) => Promise<DbResult<Sample[]>>;
  getAllSamplesForKit?: (kitName: string) => Promise<DbResult<Sample[]>>;
  // Database methods for kit metadata (replacing JSON file dependency)
  getKit?: (kitName: string) => Promise<DbResult<KitWithRelations>>;
  updateKit?: (
    kitName: string,
    updates: {
      alias?: string;
      artist?: string;
      tags?: string[];
      description?: string;
      editable?: boolean;
    },
  ) => Promise<DbResult>;
  getKits?: () => Promise<
    DbResult<
      Array<{
        id: number;
        name: string;
        alias?: string;
        artist?: string;
        editable: boolean;
        locked: boolean;
        step_pattern?: number[][];
        voices: { [voiceNumber: number]: string };
      }>
    >
  >;
  updateVoiceAlias?: (
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => Promise<DbResult>;
  updateStepPattern?: (
    kitName: string,
    stepPattern: number[][],
  ) => Promise<DbResult>;
  getUserHomeDir?: () => Promise<string>;

  // Missing methods causing errors
  createRomperDb?: (dbDir: string) => Promise<RomperDbResult>;
  insertKit?: (dbDir: string, kit: NewKit) => Promise<DbResult>;
  insertSample?: (
    dbDir: string,
    sample: NewSample,
  ) => Promise<InsertSampleResult>;
  copyDir?: (src: string, dest: string) => Promise<void>;
  downloadAndExtractArchive?: (
    url: string,
    destDir: string,
    onProgress?: (p: any) => void,
    onError?: (e: any) => void,
  ) => Promise<DbResult>;
  ensureDir?: (dir: string) => Promise<void>;
  selectLocalStorePath?: () => Promise<string | undefined>;
  getLocalStoreStatus: () => Promise<LocalStoreValidationDetailedResult>;
  validateLocalStore: (
    localStorePath?: string,
  ) => Promise<LocalStoreValidationDetailedResult>;
  validateLocalStoreBasic: (
    localStorePath?: string,
  ) => Promise<LocalStoreValidationDetailedResult>;
  rescanKit: (
    kitName: string,
  ) => Promise<DbResult<{ scannedSamples: number; updatedVoices: number }>>;
  openExternal?: (url: string) => Promise<void>;
  // Bank operations
  getAllBanks?: () => Promise<DbResult<Bank[]>>;
  scanBanks?: () => Promise<
    DbResult<{ scannedFiles: number; updatedBanks: number; scannedAt: Date }>
  >;
  // Existing local store selection
  selectExistingLocalStore?: () => Promise<{
    success: boolean;
    path: string | null;
    error: string | null;
  }>;

  // Task 5.2.2 & 5.2.3: Sample management operations for drag-and-drop editing
  addSampleToSlot?: (
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
    filePath: string,
    options?: { forceMono?: boolean; forceStereo?: boolean },
  ) => Promise<DbResult<{ sampleId: number }>>;
  replaceSampleInSlot?: (
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
    filePath: string,
    options?: { forceMono?: boolean; forceStereo?: boolean },
  ) => Promise<DbResult<{ sampleId: number }>>;
  deleteSampleFromSlot?: (
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
  ) => Promise<DbResult<void>>;

  // Task 5.2.5: Validate source_path files for existing samples
  validateSampleSources?: (kitName: string) => Promise<
    DbResult<{
      totalSamples: number;
      invalidSamples: Array<{
        filename: string;
        source_path: string;
        error: string;
      }>;
      validSamples: number;
    }>
  >;

  // Task 6.1: Format validation for WAV files
  getAudioMetadata?: (filePath: string) => Promise<DbResult<AudioMetadata>>;
  validateSampleFormat?: (
    filePath: string,
  ) => Promise<DbResult<FormatValidationResult>>;

  // Task 8.1: SD Card Sync Operations
  generateSyncChangeSummary?: () => Promise<
    DbResult<{
      filesToCopy: Array<{
        filename: string;
        sourcePath: string;
        destinationPath: string;
        operation: "copy" | "convert";
        reason?: string;
        originalFormat?: string;
        targetFormat?: string;
      }>;
      filesToConvert: Array<{
        filename: string;
        sourcePath: string;
        destinationPath: string;
        operation: "copy" | "convert";
        reason?: string;
        originalFormat?: string;
        targetFormat?: string;
      }>;
      estimatedTime: number;
      estimatedSize: number;
      hasFormatWarnings: boolean;
      warnings: string[];
      validationErrors: Array<{
        filename: string;
        sourcePath: string;
        error: string;
        type: "missing_file" | "access_denied" | "invalid_format" | "other";
      }>;
    }>
  >;
  startKitSync?: (syncData: {
    filesToCopy: Array<{
      filename: string;
      sourcePath: string;
      destinationPath: string;
      operation: "copy" | "convert";
    }>;
    filesToConvert: Array<{
      filename: string;
      sourcePath: string;
      destinationPath: string;
      operation: "copy" | "convert";
    }>;
  }) => Promise<DbResult<{ syncedFiles: number }>>;
  cancelKitSync?: () => void;
  onSyncProgress?: (
    callback: (progress: {
      currentFile: string;
      filesCompleted: number;
      totalFiles: number;
      bytesCompleted: number;
      totalBytes: number;
      status:
        | "preparing"
        | "copying"
        | "converting"
        | "finalizing"
        | "completed"
        | "error";
      error?: string;
    }) => void,
  ) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electronFileAPI?: {
      getDroppedFilePath: (file: File) => Promise<string>;
    };
  }
}

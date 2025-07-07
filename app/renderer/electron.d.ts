// Import shared types from the dbTypesShared file
import {
  DbResult,
  KitValidationError,
  LocalStoreValidationDetailedResult,
  LocalStoreValidationResult,
  SampleRecord,
} from "../../shared/dbTypesShared";

export {
  DbResult,
  KitValidationError,
  LocalStoreValidationDetailedResult,
  LocalStoreValidationResult,
  SampleRecord,
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
  readSettings: () => Promise<{
    localStorePath?: string;
    darkMode?: boolean;
    theme?: string;
  }>;
  setSetting: (
    key: keyof {
      localStorePath?: string;
      darkMode?: boolean;
      theme?: string;
    },
    value: any,
  ) => Promise<void>;
  getSetting: (
    key: keyof {
      localStorePath?: string;
      darkMode?: boolean;
      theme?: string;
    },
  ) => Promise<any>;
  createKit?: (localStorePath: string, kitSlot: string) => Promise<void>;
  copyKit?: (
    localStorePath: string,
    sourceKit: string,
    destKit: string,
  ) => Promise<void>;
  listFilesInRoot?: (localStorePath: string) => Promise<string[]>;
  closeApp?: () => Promise<void>;
  playSample?: (filePath: string) => Promise<any>;
  stopSample?: () => Promise<any>;
  onSamplePlaybackEnded?: (cb: () => void) => void;
  onSamplePlaybackError?: (cb: (errMsg: string) => void) => void;
  getAudioBuffer?: (filePath: string) => Promise<ArrayBuffer>;
  readFile?: (filePath: string) => Promise<DbResult<ArrayBuffer>>; // Returns file content as ArrayBuffer
  readAudioFile?: (filePath: string) => Promise<DbResult<ArrayBuffer>>; // ArrayBuffer for audio files
  validateLocalStore: (
    localStorePath: string,
  ) => Promise<LocalStoreValidationDetailedResult>;
  getAllSamples?: (dbDir: string) => Promise<DbResult<SampleRecord[]>>;
  getAllSamplesForKit?: (
    dbDir: string,
    kitName: string,
  ) => Promise<DbResult<SampleRecord[]>>;
  // Database methods for kit metadata (replacing JSON file dependency)
  getKitMetadata?: (
    dbDir: string,
    kitName: string,
  ) => Promise<
    DbResult<{
      id: number;
      name: string;
      alias?: string;
      artist?: string;
      plan_enabled: boolean;
      locked: boolean;
      step_pattern?: number[][];
      voices: { [voiceNumber: number]: string };
    }>
  >;
  updateKitMetadata?: (
    dbDir: string,
    kitName: string,
    updates: {
      alias?: string;
      artist?: string;
      tags?: string[];
      description?: string;
    },
  ) => Promise<DbResult>;
  getAllKits?: (dbDir: string) => Promise<
    DbResult<
      Array<{
        id: number;
        name: string;
        alias?: string;
        artist?: string;
        plan_enabled: boolean;
        locked: boolean;
        step_pattern?: number[][];
        voices: { [voiceNumber: number]: string };
      }>
    >
  >;
  updateVoiceAlias?: (
    dbDir: string,
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => Promise<DbResult>;
  updateStepPattern?: (
    dbDir: string,
    kitName: string,
    stepPattern: number[][],
  ) => Promise<DbResult>;
  getUserHomeDir?: () => Promise<string>;
  readRampleLabels?: (localStorePath: string) => Promise<any>;
  writeRampleLabels?: (localStorePath: string, data: any) => Promise<void>;

  // Missing methods causing errors
  createRomperDb?: (dbDir: string) => Promise<RomperDbResult>;
  insertKit?: (dbDir: string, kit: KitRecord) => Promise<DbResult>;
  insertSample?: (
    dbDir: string,
    sample: SampleRecord,
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
    localStorePath: string,
  ) => Promise<LocalStoreValidationDetailedResult>;
  openExternal?: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

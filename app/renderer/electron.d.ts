export interface ElectronAPI {
  scanSdCard: (localStorePath: string) => Promise<string[]>;
  selectSdCard: () => Promise<string | null>;
  watchSdCard: (
    localStorePath: string,
    callback: () => void,
  ) => { close: () => Promise<void> };
  readSettings: () => Promise<{
    localStorePath?: string;
    darkMode?: boolean;
    theme?: string;
    localStorePath?: string;
  }>;
  setSetting: (
    key: keyof {
      localStorePath?: string;
      darkMode?: boolean;
      theme?: string;
      localStorePath?: string;
    },
    value: any,
  ) => Promise<void>;
  getSetting: (
    key: keyof {
      localStorePath?: string;
      darkMode?: boolean;
      theme?: string;
      localStorePath?: string;
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
  // Database methods for kit metadata (replacing JSON file dependency)
  getKitMetadata?: (dbDir: string, kitName: string) => Promise<{
    success: boolean;
    data?: {
      id: number;
      name: string;
      alias?: string;
      artist?: string;
      plan_enabled: boolean;
      locked: boolean;
      step_pattern?: number[][];
      voices: { [voiceNumber: number]: string };
    };
    error?: string;
  }>;
  updateKitMetadata?: (
    dbDir: string,
    kitName: string,
    updates: {
      alias?: string;
      artist?: string;
      tags?: string[];
      description?: string;
    },
  ) => Promise<{ success: boolean; error?: string }>;
  getAllKits?: (dbDir: string) => Promise<{
    success: boolean;
    data?: Array<{
      id: number;
      name: string;
      alias?: string;
      artist?: string;
      plan_enabled: boolean;
      locked: boolean;
      step_pattern?: number[][];
      voices: { [voiceNumber: number]: string };
    }>;
    error?: string;
  }>;
  updateVoiceAlias?: (
    dbDir: string,
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateStepPattern?: (
    dbDir: string,
    kitName: string,
    stepPattern: number[][],
  ) => Promise<{ success: boolean; error?: string }>;
  getUserHomeDir?: () => Promise<string>;
  selectLocalStorePath?: () => Promise<string>;
  downloadAndExtractArchive?: (
    url: string,
    destDir: string,
    onProgress?: (p: any) => void,
    onError?: (e: any) => void,
  ) => Promise<{ success: boolean; error?: string }>;
  ensureDir?: (dir: string) => Promise<any>;
  copyDir?: (src: string, dest: string) => Promise<any>;
  createRomperDb?: (
    dbDir: string,
  ) => Promise<{ success: boolean; error?: string; dbPath?: string }>;
  insertKit?: (
    dbDir: string,
    kit: {
      name: string;
      alias?: string;
      artist?: string;
      plan_enabled: boolean;
    },
  ) => Promise<any>;
  insertSample?: (
    dbDir: string,
    sample: {
      kit_name: string;
      filename: string;
      voice_number: number;
      slot_number: number;
      is_stereo: boolean;
    },
  ) => Promise<any>;
  getLocalStoreStatus?: () => Promise<{
    hasLocalStore: boolean;
    localStorePath: string | null;
    isValid: boolean;
    error?: string | null;
  }>;
  openExternal?: (url: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

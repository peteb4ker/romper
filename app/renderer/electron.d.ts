export interface ElectronAPI {
  scanSdCard: (sdCardPath: string) => Promise<string[]>;
  selectSdCard: () => Promise<string | null>;
  watchSdCard: (
    sdCardPath: string,
    callback: () => void,
  ) => { close: () => Promise<void> };
  readSettings: () => Promise<{
    sdCardPath?: string;
    darkMode?: boolean;
    theme?: string;
    localStorePath?: string;
  }>;
  setSetting: (
    key: keyof {
      sdCardPath?: string;
      darkMode?: boolean;
      theme?: string;
      localStorePath?: string;
    },
    value: any,
  ) => Promise<void>;
  getSetting: (
    key: keyof {
      sdCardPath?: string;
      darkMode?: boolean;
      theme?: string;
      localStorePath?: string;
    },
  ) => Promise<any>;
  createKit?: (sdCardPath: string, kitSlot: string) => Promise<void>;
  copyKit?: (
    sdCardPath: string,
    sourceKit: string,
    destKit: string,
  ) => Promise<void>;
  listFilesInRoot?: (sdCardPath: string) => Promise<string[]>;
  playSample?: (filePath: string) => Promise<any>;
  stopSample?: () => Promise<any>;
  onSamplePlaybackEnded?: (cb: () => void) => void;
  onSamplePlaybackError?: (cb: (errMsg: string) => void) => void;
  getAudioBuffer?: (filePath: string) => Promise<ArrayBuffer>;
  readRampleLabels?: (sdCardPath: string) => Promise<any>;
  writeRampleLabels?: (sdCardPath: string, labels: any) => Promise<void>;
  discardKitPlan?: (sdCardPath: string, kitName: string) => Promise<any>;
  rescanAllVoiceNames: (
    sdCardPath: string,
    kitNames: string[],
  ) => Promise<void>;
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
      kit_id: number;
      filename: string;
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

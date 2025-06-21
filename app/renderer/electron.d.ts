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
  readRampleLabels?: (localStorePath: string) => Promise<any>;
  writeRampleLabels?: (localStorePath: string, labels: any) => Promise<void>;
  discardKitPlan?: (localStorePath: string, kitName: string) => Promise<any>;
  rescanAllVoiceNames: (
    localStorePath: string,
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

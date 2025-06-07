export {};

interface ElectronAPI {
  scanSdCard: (sdCardPath: string) => Promise<string[]>;
  selectSdCard: () => Promise<string | null>;
  watchSdCard: (
    sdCardPath: string,
    callback: () => void,
  ) => { close: () => void };
  readSettings: () => Promise<{
    sdCardPath?: string;
    darkMode?: boolean;
    theme?: string;
  }>;
  setSetting: (
    key: keyof { sdCardPath?: string; darkMode?: boolean; theme?: string },
    value: any,
  ) => Promise<void>;
  getSetting: (
    key: keyof { sdCardPath?: string; darkMode?: boolean; theme?: string },
  ) => Promise<any>;
  createKit?: (sdCardPath: string, kitSlot: string) => Promise<void>;
  copyKit?: (
    sdCardPath: string,
    sourceKit: string,
    destKit: string,
  ) => Promise<void>;
  listFilesInRoot?: (sdCardPath: string) => Promise<string[]>;
  readRampleLabels?: (sdCardPath: string) => Promise<any>;
  writeRampleLabels?: (sdCardPath: string, labels: any) => Promise<void>;
  getAudioBuffer?: (filePath: string) => Promise<ArrayBuffer>;
  getDroppedFilePath?: (file: File) => Promise<string>;
  rescanAllVoiceNames: (
    sdCardPath: string,
    kitNames: string[],
  ) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

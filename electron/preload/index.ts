import type { NewKit, NewSample } from "@romper/shared/db/types.js";

const { contextBridge, ipcRenderer, webUtils } = require("electron");

// Determine if we're in development mode
const isDev = process.env.NODE_ENV === "development";

// ===== SETTINGS MANAGER =====
interface SettingsData {
  confirmDestructiveActions?: boolean;
  defaultToMonoSamples?: boolean;
  localStorePath?: string;
  theme?: string;
  themeMode?: "dark" | "light" | "system";
}

type SettingsKey = keyof SettingsData;
type SettingsValue = SettingsData[SettingsKey];

interface SyncProgress {
  bytesTransferred: number;
  currentFile: string;
  elapsedTime: number;
  estimatedTimeRemaining: number;
  filesCompleted: number;
  status: "complete" | "converting" | "copying" | "error" | "preparing";
  totalBytes: number;
  totalFiles: number;
}

class SettingsManager {
  async getSetting(key: SettingsKey): Promise<SettingsValue> {
    isDev && console.debug("[IPC] getSetting invoked", key);

    // For localStorePath, check environment variable first
    if (key === "localStorePath" && process.env.ROMPER_LOCAL_PATH) {
      return process.env.ROMPER_LOCAL_PATH;
    }

    const settings = await this.readSettings();
    return settings[key];
  }

  async readSettings(): Promise<SettingsData> {
    try {
      const settings = await ipcRenderer.invoke("read-settings");
      const parsedSettings =
        typeof settings === "string" ? JSON.parse(settings) : settings || {};

      // Override localStorePath with environment variable if set
      if (process.env.ROMPER_LOCAL_PATH) {
        parsedSettings.localStorePath = process.env.ROMPER_LOCAL_PATH;
      }

      return parsedSettings;
    } catch (e) {
      console.error("Failed to read settings:", e);
      // Even if reading settings fails, check for environment variable
      const fallbackSettings: SettingsData = {};
      if (process.env.ROMPER_LOCAL_PATH) {
        fallbackSettings.localStorePath = process.env.ROMPER_LOCAL_PATH;
      }
      return fallbackSettings;
    }
  }

  async setSetting(key: SettingsKey, value: SettingsValue): Promise<void> {
    isDev &&
      console.debug(`[IPC] setSetting called with key: ${key}, value:`, value);
    await this.writeSettings(key, value);
  }

  async writeSettings(key: SettingsKey, value: SettingsValue): Promise<void> {
    try {
      await ipcRenderer.invoke("write-settings", key, value);
    } catch (e) {
      console.error("Failed to write settings:", e);
    }
  }
}

const settingsManager = new SettingsManager();

// ===== MENU EVENT FORWARDER =====
interface MenuEventMap {
  "menu-about": void;
  "menu-change-local-store-directory": void;
  "menu-preferences": void;
  "menu-redo": void;
  "menu-scan-all-kits": void;
  "menu-scan-banks": void;
  "menu-setup-local-store": void;
  "menu-undo": void;
  "menu-validate-database": void;
}

class MenuEventForwarder {
  private eventMappings: Array<{
    domEvent: string;
    ipcEvent: keyof MenuEventMap;
  }> = [
    { domEvent: "menu-scan-all-kits", ipcEvent: "menu-scan-all-kits" },
    { domEvent: "menu-scan-banks", ipcEvent: "menu-scan-banks" },
    { domEvent: "menu-validate-database", ipcEvent: "menu-validate-database" },
    { domEvent: "menu-setup-local-store", ipcEvent: "menu-setup-local-store" },
    {
      domEvent: "menu-change-local-store-directory",
      ipcEvent: "menu-change-local-store-directory",
    },
    { domEvent: "menu-preferences", ipcEvent: "menu-preferences" },
    { domEvent: "menu-about", ipcEvent: "menu-about" },
    { domEvent: "menu-undo", ipcEvent: "menu-undo" },
    { domEvent: "menu-redo", ipcEvent: "menu-redo" },
  ];

  initialize(): void {
    this.eventMappings.forEach(({ domEvent, ipcEvent }) => {
      ipcRenderer.on(ipcEvent, () => {
        window.dispatchEvent(new CustomEvent(domEvent));
      });
    });
  }
}

const menuEventForwarder = new MenuEventForwarder();

// Expose environment variables to renderer for E2E testing
contextBridge.exposeInMainWorld("romperEnv", {
  ROMPER_LOCAL_PATH: process.env.ROMPER_LOCAL_PATH,
  ROMPER_SDCARD_PATH: process.env.ROMPER_SDCARD_PATH,
  ROMPER_SQUARP_ARCHIVE_URL: process.env.ROMPER_SQUARP_ARCHIVE_URL,
});

contextBridge.exposeInMainWorld("electronAPI", {
  // Task 5.2.2 & 5.2.3: Sample management operations for drag-and-drop editing
  addSampleToSlot: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
    options?: { forceMono?: boolean; forceStereo?: boolean },
  ) => {
    isDev &&
      console.debug(
        "[IPC] addSampleToSlot invoked",
        kitName,
        voiceNumber,
        slotNumber,
        filePath,
        options,
      );
    return ipcRenderer.invoke(
      "add-sample-to-slot",
      kitName,
      voiceNumber,
      slotNumber,
      filePath,
      options,
    );
  },
  cancelKitSync: () => {
    isDev && console.debug("[IPC] cancelKitSync invoked");
    return ipcRenderer.invoke("cancelKitSync");
  },
  closeApp: (): Promise<void> => {
    isDev && console.debug("[IPC] closeApp invoked");
    return ipcRenderer.invoke("close-app");
  },
  copyDir: (src: string, dest: string) => {
    isDev && console.debug("[IPC] copyDir invoked", src, dest);
    return ipcRenderer.invoke("copy-dir", src, dest);
  },
  copyKit: (sourceKit: string, destKit: string): Promise<void> => {
    isDev && console.debug("[IPC] copyKit invoked", sourceKit, destKit);
    return ipcRenderer.invoke("copy-kit", sourceKit, destKit);
  },
  createKit: (kitSlot: string): Promise<void> => {
    isDev && console.debug("[IPC] createKit invoked", kitSlot);
    return ipcRenderer.invoke("create-kit", kitSlot);
  },
  createRomperDb: (dbDir: string) => {
    isDev && console.debug("[IPC] createRomperDb invoked", dbDir);
    return ipcRenderer.invoke("create-romper-db", dbDir);
  },
  deleteSampleFromSlot: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => {
    isDev &&
      console.debug(
        "[IPC] deleteSampleFromSlot invoked",
        kitName,
        voiceNumber,
        slotNumber,
      );
    return ipcRenderer.invoke(
      "delete-sample-from-slot",
      kitName,
      voiceNumber,
      slotNumber,
    );
  },
  deleteSampleFromSlotWithoutReindexing: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => {
    isDev &&
      console.debug(
        "[IPC] deleteSampleFromSlotWithoutReindexing invoked",
        kitName,
        voiceNumber,
        slotNumber,
      );
    return ipcRenderer.invoke(
      "delete-sample-from-slot-without-reindexing",
      kitName,
      voiceNumber,
      slotNumber,
    );
  },
  downloadAndExtractArchive: (
    url: string,
    destDir: string,
    onProgress?: (p: unknown) => void,
    onError?: (e: unknown) => void,
  ) => {
    isDev &&
      console.debug("[IPC] downloadAndExtractArchive invoked", url, destDir);
    if (onProgress) {
      ipcRenderer.removeAllListeners("archive-progress");
      ipcRenderer.on("archive-progress", (_event: unknown, progress: unknown) =>
        onProgress(progress),
      );
    }
    if (onError) {
      ipcRenderer.removeAllListeners("archive-error");
      ipcRenderer.on("archive-error", (_event: unknown, error: unknown) =>
        onError(error),
      );
    }
    return ipcRenderer.invoke("download-and-extract-archive", url, destDir);
  },
  ensureDir: (dir: string) => {
    isDev && console.debug("[IPC] ensureDir invoked", dir);
    return ipcRenderer.invoke("ensure-dir", dir);
  },
  // Task 8.2.1: SD Card sync operations
  generateSyncChangeSummary: () => {
    isDev && console.debug("[IPC] generateSyncChangeSummary invoked");
    return ipcRenderer.invoke("generateSyncChangeSummary");
  },
  // Bank operations
  getAllBanks: () => {
    isDev && console.debug("[IPC] getAllBanks invoked");
    return ipcRenderer.invoke("get-all-banks");
  },
  getAllSamples: (dbDir: string) => {
    isDev && console.debug("[IPC] getAllSamples invoked", dbDir);
    return ipcRenderer.invoke("get-all-samples", dbDir);
  },
  getAllSamplesForKit: (kitName: string) => {
    isDev && console.debug("[IPC] getAllSamplesForKit invoked", kitName);
    return ipcRenderer.invoke("get-all-samples-for-kit", kitName);
  },
  // Task 6.1: Format validation for WAV files
  getAudioMetadata: (filePath: string) => {
    isDev && console.debug("[IPC] getAudioMetadata invoked", filePath);
    return ipcRenderer.invoke("get-audio-metadata", filePath);
  },
  getFavoriteKits: () => {
    isDev && console.debug("[IPC] getFavoriteKits invoked");
    return ipcRenderer.invoke("get-favorite-kits");
  },
  getFavoriteKitsCount: () => {
    isDev && console.debug("[IPC] getFavoriteKitsCount invoked");
    return ipcRenderer.invoke("get-favorite-kits-count");
  },
  // Database methods for kit metadata (replacing JSON file dependency)
  getKit: (kitName: string) => {
    isDev && console.debug("[IPC] getKit invoked", kitName);
    return ipcRenderer.invoke("get-kit", kitName);
  },
  getKits: () => {
    isDev && console.debug("[IPC] getKits invoked");
    return ipcRenderer.invoke("get-all-kits");
  },
  getKitsMetadata: () => {
    isDev && console.debug("[IPC] getKitsMetadata invoked");
    return ipcRenderer.invoke("get-kits-metadata");
  },
  getLocalStoreStatus: async () => {
    isDev && console.debug("[IPC] getLocalStoreStatus invoked");
    return await ipcRenderer.invoke("get-local-store-status");
  },
  getSampleAudioBuffer: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => {
    isDev &&
      console.debug(
        "[IPC] getSampleAudioBuffer invoked",
        kitName,
        voiceNumber,
        slotNumber,
      );
    return ipcRenderer.invoke(
      "get-sample-audio-buffer",
      kitName,
      voiceNumber,
      slotNumber,
    );
  },
  getSetting: async (key: string): Promise<unknown> => {
    return await settingsManager.getSetting(key as SettingsKey);
  },
  getUserHomeDir: () => {
    isDev && console.debug("[IPC] getUserHomeDir invoked");
    return ipcRenderer.invoke("get-user-home-dir");
  },
  insertKit: (dbDir: string, kit: NewKit) => {
    isDev && console.debug("[IPC] insertKit invoked", dbDir, kit);
    return ipcRenderer.invoke("insert-kit", dbDir, kit);
  },
  insertSample: (dbDir: string, sample: NewSample) => {
    isDev && console.debug("[IPC] insertSample invoked", dbDir, sample);
    return ipcRenderer.invoke("insert-sample", dbDir, sample);
  },
  listFilesInRoot: (localStorePath: string): Promise<string[]> => {
    isDev && console.debug("[IPC] listFilesInRoot invoked", localStorePath);
    return ipcRenderer.invoke("list-files-in-root", localStorePath);
  },
  // Cross-kit sample movement with source reindexing
  moveSampleBetweenKits: (
    fromKit: string,
    fromVoice: number,
    fromSlot: number,
    toKit: string,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ) => {
    isDev &&
      console.debug(
        "[IPC] moveSampleBetweenKits invoked",
        `${fromKit}:${fromVoice}:${fromSlot} -> ${toKit}:${toVoice}:${toSlot}`,
        mode,
      );
    return ipcRenderer.invoke("move-sample-between-kits", {
      fromKit,
      fromSlot,
      fromVoice,
      mode,
      toKit,
      toSlot,
      toVoice,
    });
  },
  // Task 22.2: Move samples within kit with contiguity maintenance
  moveSampleInKit: (
    kitName: string,
    fromVoice: number,
    fromSlot: number,
    toVoice: number,
    toSlot: number,
    mode: "insert" | "overwrite",
  ) => {
    isDev &&
      console.debug(
        "[IPC] moveSampleInKit invoked",
        kitName,
        `${fromVoice}:${fromSlot} -> ${toVoice}:${toSlot}`,
        mode,
      );
    return ipcRenderer.invoke(
      "move-sample-in-kit",
      kitName,
      fromVoice,
      fromSlot,
      toVoice,
      toSlot,
      mode,
    );
  },
  onSamplePlaybackEnded: (cb: () => void) => {
    isDev && console.debug("[IPC] onSamplePlaybackEnded registered");
    ipcRenderer.removeAllListeners("sample-playback-ended");
    ipcRenderer.on("sample-playback-ended", cb);
  },
  onSamplePlaybackError: (cb: (errMsg: string) => void) => {
    isDev && console.debug("[IPC] onSamplePlaybackError registered");
    ipcRenderer.removeAllListeners("sample-playback-error");
    ipcRenderer.on("sample-playback-error", (_event: unknown, errMsg: string) =>
      cb(errMsg),
    );
  },
  onSyncProgress: (callback: (progress: SyncProgress) => void) => {
    isDev && console.debug("[IPC] onSyncProgress listener registered");
    ipcRenderer.removeAllListeners("sync-progress");
    ipcRenderer.on("sync-progress", (_event: unknown, progress: SyncProgress) =>
      callback(progress),
    );
  },
  playSample: (
    filePath: string,
    options?: { channel?: "left" | "mono" | "right" | "stereo" },
  ) => {
    isDev && console.debug("[IPC] playSample invoked", filePath, options);
    return ipcRenderer.invoke("play-sample", filePath, options);
  },
  readFile: (filePath: string) => {
    isDev && console.debug("[IPC] readFile invoked", filePath);
    return ipcRenderer.invoke("read-file", filePath);
  },
  readSettings: async () => {
    isDev && console.debug("[IPC] readSettings invoked");
    return await settingsManager.readSettings();
  },
  replaceSampleInSlot: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
    options?: { forceMono?: boolean; forceStereo?: boolean },
  ) => {
    isDev &&
      console.debug(
        "[IPC] replaceSampleInSlot invoked",
        kitName,
        voiceNumber,
        slotNumber,
        filePath,
        options,
      );
    return ipcRenderer.invoke(
      "replace-sample-in-slot",
      kitName,
      voiceNumber,
      slotNumber,
      filePath,
      options,
    );
  },
  rescanKit: (kitName: string) => {
    isDev && console.debug("[IPC] rescanKit invoked", kitName);
    return ipcRenderer.invoke("rescan-kit", kitName);
  },
  rescanKitsMissingMetadata: () => {
    isDev && console.debug("[IPC] rescanKitsMissingMetadata invoked");
    return ipcRenderer.invoke("rescan-kits-missing-metadata");
  },
  scanBanks: () => {
    isDev && console.debug("[IPC] scanBanks invoked");
    return ipcRenderer.invoke("scan-banks");
  },
  // Search operations removed - now handled client-side
  selectExistingLocalStore: () => {
    isDev && console.debug("[IPC] selectExistingLocalStore invoked");
    return ipcRenderer.invoke("select-existing-local-store");
  },
  selectLocalStorePath: () => {
    isDev && console.debug("[IPC] selectLocalStorePath invoked");
    return ipcRenderer.invoke("select-local-store-path");
  },
  selectSdCard: (): Promise<null | string> => {
    isDev && console.debug("[IPC] selectSdCard invoked");
    return ipcRenderer.invoke("select-sd-card");
  },
  setSetting: async (key: string, value: SettingsValue): Promise<void> => {
    return await settingsManager.setSetting(key as SettingsKey, value);
  },
  showItemInFolder: (path: string): Promise<void> => {
    isDev && console.debug("[IPC] showItemInFolder invoked", path);
    return ipcRenderer.invoke("show-item-in-folder", path);
  },

  startKitSync: (syncData: {
    filesToConvert: Array<{
      destinationPath: string;
      filename: string;
      operation: "convert" | "copy";
      sourcePath: string;
    }>;
    filesToCopy: Array<{
      destinationPath: string;
      filename: string;
      operation: "convert" | "copy";
      sourcePath: string;
    }>;
  }) => {
    isDev && console.debug("[IPC] startKitSync invoked", syncData);
    return ipcRenderer.invoke("startKitSync", syncData);
  },

  stopSample: () => {
    isDev && console.debug("[IPC] stopSample invoked");
    return ipcRenderer.invoke("stop-sample");
  },

  // Task 20.1: Favorites system
  toggleKitFavorite: (kitName: string) => {
    isDev && console.debug("[IPC] toggleKitFavorite invoked", kitName);
    return ipcRenderer.invoke("toggle-kit-favorite", kitName);
  },

  updateKit: (
    kitName: string,
    updates: {
      alias?: string;
      artist?: string;
      description?: string;
      tags?: string[];
    },
  ) => {
    isDev && console.debug("[IPC] updateKit invoked", kitName, updates);
    return ipcRenderer.invoke("update-kit-metadata", kitName, updates);
  },
  updateKitBpm: (kitName: string, bpm: number) => {
    isDev && console.debug("[IPC] updateKitBpm invoked", kitName, bpm);
    return ipcRenderer.invoke("update-kit-bpm", kitName, bpm);
  },

  updateStepPattern: (kitName: string, stepPattern: number[][]) => {
    isDev &&
      console.debug("[IPC] updateStepPattern invoked", kitName, stepPattern);
    return ipcRenderer.invoke("update-step-pattern", kitName, stepPattern);
  },

  updateVoiceAlias: (
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => {
    isDev &&
      console.debug(
        "[IPC] updateVoiceAlias invoked",
        kitName,
        voiceNumber,
        voiceAlias,
      );
    return ipcRenderer.invoke(
      "update-voice-alias",
      kitName,
      voiceNumber,
      voiceAlias,
    );
  },

  validateLocalStore: (localStorePath?: string) => {
    isDev && console.debug("[IPC] validateLocalStore invoked", localStorePath);
    return ipcRenderer.invoke("validate-local-store", localStorePath);
  },

  validateLocalStoreBasic: (localStorePath?: string) => {
    isDev &&
      console.debug("[IPC] validateLocalStoreBasic invoked", localStorePath);
    return ipcRenderer.invoke("validate-local-store-basic", localStorePath);
  },

  validateSampleFormat: (filePath: string) => {
    isDev && console.debug("[IPC] validateSampleFormat invoked", filePath);
    return ipcRenderer.invoke("validate-sample-format", filePath);
  },

  // Task 5.2.5: Validate source_path files for existing samples
  validateSampleSources: (kitName: string) => {
    isDev && console.debug("[IPC] validateSampleSources invoked", kitName);
    return ipcRenderer.invoke("validate-sample-sources", kitName);
  },

  writeSettings: async (key: string, value: SettingsValue): Promise<void> => {
    isDev && console.debug("[IPC] writeSettings invoked", key, value);
    return await settingsManager.writeSettings(key as SettingsKey, value);
  },
});

// Initialize menu event forwarding
menuEventForwarder.initialize();

// Expose a function to get the file path from a dropped File object (Electron only)
contextBridge.exposeInMainWorld("electronFileAPI", {
  getDroppedFilePath: async (file: File) => {
    if (webUtils?.getPathForFile) {
      try {
        return await webUtils.getPathForFile(file);
      } catch (e) {
        console.error("webUtils.getPathForFile failed:", e);
        throw e;
      }
    }
    throw new Error("webUtils.getPathForFile is not available.");
  },
});

console.info("Preload script updated and loaded");

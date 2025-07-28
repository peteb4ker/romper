const { contextBridge, ipcRenderer, webUtils } = require("electron");

import type { Kit, NewKit, NewSample } from "../../shared/db/types.js";

// ===== SETTINGS MANAGER =====
interface SettingsData {
  localStorePath?: string;
  darkMode?: boolean;
  theme?: string;
}

type SettingsKey = keyof SettingsData;

class SettingsManager {
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

  async writeSettings(key: SettingsKey, value: any): Promise<void> {
    try {
      await ipcRenderer.invoke("write-settings", key, value);
    } catch (e) {
      console.error("Failed to write settings:", e);
    }
  }

  async getSetting(key: SettingsKey): Promise<any> {
    console.log("[IPC] getSetting invoked", key);

    // For localStorePath, check environment variable first
    if (key === "localStorePath" && process.env.ROMPER_LOCAL_PATH) {
      return process.env.ROMPER_LOCAL_PATH;
    }

    const settings = await this.readSettings();
    return settings[key];
  }

  async setSetting(key: SettingsKey, value: any): Promise<void> {
    console.log(`[IPC] setSetting called with key: ${key}, value:`, value);
    await this.writeSettings(key, value);
  }
}

const settingsManager = new SettingsManager();

// ===== MENU EVENT FORWARDER =====
interface MenuEventMap {
  "menu-scan-all-kits": void;
  "menu-scan-banks": void;
  "menu-validate-database": void;
  "menu-setup-local-store": void;
  "menu-change-local-store-directory": void;
  "menu-about": void;
}

class MenuEventForwarder {
  private eventMappings: Array<{
    ipcEvent: keyof MenuEventMap;
    domEvent: string;
  }> = [
    { ipcEvent: "menu-scan-all-kits", domEvent: "menu-scan-all-kits" },
    { ipcEvent: "menu-scan-banks", domEvent: "menu-scan-banks" },
    { ipcEvent: "menu-validate-database", domEvent: "menu-validate-database" },
    { ipcEvent: "menu-setup-local-store", domEvent: "menu-setup-local-store" },
    { ipcEvent: "menu-change-local-store-directory", domEvent: "menu-change-local-store-directory" },
    { ipcEvent: "menu-about", domEvent: "menu-about" },
  ];

  initialize(): void {
    this.eventMappings.forEach(({ ipcEvent, domEvent }) => {
      ipcRenderer.on(ipcEvent, () => {
        window.dispatchEvent(new CustomEvent(domEvent));
      });
    });
  }
}

const menuEventForwarder = new MenuEventForwarder();

// Expose environment variables to renderer for E2E testing
contextBridge.exposeInMainWorld("romperEnv", {
  ROMPER_SDCARD_PATH: process.env.ROMPER_SDCARD_PATH,
  ROMPER_LOCAL_PATH: process.env.ROMPER_LOCAL_PATH,
  ROMPER_SQUARP_ARCHIVE_URL: process.env.ROMPER_SQUARP_ARCHIVE_URL,
});

// Ensure the userData directory and settings path are resolved via IPC
const getUserDataPath = async (): Promise<string> => {
  return await ipcRenderer.invoke("get-user-data-path");
};

contextBridge.exposeInMainWorld("electronAPI", {
  selectSdCard: (): Promise<string | null> => {
    console.log("[IPC] selectSdCard invoked");
    return ipcRenderer.invoke("select-sd-card");
  },
  getSetting: async (key: string): Promise<any> => {
    return await settingsManager.getSetting(key as SettingsKey);
  },
  setSetting: async (key: string, value: any): Promise<void> => {
    return await settingsManager.setSetting(key as SettingsKey, value);
  },
  readSettings: async () => {
    console.log("[IPC] readSettings invoked");
    return await settingsManager.readSettings();
  },
  getLocalStoreStatus: async () => {
    console.log("[IPC] getLocalStoreStatus invoked");
    return await ipcRenderer.invoke("get-local-store-status");
  },
  createKit: (kitSlot: string): Promise<void> => {
    console.log("[IPC] createKit invoked", kitSlot);
    return ipcRenderer.invoke("create-kit", kitSlot);
  },
  copyKit: (sourceKit: string, destKit: string): Promise<void> => {
    console.log("[IPC] copyKit invoked", sourceKit, destKit);
    return ipcRenderer.invoke("copy-kit", sourceKit, destKit);
  },
  listFilesInRoot: (localStorePath: string): Promise<string[]> => {
    console.log("[IPC] listFilesInRoot invoked", localStorePath);
    return ipcRenderer.invoke("list-files-in-root", localStorePath);
  },
  closeApp: (): Promise<void> => {
    console.log("[IPC] closeApp invoked");
    return ipcRenderer.invoke("close-app");
  },
  playSample: (filePath: string) => {
    console.log("[IPC] playSample invoked", filePath);
    return ipcRenderer.invoke("play-sample", filePath);
  },
  stopSample: () => {
    console.log("[IPC] stopSample invoked");
    return ipcRenderer.invoke("stop-sample");
  },
  onSamplePlaybackEnded: (cb: () => void) => {
    console.log("[IPC] onSamplePlaybackEnded registered");
    ipcRenderer.removeAllListeners("sample-playback-ended");
    ipcRenderer.on("sample-playback-ended", cb);
  },
  onSamplePlaybackError: (cb: (errMsg: string) => void) => {
    console.log("[IPC] onSamplePlaybackError registered");
    ipcRenderer.removeAllListeners("sample-playback-error");
    ipcRenderer.on("sample-playback-error", (_event: any, errMsg: string) =>
      cb(errMsg),
    );
  },
  getSampleAudioBuffer: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
  ) => {
    console.log(
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
  readFile: (filePath: string) => {
    console.log("[IPC] readFile invoked", filePath);
    return ipcRenderer.invoke("read-file", filePath);
  },
  // Database methods for kit metadata (replacing JSON file dependency)
  getKit: (kitName: string) => {
    console.log("[IPC] getKit invoked", kitName);
    return ipcRenderer.invoke("get-kit", kitName);
  },
  updateKit: (
    kitName: string,
    updates: {
      alias?: string;
      artist?: string;
      tags?: string[];
      description?: string;
    },
  ) => {
    console.log("[IPC] updateKit invoked", kitName, updates);
    return ipcRenderer.invoke("update-kit-metadata", kitName, updates);
  },
  getKits: () => {
    console.log("[IPC] getKits invoked");
    return ipcRenderer.invoke("get-all-kits");
  },
  updateVoiceAlias: (
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => {
    console.log(
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
  updateStepPattern: (kitName: string, stepPattern: number[][]) => {
    console.log("[IPC] updateStepPattern invoked", kitName, stepPattern);
    return ipcRenderer.invoke("update-step-pattern", kitName, stepPattern);
  },
  getUserHomeDir: () => {
    console.log("[IPC] getUserHomeDir invoked");
    return ipcRenderer.invoke("get-user-home-dir");
  },
  selectLocalStorePath: () => {
    console.log("[IPC] selectLocalStorePath invoked");
    return ipcRenderer.invoke("select-local-store-path");
  },
  downloadAndExtractArchive: (
    url: string,
    destDir: string,
    onProgress?: (p: any) => void,
    onError?: (e: any) => void,
  ) => {
    console.log("[IPC] downloadAndExtractArchive invoked", url, destDir);
    if (onProgress) {
      ipcRenderer.removeAllListeners("archive-progress");
      ipcRenderer.on("archive-progress", (_event: any, progress: any) =>
        onProgress(progress),
      );
    }
    if (onError) {
      ipcRenderer.removeAllListeners("archive-error");
      ipcRenderer.on("archive-error", (_event: any, error: any) =>
        onError(error),
      );
    }
    return ipcRenderer.invoke("download-and-extract-archive", url, destDir);
  },
  ensureDir: (dir: string) => {
    console.log("[IPC] ensureDir invoked", dir);
    return ipcRenderer.invoke("ensure-dir", dir);
  },
  copyDir: (src: string, dest: string) => {
    console.log("[IPC] copyDir invoked", src, dest);
    return ipcRenderer.invoke("copy-dir", src, dest);
  },
  createRomperDb: (dbDir: string) => {
    console.log("[IPC] createRomperDb invoked", dbDir);
    return ipcRenderer.invoke("create-romper-db", dbDir);
  },
  insertKit: (dbDir: string, kit: NewKit) => {
    console.log("[IPC] insertKit invoked", dbDir, kit);
    return ipcRenderer.invoke("insert-kit", dbDir, kit);
  },
  insertSample: (dbDir: string, sample: NewSample) => {
    console.log("[IPC] insertSample invoked", dbDir, sample);
    return ipcRenderer.invoke("insert-sample", dbDir, sample);
  },
  validateLocalStore: (localStorePath?: string) => {
    console.log("[IPC] validateLocalStore invoked", localStorePath);
    return ipcRenderer.invoke("validate-local-store", localStorePath);
  },
  validateLocalStoreBasic: (localStorePath?: string) => {
    console.log("[IPC] validateLocalStoreBasic invoked", localStorePath);
    return ipcRenderer.invoke("validate-local-store-basic", localStorePath);
  },
  getAllSamples: (dbDir: string) => {
    console.log("[IPC] getAllSamples invoked", dbDir);
    return ipcRenderer.invoke("get-all-samples", dbDir);
  },
  getAllSamplesForKit: (kitName: string) => {
    console.log("[IPC] getAllSamplesForKit invoked", kitName);
    return ipcRenderer.invoke("get-all-samples-for-kit", kitName);
  },
  rescanKit: (kitName: string) => {
    console.log("[IPC] rescanKit invoked", kitName);
    return ipcRenderer.invoke("rescan-kit", kitName);
  },
  // Bank operations
  getAllBanks: () => {
    console.log("[IPC] getAllBanks invoked");
    return ipcRenderer.invoke("get-all-banks");
  },
  scanBanks: () => {
    console.log("[IPC] scanBanks invoked");
    return ipcRenderer.invoke("scan-banks");
  },
  selectExistingLocalStore: () => {
    console.log("[IPC] selectExistingLocalStore invoked");
    return ipcRenderer.invoke("select-existing-local-store");
  },
  // Task 5.2.2 & 5.2.3: Sample management operations for drag-and-drop editing
  addSampleToSlot: (
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
    filePath: string,
  ) => {
    console.log(
      "[IPC] addSampleToSlot invoked",
      kitName,
      voiceNumber,
      slotIndex,
      filePath,
    );
    return ipcRenderer.invoke(
      "add-sample-to-slot",
      kitName,
      voiceNumber,
      slotIndex,
      filePath,
    );
  },
  replaceSampleInSlot: (
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
    filePath: string,
  ) => {
    console.log(
      "[IPC] replaceSampleInSlot invoked",
      kitName,
      voiceNumber,
      slotIndex,
      filePath,
    );
    return ipcRenderer.invoke(
      "replace-sample-in-slot",
      kitName,
      voiceNumber,
      slotIndex,
      filePath,
    );
  },
  deleteSampleFromSlot: (
    kitName: string,
    voiceNumber: number,
    slotIndex: number,
  ) => {
    console.log(
      "[IPC] deleteSampleFromSlot invoked",
      kitName,
      voiceNumber,
      slotIndex,
    );
    return ipcRenderer.invoke(
      "delete-sample-from-slot",
      kitName,
      voiceNumber,
      slotIndex,
    );
  },
  // Task 5.2.5: Validate source_path files for existing samples
  validateSampleSources: (kitName: string) => {
    console.log("[IPC] validateSampleSources invoked", kitName);
    return ipcRenderer.invoke("validate-sample-sources", kitName);
  },
});

// Initialize menu event forwarding
menuEventForwarder.initialize();

// Expose a function to get the file path from a dropped File object (Electron only)
contextBridge.exposeInMainWorld("electronFileAPI", {
  getDroppedFilePath: async (file: File) => {
    if (webUtils && webUtils.getPathForFile) {
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

console.log("Preload script updated and loaded");

import { contextBridge, ipcRenderer, webUtils } from "electron";

import type { Kit, NewKit, NewSample } from "../../shared/db/types.js";

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

async function readSettings(): Promise<{
  localStorePath?: string;
  darkMode?: boolean;
  theme?: string;
}> {
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
    const fallbackSettings: any = {};
    if (process.env.ROMPER_LOCAL_PATH) {
      fallbackSettings.localStorePath = process.env.ROMPER_LOCAL_PATH;
    }
    return fallbackSettings;
  }
}

async function writeSettings(
  key: keyof {
    localStorePath?: string;
    darkMode?: boolean;
    theme?: string;
  },
  value: any,
): Promise<void> {
  try {
    await ipcRenderer.invoke("write-settings", key, value);
  } catch (e) {
    console.error("Failed to write settings:", e);
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  selectSdCard: (): Promise<string | null> => {
    console.log("[IPC] selectSdCard invoked");
    return ipcRenderer.invoke("select-sd-card");
  },
  getSetting: async (
    key: keyof {
      localStorePath?: string;
      darkMode?: boolean;
      theme?: string;
    },
  ): Promise<any> => {
    console.log("[IPC] getSetting invoked", key);

    // For localStorePath, check environment variable first
    if (key === "localStorePath" && process.env.ROMPER_LOCAL_PATH) {
      return process.env.ROMPER_LOCAL_PATH;
    }

    const settings = await readSettings();
    return settings[key];
  },
  setSetting: async (
    key: keyof {
      localStorePath?: string;
      darkMode?: boolean;
      theme?: string;
    },
    value: any,
  ): Promise<void> => {
    console.log(`[IPC] setSetting called with key: ${key}, value:`, value);
    await writeSettings(key, value);
  },
  readSettings: async (): Promise<{
    localStorePath?: string;
    darkMode?: boolean;
    theme?: string;
  }> => {
    console.log("[IPC] readSettings invoked");
    return readSettings();
  },
  getLocalStoreStatus: async () => {
    console.log("[IPC] getLocalStoreStatus invoked");
    return await ipcRenderer.invoke("get-local-store-status");
  },
  createKit: (localStorePath: string, kitSlot: string): Promise<void> => {
    console.log("[IPC] createKit invoked", localStorePath, kitSlot);
    return ipcRenderer.invoke("create-kit", localStorePath, kitSlot);
  },
  copyKit: (
    localStorePath: string,
    sourceKit: string,
    destKit: string,
  ): Promise<void> => {
    console.log("[IPC] copyKit invoked", localStorePath, sourceKit, destKit);
    return ipcRenderer.invoke("copy-kit", localStorePath, sourceKit, destKit);
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
  getAudioBuffer: (filePath: string) => {
    console.log("[IPC] getAudioBuffer invoked", filePath);
    return ipcRenderer.invoke("get-audio-buffer", filePath);
  },
  readFile: (filePath: string) => {
    console.log("[IPC] readFile invoked", filePath);
    return ipcRenderer.invoke("read-file", filePath);
  },
  // Database methods for kit metadata (replacing JSON file dependency)
  getKitMetadata: (dbDir: string, kitName: string) => {
    console.log("[IPC] getKitMetadata invoked", dbDir, kitName);
    return ipcRenderer.invoke("get-kit-metadata", dbDir, kitName);
  },
  updateKit: (
    dbDir: string,
    kitName: string,
    updates: {
      alias?: string;
      artist?: string;
      tags?: string[];
      description?: string;
    },
  ) => {
    console.log("[IPC] updateKit invoked", dbDir, kitName, updates);
    return ipcRenderer.invoke("update-kit-metadata", dbDir, kitName, updates);
  },
  getKits: () => {
    console.log("[IPC] getKits invoked");
    return ipcRenderer.invoke("get-all-kits");
  },
  updateVoiceAlias: (
    dbDir: string,
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => {
    console.log(
      "[IPC] updateVoiceAlias invoked",
      dbDir,
      kitName,
      voiceNumber,
      voiceAlias,
    );
    return ipcRenderer.invoke(
      "update-voice-alias",
      dbDir,
      kitName,
      voiceNumber,
      voiceAlias,
    );
  },
  updateStepPattern: (
    dbDir: string,
    kitName: string,
    stepPattern: number[][],
  ) => {
    console.log("[IPC] updateStepPattern invoked", dbDir, kitName, stepPattern);
    return ipcRenderer.invoke(
      "update-step-pattern",
      dbDir,
      kitName,
      stepPattern,
    );
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
  validateLocalStore: (localStorePath: string) => {
    console.log("[IPC] validateLocalStore invoked", localStorePath);
    return ipcRenderer.invoke("validate-local-store", localStorePath);
  },
  validateLocalStoreBasic: (localStorePath: string) => {
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
  rescanKit: (dbDir: string, localStorePath: string, kitName: string) => {
    console.log("[IPC] rescanKit invoked", dbDir, localStorePath, kitName);
    return ipcRenderer.invoke("rescan-kit", dbDir, localStorePath, kitName);
  },
  // Bank operations
  getAllBanks: (dbDir: string) => {
    console.log("[IPC] getAllBanks invoked", dbDir);
    return ipcRenderer.invoke("get-all-banks", dbDir);
  },
  scanBanks: (dbDir: string, localStorePath: string) => {
    console.log("[IPC] scanBanks invoked", dbDir, localStorePath);
    return ipcRenderer.invoke("scan-banks", dbDir, localStorePath);
  },
  selectExistingLocalStore: () => {
    console.log("[IPC] selectExistingLocalStore invoked");
    return ipcRenderer.invoke("select-existing-local-store");
  },
});

// Handle menu events from main process and forward to renderer as DOM events
ipcRenderer.on("menu-scan-all-kits", () => {
  window.dispatchEvent(new CustomEvent("menu-scan-all-kits"));
});

ipcRenderer.on("menu-scan-banks", () => {
  window.dispatchEvent(new CustomEvent("menu-scan-banks"));
});

ipcRenderer.on("menu-validate-database", () => {
  window.dispatchEvent(new CustomEvent("menu-validate-database"));
});

ipcRenderer.on("menu-setup-local-store", () => {
  window.dispatchEvent(new CustomEvent("menu-setup-local-store"));
});

ipcRenderer.on("menu-change-local-store-directory", () => {
  window.dispatchEvent(new CustomEvent("menu-change-local-store-directory"));
});

ipcRenderer.on("menu-about", () => {
  window.dispatchEvent(new CustomEvent("menu-about"));
});

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

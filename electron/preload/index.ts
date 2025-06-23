import { contextBridge, ipcRenderer, webUtils } from "electron";

// Expose environment variables to renderer for E2E testing
contextBridge.exposeInMainWorld("romperEnv", {
  ROMPER_SDCARD_PATH: process.env.ROMPER_SDCARD_PATH,
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
    return typeof settings === "string" ? JSON.parse(settings) : settings || {};
  } catch (e) {
    console.error("Failed to read settings:", e);
    return {}; // Return an empty object if settings cannot be read
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
  scanSdCard: (localStorePath: string): Promise<string[]> => {
    console.log("[Preload] scanSdCard invoked", localStorePath);
    return ipcRenderer.invoke("scan-sd-card", localStorePath);
  },
  selectSdCard: (): Promise<string | null> => {
    console.log("[Preload] selectSdCard invoked");
    return ipcRenderer.invoke("select-sd-card");
  },
  watchSdCard: (
    localStorePath: string,
    callback: () => void,
  ): { close: () => Promise<void> } => {
    console.log("[Preload] watchSdCard invoked", localStorePath);
    let watcherId: string | undefined;
    ipcRenderer.invoke("watch-sd-card", localStorePath).then((id: string) => {
      watcherId = id;
      console.log("watchSdCard invoked with path:", localStorePath);
      ipcRenderer.on("sd-card-changed", (_event: unknown, _data: unknown) =>
        callback(),
      );
    });
    // Always return an object with a close method that waits for watcherId to be set
    return {
      close: async () => {
        // Wait for watcherId to be set if not already
        if (!watcherId) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        if (watcherId) {
          console.log("Closing watcher with ID:", watcherId);
          return ipcRenderer.invoke("unwatch-sd-card", watcherId);
        }
      },
    };
  },
  getSetting: async (
    key: keyof {
      localStorePath?: string;
      darkMode?: boolean;
      theme?: string;
    },
  ): Promise<any> => {
    console.log("[Preload] getSetting invoked", key);
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
    console.log(`[Preload] setSetting called with key: ${key}, value:`, value);
    await writeSettings(key, value);
  },
  readSettings: async (): Promise<{
    localStorePath?: string;
    darkMode?: boolean;
    theme?: string;
  }> => {
    console.log("[Preload] readSettings invoked");
    return readSettings();
  },
  getLocalStoreStatus: async () => {
    console.log("[Preload] getLocalStoreStatus invoked");
    return await ipcRenderer.invoke("get-local-store-status");
  },
  createKit: (localStorePath: string, kitSlot: string): Promise<void> => {
    console.log("[Preload] createKit invoked", localStorePath, kitSlot);
    return ipcRenderer.invoke("create-kit", localStorePath, kitSlot);
  },
  copyKit: (
    localStorePath: string,
    sourceKit: string,
    destKit: string,
  ): Promise<void> => {
    console.log(
      "[Preload] copyKit invoked",
      localStorePath,
      sourceKit,
      destKit,
    );
    return ipcRenderer.invoke("copy-kit", localStorePath, sourceKit, destKit);
  },
  listFilesInRoot: (localStorePath: string): Promise<string[]> => {
    console.log("[Preload] listFilesInRoot invoked", localStorePath);
    return ipcRenderer.invoke("list-files-in-root", localStorePath);
  },
  closeApp: (): Promise<void> => {
    console.log("[Preload] closeApp invoked");
    return ipcRenderer.invoke("close-app");
  },
  playSample: (filePath: string) => {
    console.log("[Preload] playSample invoked", filePath);
    return ipcRenderer.invoke("play-sample", filePath);
  },
  stopSample: () => {
    console.log("[Preload] stopSample invoked");
    return ipcRenderer.invoke("stop-sample");
  },
  onSamplePlaybackEnded: (cb: () => void) => {
    console.log("[Preload] onSamplePlaybackEnded registered");
    ipcRenderer.removeAllListeners("sample-playback-ended");
    ipcRenderer.on("sample-playback-ended", cb);
  },
  onSamplePlaybackError: (cb: (errMsg: string) => void) => {
    console.log("[Preload] onSamplePlaybackError registered");
    ipcRenderer.removeAllListeners("sample-playback-error");
    ipcRenderer.on("sample-playback-error", (_event: any, errMsg: string) =>
      cb(errMsg),
    );
  },
  getAudioBuffer: (filePath: string) => {
    console.log("[Preload] getAudioBuffer invoked", filePath);
    return ipcRenderer.invoke("get-audio-buffer", filePath);
  },
  // Database methods for kit metadata (replacing JSON file dependency)
  getKitMetadata: (dbDir: string, kitName: string) => {
    console.log("[Preload] getKitMetadata invoked", dbDir, kitName);
    return ipcRenderer.invoke("get-kit-metadata", dbDir, kitName);
  },
  updateKitMetadata: (
    dbDir: string,
    kitName: string,
    updates: {
      alias?: string;
      artist?: string;
      tags?: string[];
      description?: string;
    },
  ) => {
    console.log("[Preload] updateKitMetadata invoked", dbDir, kitName, updates);
    return ipcRenderer.invoke("update-kit-metadata", dbDir, kitName, updates);
  },
  getAllKits: (dbDir: string) => {
    console.log("[Preload] getAllKits invoked", dbDir);
    return ipcRenderer.invoke("get-all-kits", dbDir);
  },
  updateVoiceAlias: (
    dbDir: string,
    kitName: string,
    voiceNumber: number,
    voiceAlias: string,
  ) => {
    console.log("[Preload] updateVoiceAlias invoked", dbDir, kitName, voiceNumber, voiceAlias);
    return ipcRenderer.invoke("update-voice-alias", dbDir, kitName, voiceNumber, voiceAlias);
  },
  updateStepPattern: (
    dbDir: string,
    kitName: string,
    stepPattern: number[][],
  ) => {
    console.log("[Preload] updateStepPattern invoked", dbDir, kitName, stepPattern);
    return ipcRenderer.invoke("update-step-pattern", dbDir, kitName, stepPattern);
  },
  getUserHomeDir: () => {
    console.log("[Preload] getUserHomeDir invoked");
    return ipcRenderer.invoke("get-user-home-dir");
  },
  selectLocalStorePath: () => {
    console.log("[Preload] selectLocalStorePath invoked");
    return ipcRenderer.invoke("select-local-store-path");
  },
  downloadAndExtractArchive: (
    url: string,
    destDir: string,
    onProgress?: (p: any) => void,
    onError?: (e: any) => void,
  ) => {
    console.log("[Preload] downloadAndExtractArchive invoked", url, destDir);
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
    console.log("[Preload] ensureDir invoked", dir);
    return ipcRenderer.invoke("ensure-dir", dir);
  },
  copyDir: (src: string, dest: string) => {
    console.log("[Preload] copyDir invoked", src, dest);
    return ipcRenderer.invoke("copy-dir", src, dest);
  },
  createRomperDb: (dbDir: string) => {
    console.log("[Preload] createRomperDb invoked", dbDir);
    return ipcRenderer.invoke("create-romper-db", dbDir);
  },
  insertKit: (
    dbDir: string,
    kit: {
      name: string;
      alias?: string;
      artist?: string;
      plan_enabled: boolean;
    },
  ) => {
    console.log("[Preload] insertKit invoked", dbDir, kit);
    return ipcRenderer.invoke("insert-kit", dbDir, kit);
  },
  insertSample: (
    dbDir: string,
    sample: {
      kit_name: string;
      filename: string;
      voice_number: number;
      slot_number: number;
      is_stereo: boolean;
      wav_bitrate?: number;
      wav_sample_rate?: number;
    },
  ) => {
    console.log("[Preload] insertSample invoked", dbDir, sample);
    return ipcRenderer.invoke("insert-sample", dbDir, sample);
  },
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

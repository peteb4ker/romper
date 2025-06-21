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
  readRampleLabels: (localStorePath: string) => {
    console.log("[Preload] readRampleLabels invoked", localStorePath);
    return ipcRenderer.invoke("read-rample-labels", localStorePath);
  },
  writeRampleLabels: (localStorePath: string, labels: any) => {
    console.log("[Preload] writeRampleLabels invoked", localStorePath, labels);
    return ipcRenderer.invoke("write-rample-labels", localStorePath, labels);
  },
  discardKitPlan: (localStorePath: string, kitName: string) => {
    console.log("[Preload] discardKitPlan invoked", localStorePath, kitName);
    return ipcRenderer.invoke("discard-kit-plan", localStorePath, kitName);
  },
  rescanAllVoiceNames: (localStorePath: string, kitNames: string[]) => {
    console.log(
      "[Preload] rescanAllVoiceNames invoked",
      localStorePath,
      kitNames,
    );
    return ipcRenderer.invoke(
      "rescan-all-voice-names",
      localStorePath,
      kitNames,
    );
  },
  getUserHomeDir: async () => {
    console.log("[Preload] getUserHomeDir invoked");
    return await ipcRenderer.invoke("get-user-home-dir");
  },
  selectLocalStorePath: async () => {
    console.log("[Preload] selectLocalStorePath invoked");
    return await ipcRenderer.invoke("select-local-store-path");
  },
  downloadAndExtractArchive: async (
    url: string,
    destDir: string,
    onProgress?: (p: any) => void,
    onError?: (e: any) => void,
  ) => {
    console.log("[Preload] downloadAndExtractArchive invoked", url, destDir);
    let progressListener: any, errorListener: any;
    if (onProgress) {
      progressListener = (_e: any, data: any) => onProgress(data);
      ipcRenderer.on("archive-progress", progressListener);
    }
    if (onError) {
      errorListener = (_e: any, err: any) => onError(err);
      ipcRenderer.on("archive-error", errorListener);
    }
    try {
      const result = await ipcRenderer.invoke(
        "download-and-extract-archive",
        url,
        destDir,
      );
      console.log("[Preload] downloadAndExtractArchive result:", result);
      return result;
    } catch (error) {
      console.error("[Preload] downloadAndExtractArchive error:", error);
      throw error;
    } finally {
      if (progressListener)
        ipcRenderer.removeListener("archive-progress", progressListener);
      if (errorListener)
        ipcRenderer.removeListener("archive-error", errorListener);
    }
  },
  ensureDir: async (dir: string) => {
    console.log("[Preload] ensureDir invoked", dir);
    return await ipcRenderer.invoke("ensure-dir", dir);
  },
  copyDir: async (src: string, dest: string) => {
    console.log("[Preload] copyDir invoked", src, dest);
    return await ipcRenderer.invoke("copy-dir", src, dest);
  },
  createRomperDb: async (dbDir: string) => {
    console.log("[Preload] createRomperDb invoked", dbDir);
    return await ipcRenderer.invoke("create-romper-db", dbDir);
  },
  insertKit: async (
    dbDir: string,
    kit: {
      name: string;
      alias?: string;
      artist?: string;
      plan_enabled: boolean;
    },
  ) => {
    console.log("[Preload] insertKit invoked", dbDir, kit);
    return await ipcRenderer.invoke("insert-kit", dbDir, kit);
  },
  insertSample: async (
    dbDir: string,
    sample: {
      kit_id: number;
      filename: string;
      voice_number: number;
      slot_number: number;
      is_stereo: boolean;
      wav_bitrate?: number;
      wav_sample_rate?: number;
    },
  ) => {
    console.log("[Preload] insertSample invoked", dbDir, sample);
    return await ipcRenderer.invoke("insert-sample", dbDir, sample);
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

import type {
  ElectronAPI,
  ElectronFileAPI,
  KitMetadataUpdates,
  RomperEnv,
  SettingsData,
  SettingsKey,
  SyncOptions,
} from "@romper/shared/electronApi.js";
import type {
  IpcArgs,
  IpcChannel,
  IpcEvents,
  IpcResult,
} from "@romper/shared/ipcChannels.js";
import type {
  SliceStep,
  VoiceSliceSettings,
} from "@romper/shared/sliceTypes.js";
import type {
  SequenceSnapshot,
  VoiceSnapshot,
} from "@romper/shared/undoTypes.js";

const { contextBridge, ipcRenderer, webUtils } = require("electron");

// Determine if we're in development mode
const isDev = process.env.NODE_ENV === "development";

// ===== SETTINGS MANAGER =====
type SettingsValue = SettingsData[SettingsKey];

class SettingsManager {
  async readSettings(): Promise<SettingsData> {
    try {
      // Main applies the ROMPER_LOCAL_PATH and ROMPER_SDCARD_PATH overrides
      return (await invoke("read-settings")) ?? {};
    } catch (e) {
      console.error("Failed to read settings:", e);
      throw e;
    }
  }

  async setSetting(key: SettingsKey, value: SettingsValue): Promise<void> {
    isDev &&
      console.debug(`[IPC] setSetting called with key: ${key}, value:`, value);
    await this.writeSettings(key, value);
  }

  async writeSettings(key: SettingsKey, value: SettingsValue): Promise<void> {
    try {
      await invoke("write-settings", key, value);
    } catch (e) {
      console.error("Failed to write settings:", e);
      throw e;
    }
  }
}

/**
 * Invoke a channel with the arguments and result the contract gives it
 * (shared/ipcChannels.ts), so a call that drifts from main's handler fails
 * the preload build (#472)
 */
function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcArgs<C>
): Promise<IpcResult<C>> {
  return ipcRenderer.invoke(channel, ...args);
}

/**
 * Call `callback` with each `channel` event main sends; returns a function
 * that stops listening
 */
function listen<E extends keyof IpcEvents>(
  channel: E,
  callback: (payload: IpcEvents[E]) => void,
): () => void {
  const listener = (_event: unknown, payload: IpcEvents[E]) =>
    callback(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const settingsManager = new SettingsManager();

// ===== MENU EVENT FORWARDER =====
interface MenuEventMap {
  "menu-about": void;
  "menu-change-local-store-directory": void;
  "menu-preferences": void;
  "menu-redo": void;
  "menu-scan-all-kits": void;
  "menu-undo": void;
}

class MenuEventForwarder {
  private readonly eventMappings: Array<{
    domEvent: string;
    ipcEvent: keyof MenuEventMap;
  }> = [
    { domEvent: "menu-scan-all-kits", ipcEvent: "menu-scan-all-kits" },
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
        globalThis.dispatchEvent(new CustomEvent(domEvent));
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
  ROMPER_TEST_MODE: process.env.ROMPER_TEST_MODE,
} satisfies RomperEnv);

// The contract is canonical (shared/electronApi.ts); `satisfies` makes a
// missing or drifted method a compile error in the preload build.
const electronAPI = {
  // Task 5.2.2 & 5.2.3: Sample management operations for drag-and-drop editing
  addSampleToSlot: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    filePath: string,
  ) => {
    isDev &&
      console.debug(
        "[IPC] addSampleToSlot invoked",
        kitName,
        voiceNumber,
        slotNumber,
        filePath,
      );
    return invoke(
      "add-sample-to-slot",
      kitName,
      voiceNumber,
      slotNumber,
      filePath,
    );
  },
  cancelKitSync: () => {
    isDev && console.debug("[IPC] cancelKitSync invoked");
    return invoke("cancelKitSync");
  },
  cancelSetup: () => {
    isDev && console.debug("[IPC] cancelSetup invoked");
    return invoke("cancel-setup");
  },
  checkDiskSpace: (targetPath: string, requiredBytes: number) => {
    isDev &&
      console.debug("[IPC] checkDiskSpace invoked", targetPath, requiredBytes);
    return invoke("check-disk-space", targetPath, requiredBytes);
  },
  checkExistingLocalStore: (targetPath: string) => {
    isDev && console.debug("[IPC] checkExistingLocalStore invoked", targetPath);
    return invoke("check-existing-local-store", targetPath);
  },
  checkKitSampleFiles: (kitName: string) => {
    isDev && console.debug("[IPC] checkKitSampleFiles invoked", kitName);
    return invoke("check-kit-sample-files", kitName);
  },
  checkPathWritable: (targetPath: string) => {
    isDev && console.debug("[IPC] checkPathWritable invoked", targetPath);
    return invoke("check-path-writable", targetPath);
  },
  cleanupPartialInit: (targetPath: string) => {
    isDev && console.debug("[IPC] cleanupPartialInit invoked", targetPath);
    return invoke("cleanup-partial-init", targetPath);
  },
  closeApp: () => {
    isDev && console.debug("[IPC] closeApp invoked");
    return invoke("close-app");
  },
  copyDir: (src: string, dest: string) => {
    isDev && console.debug("[IPC] copyDir invoked", src, dest);
    return invoke("copy-dir", src, dest);
  },
  copyKit: (sourceKit: string, destKit: string) => {
    isDev && console.debug("[IPC] copyKit invoked", sourceKit, destKit);
    return invoke("copy-kit", sourceKit, destKit);
  },
  createKit: (kitSlot: string) => {
    isDev && console.debug("[IPC] createKit invoked", kitSlot);
    return invoke("create-kit", kitSlot);
  },
  createRomperDb: (dbDir: string) => {
    isDev && console.debug("[IPC] createRomperDb invoked", dbDir);
    return invoke("create-romper-db", dbDir);
  },
  deleteKit: (kitName: string) => {
    isDev && console.debug("[IPC] deleteKit invoked", kitName);
    return invoke("delete-kit", kitName);
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
    return invoke("delete-sample-from-slot", kitName, voiceNumber, slotNumber);
  },
  downloadAndExtractArchive: (
    destDir: string,
    onProgress?: (progress: IpcEvents["archive-progress"]) => void,
    onError?: (error: IpcEvents["archive-error"]) => void,
  ) => {
    isDev && console.debug("[IPC] downloadAndExtractArchive invoked", destDir);
    // The callbacks hear this install's events only, and stop when it ends
    const stops = [
      onProgress && listen("archive-progress", onProgress),
      onError && listen("archive-error", onError),
    ];
    return invoke("download-and-extract-archive", destDir).finally(() => {
      for (const stop of stops) stop?.();
    });
  },
  ensureDir: (dir: string) => {
    isDev && console.debug("[IPC] ensureDir invoked", dir);
    return invoke("ensure-dir", dir);
  },
  finishSetup: (targetPath: string) => {
    isDev && console.debug("[IPC] finishSetup invoked", targetPath);
    return invoke("finish-setup", targetPath);
  },
  // Task 8.2.1: SD Card sync operations
  generateSyncChangeSummary: (sdCardPath?: string) => {
    isDev && console.debug("[IPC] generateSyncChangeSummary invoked");
    return invoke("generateSyncChangeSummary", sdCardPath);
  },
  // Bank operations
  // Bank operations
  getAllBanks: () => {
    isDev && console.debug("[IPC] getAllBanks invoked");
    return invoke("get-all-banks");
  },
  getAllSamplesForKit: (kitName: string) => {
    isDev && console.debug("[IPC] getAllSamplesForKit invoked", kitName);
    return invoke("get-all-samples-for-kit", kitName);
  },
  // Database methods for kit metadata (replacing JSON file dependency)
  getKit: (kitName: string) => {
    isDev && console.debug("[IPC] getKit invoked", kitName);
    return invoke("get-kit", kitName);
  },
  getKitDeleteSummary: (kitName: string) => {
    isDev && console.debug("[IPC] getKitDeleteSummary invoked", kitName);
    return invoke("get-kit-delete-summary", kitName);
  },
  getKits: () => {
    isDev && console.debug("[IPC] getKits invoked");
    return invoke("get-all-kits");
  },
  getLocalStoreStatus: () => {
    isDev && console.debug("[IPC] getLocalStoreStatus invoked");
    return invoke("get-local-store-status");
  },
  getSampleAudioBuffer: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    knownVersion?: string,
  ) => {
    isDev &&
      console.debug(
        "[IPC] getSampleAudioBuffer invoked",
        kitName,
        voiceNumber,
        slotNumber,
      );
    return invoke(
      "get-sample-audio-buffer",
      kitName,
      voiceNumber,
      slotNumber,
      knownVersion,
    );
  },
  getUserHomeDir: () => {
    isDev && console.debug("[IPC] getUserHomeDir invoked");
    return invoke("get-user-home-dir");
  },
  listFilesInRoot: (localStorePath: string) => {
    isDev && console.debug("[IPC] listFilesInRoot invoked", localStorePath);
    return invoke("list-files-in-root", localStorePath);
  },
  // Cross-kit sample movement with source reindexing
  moveSampleBetweenKits: (
    fromKit: string,
    fromVoice: number,
    fromSlot: number,
    toKit: string,
    toVoice: number,
    toSlot: number,
    mode: "insert",
  ) => {
    isDev &&
      console.debug(
        "[IPC] moveSampleBetweenKits invoked",
        `${fromKit}:${fromVoice}:${fromSlot} -> ${toKit}:${toVoice}:${toSlot}`,
        mode,
      );
    return invoke("move-sample-between-kits", {
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
  ) => {
    isDev &&
      console.debug(
        "[IPC] moveSampleInKit invoked",
        kitName,
        `${fromVoice}:${fromSlot} -> ${toVoice}:${toSlot}`,
      );
    return invoke(
      "move-sample-in-kit",
      kitName,
      fromVoice,
      fromSlot,
      toVoice,
      toSlot,
    );
  },
  onLocalStoreDatabaseMissing: (callback: () => void) => {
    isDev &&
      console.debug("[IPC] onLocalStoreDatabaseMissing listener registered");
    return listen("local-store-database-missing", () => callback());
  },
  onSyncProgress: (
    callback: (progress: IpcEvents["sync-progress"]) => void,
  ) => {
    isDev && console.debug("[IPC] onSyncProgress listener registered");
    // One write at a time: a new listener replaces the last one
    ipcRenderer.removeAllListeners("sync-progress");
    return listen("sync-progress", callback);
  },
  openExternal: (url: string) => {
    isDev && console.debug("[IPC] openExternal invoked", url);
    return invoke("open-external", url);
  },
  readSettings: async () => {
    isDev && console.debug("[IPC] readSettings invoked");
    return await settingsManager.readSettings();
  },
  requestLocalStoreAccess: (targetPath: string) => {
    isDev && console.debug("[IPC] requestLocalStoreAccess invoked", targetPath);
    return invoke("request-local-store-access", targetPath);
  },
  rescanKit: (kitName: string) => {
    isDev && console.debug("[IPC] rescanKit invoked", kitName);
    return invoke("rescan-kit", kitName);
  },
  restoreKitSequence: (kitName: string, parts: Partial<SequenceSnapshot>) => {
    isDev && console.debug("[IPC] restoreKitSequence invoked", kitName);
    return invoke("restore-kit-sequence", kitName, parts);
  },
  restoreKitVoices: (kitName: string, voices: VoiceSnapshot[]) => {
    isDev && console.debug("[IPC] restoreKitVoices invoked", kitName);
    return invoke("restore-kit-voices", kitName, voices);
  },
  selectExistingLocalStore: () => {
    isDev && console.debug("[IPC] selectExistingLocalStore invoked");
    return invoke("select-existing-local-store");
  },
  selectLocalStorePath: () => {
    isDev && console.debug("[IPC] selectLocalStorePath invoked");
    return invoke("select-local-store-path");
  },
  selectSdCard: () => {
    isDev && console.debug("[IPC] selectSdCard invoked");
    return invoke("select-sd-card");
  },
  setSetting: async (key: SettingsKey, value: unknown): Promise<void> => {
    return await settingsManager.setSetting(key, value as SettingsValue);
  },
  setupImportBankNames: (dbDir: string, sourcePath: string) => {
    isDev &&
      console.debug("[IPC] setupImportBankNames invoked", dbDir, sourcePath);
    return invoke("setup-import-bank-names", dbDir, sourcePath);
  },
  setupImportKit: (dbDir: string, kitName: string) => {
    isDev && console.debug("[IPC] setupImportKit invoked", dbDir, kitName);
    return invoke("setup-import-kit", dbDir, kitName);
  },
  showItemInFolder: (path: string) => {
    isDev && console.debug("[IPC] showItemInFolder invoked", path);
    return invoke("show-item-in-folder", path);
  },
  startKitSync: (options: SyncOptions) => {
    isDev && console.debug("[IPC] startKitSync invoked", options);
    return invoke("startKitSync", options);
  },

  // Task 20.1: Favorites system
  toggleKitFavorite: (kitName: string) => {
    isDev && console.debug("[IPC] toggleKitFavorite invoked", kitName);
    return invoke("toggle-kit-favorite", kitName);
  },

  updateBank: (bankLetter: string, updates: { artist?: null | string }) => {
    isDev && console.debug("[IPC] updateBank invoked", bankLetter, updates);
    return invoke("update-bank", bankLetter, updates);
  },

  updateKit: (kitName: string, updates: KitMetadataUpdates) => {
    isDev && console.debug("[IPC] updateKit invoked", kitName, updates);
    return invoke("update-kit-metadata", kitName, updates);
  },

  updateKitBpm: (kitName: string, bpm: number) => {
    isDev && console.debug("[IPC] updateKitBpm invoked", kitName, bpm);
    return invoke("update-kit-bpm", kitName, bpm);
  },
  updateKitSlicerDivision: (kitName: string, division: number) => {
    isDev &&
      console.debug("[IPC] updateKitSlicerDivision invoked", kitName, division);
    return invoke("update-kit-slicer-division", kitName, division);
  },

  updateSampleGain: (
    kitName: string,
    voiceNumber: number,
    slotNumber: number,
    gainDb: number,
  ) => {
    isDev &&
      console.debug(
        "[IPC] updateSampleGain invoked",
        kitName,
        voiceNumber,
        slotNumber,
        gainDb,
      );
    return invoke(
      "update-sample-gain",
      kitName,
      voiceNumber,
      slotNumber,
      gainDb,
    );
  },

  updateSliceSteps: (kitName: string, sliceSteps: (null | SliceStep)[][]) => {
    isDev && console.debug("[IPC] updateSliceSteps invoked", kitName);
    return invoke("update-slice-steps", kitName, sliceSteps);
  },

  updateStepPattern: (kitName: string, stepPattern: number[][]) => {
    isDev &&
      console.debug("[IPC] updateStepPattern invoked", kitName, stepPattern);
    return invoke("update-step-pattern", kitName, stepPattern);
  },

  updateTriggerConditions: (
    kitName: string,
    triggerConditions: (null | string)[][],
  ) => {
    isDev &&
      console.debug(
        "[IPC] updateTriggerConditions invoked",
        kitName,
        triggerConditions,
      );
    return invoke("update-trigger-conditions", kitName, triggerConditions);
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
    return invoke("update-voice-alias", kitName, voiceNumber, voiceAlias);
  },

  updateVoiceSampleMode: (
    kitName: string,
    voiceNumber: number,
    sampleMode: string,
  ) => {
    isDev &&
      console.debug(
        "[IPC] updateVoiceSampleMode invoked",
        kitName,
        voiceNumber,
        sampleMode,
      );
    return invoke("update-voice-sample-mode", kitName, voiceNumber, sampleMode);
  },

  updateVoiceSliceSettings: (
    kitName: string,
    voiceNumber: number,
    settings: Partial<VoiceSliceSettings>,
  ) => {
    isDev &&
      console.debug(
        "[IPC] updateVoiceSliceSettings invoked",
        kitName,
        voiceNumber,
        settings,
      );
    return invoke(
      "update-voice-slice-settings",
      kitName,
      voiceNumber,
      settings,
    );
  },

  updateVoiceStereoMode: (
    kitName: string,
    voiceNumber: number,
    stereoMode: boolean,
  ) => {
    isDev &&
      console.debug(
        "[IPC] updateVoiceStereoMode invoked",
        kitName,
        voiceNumber,
        stereoMode,
      );
    return invoke("update-voice-stereo-mode", kitName, voiceNumber, stereoMode);
  },

  updateVoiceVolume: (kitName: string, voiceNumber: number, volume: number) => {
    isDev &&
      console.debug(
        "[IPC] updateVoiceVolume invoked",
        kitName,
        voiceNumber,
        volume,
      );
    return invoke("update-voice-volume", kitName, voiceNumber, volume);
  },

  validateLocalStore: (localStorePath?: string) => {
    isDev && console.debug("[IPC] validateLocalStore invoked", localStorePath);
    return invoke("validate-local-store", localStorePath);
  },

  validateLocalStoreBasic: (localStorePath?: string) => {
    isDev &&
      console.debug("[IPC] validateLocalStoreBasic invoked", localStorePath);
    return invoke("validate-local-store-basic", localStorePath);
  },

  validateSampleFormat: (filePath: string) => {
    isDev && console.debug("[IPC] validateSampleFormat invoked", filePath);
    return invoke("validate-sample-format", filePath);
  },
} satisfies ElectronAPI;

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// Initialize menu event forwarding
menuEventForwarder.initialize();

// Expose a function to get the file path from a dropped File object (Electron only).
// webUtils only yields a path for a File the user actually dropped or picked,
// so the path is reported to main, which then allows reading that file
// (RE-03). The renderer can't reach this channel with a path of its choosing.
contextBridge.exposeInMainWorld("electronFileAPI", {
  getDroppedFilePath: async (file: File) => {
    if (webUtils?.getPathForFile) {
      try {
        const filePath = await webUtils.getPathForFile(file);
        if (filePath) {
          await invoke("register-dropped-file", filePath);
        }
        return filePath;
      } catch (e) {
        console.error("webUtils.getPathForFile failed:", e);
        throw e;
      }
    }
    throw new Error("webUtils.getPathForFile is not available.");
  },
} satisfies ElectronFileAPI);

console.info("Preload script updated and loaded");

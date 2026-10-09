import type {
  ArchiveError,
  ArchiveProgress,
  ElectronAPI,
  MoveSampleBetweenKitsParams,
  SettingsData,
  SettingsKey,
  SyncProgress,
} from "./electronApi.js";

/** The arguments a channel carries from the preload to main */
export type IpcArgs<C extends IpcChannel> = IpcInvokeChannels[C]["args"];

export type IpcChannel = keyof IpcInvokeChannels;

/**
 * Events main sends the renderer, and what each carries. The preload
 * forwards them to the ElectronAPI listener named in the comment.
 */
export interface IpcEvents {
  /** downloadAndExtractArchive's onError */
  "archive-error": ArchiveError;
  /** downloadAndExtractArchive's onProgress */
  "archive-progress": ArchiveProgress;
  /** onLocalStoreDatabaseMissing (#535) */
  "local-store-database-missing": void;
  /** onSyncProgress */
  "sync-progress": SyncProgress;
}

/**
 * The IPC channels behind the ElectronAPI contract (#472): for each channel
 * the preload invokes and main handles, the arguments that cross the bridge
 * and what main resolves with.
 *
 * Most channels carry one ElectronAPI method's arguments and result as they
 * are (`Call<"method">`), so the channel can't drift from the method. Main
 * registers handlers through this map (`handle` in
 * electron/main/ipcHandle.ts) and the preload invokes through it, so a
 * handler or call whose arguments or result differ fails typecheck.
 *
 * Types only: the preload is built as CommonJS without a bundler, so it
 * can't load values from shared/.
 */
export interface IpcInvokeChannels {
  "add-sample-to-slot": Call<"addSampleToSlot">;
  "cancel-setup": Call<"cancelSetup">;
  cancelKitSync: Call<"cancelKitSync">;
  "check-disk-space": Call<"checkDiskSpace">;
  "check-existing-local-store": Call<"checkExistingLocalStore">;
  "check-kit-sample-files": Call<"checkKitSampleFiles">;
  "check-path-writable": Call<"checkPathWritable">;
  "cleanup-partial-init": Call<"cleanupPartialInit">;
  "close-app": Call<"closeApp">;
  "copy-dir": Call<"copyDir">;
  "copy-kit": Call<"copyKit">;
  "create-kit": Call<"createKit">;
  "create-romper-db": Call<"createRomperDb">;
  "delete-kit": Call<"deleteKit">;
  "delete-sample-from-slot": Call<"deleteSampleFromSlot">;
  /** The progress and error callbacks stay in the preload (IpcEvents) */
  "download-and-extract-archive": {
    args: [destDir: string];
    method: "downloadAndExtractArchive";
    result: Result<"downloadAndExtractArchive">;
  };
  "ensure-dir": Call<"ensureDir">;
  "finish-setup": Call<"finishSetup">;
  generateSyncChangeSummary: Call<"generateSyncChangeSummary">;
  "get-all-banks": Call<"getAllBanks">;
  "get-all-kits": Call<"getKits">;
  "get-all-samples-for-kit": Call<"getAllSamplesForKit">;
  "get-kit": Call<"getKit">;
  "get-kit-delete-summary": Call<"getKitDeleteSummary">;
  "get-kit-rample-save": Call<"getKitRampleSave">;
  "get-local-store-status": Call<"getLocalStoreStatus">;
  "get-sample-audio-buffer": Call<"getSampleAudioBuffer">;
  "get-user-home-dir": Call<"getUserHomeDir">;
  "list-files-in-root": Call<"listFilesInRoot">;
  /** Sent as one object */
  "move-sample-between-kits": {
    args: [params: MoveSampleBetweenKitsParams];
    method: "moveSampleBetweenKits";
    result: Result<"moveSampleBetweenKits">;
  };
  "move-sample-in-kit": Call<"moveSampleInKit">;
  "open-external": Call<"openExternal">;
  /** Main's saved settings; the preload's readSettings returns them */
  "read-settings": {
    args: [];
    method: "readSettings";
    result: SettingsData;
  };
  /** The path of a file the user dropped (ElectronFileAPI) */
  "register-dropped-file": {
    args: [filePath: string];
    method: null;
    result: void;
  };
  "request-local-store-access": Call<"requestLocalStoreAccess">;
  "rescan-kit": Call<"rescanKit">;
  "restore-kit-sequence": Call<"restoreKitSequence">;
  "restore-kit-voices": Call<"restoreKitVoices">;
  "select-existing-local-store": Call<"selectExistingLocalStore">;
  "select-local-store-path": Call<"selectLocalStorePath">;
  "select-sd-card": Call<"selectSdCard">;
  "setup-backup-rample-save": Call<"setupBackupRampleSave">;
  "setup-import-bank-names": Call<"setupImportBankNames">;
  "setup-import-kit": Call<"setupImportKit">;
  "show-item-in-folder": Call<"showItemInFolder">;
  startKitSync: Call<"startKitSync">;
  "toggle-kit-favorite": Call<"toggleKitFavorite">;
  "update-bank": Call<"updateBank">;
  "update-kit-bpm": Call<"updateKitBpm">;
  "update-kit-metadata": Call<"updateKit">;
  "update-kit-slicer-division": Call<"updateKitSlicerDivision">;
  "update-sample-gain": Call<"updateSampleGain">;
  "update-slice-steps": Call<"updateSliceSteps">;
  "update-step-pattern": Call<"updateStepPattern">;
  "update-trigger-conditions": Call<"updateTriggerConditions">;
  "update-voice-alias": Call<"updateVoiceAlias">;
  "update-voice-sample-mode": Call<"updateVoiceSampleMode">;
  "update-voice-slice-settings": Call<"updateVoiceSliceSettings">;
  "update-voice-stereo-mode": Call<"updateVoiceStereoMode">;
  "update-voice-volume": Call<"updateVoiceVolume">;
  "validate-local-store": Call<"validateLocalStore">;
  "validate-local-store-basic": Call<"validateLocalStoreBasic">;
  "validate-sample-format": Call<"validateSampleFormat">;
  /** setSetting's channel; main rejects a path setting it hasn't granted */
  "write-settings": {
    args: [key: SettingsKey, value: unknown];
    method: "setSetting";
    result: void;
  };
}

/** What main resolves a channel's call with */
export type IpcResult<C extends IpcChannel> = IpcInvokeChannels[C]["result"];

/** The ElectronAPI methods that invoke a channel */
export type MethodWithChannel = Exclude<
  IpcInvokeChannels[IpcChannel]["method"],
  null
>;

/** A channel that carries one ElectronAPI method's arguments and result */
type Call<M extends keyof ElectronAPI> = {
  args: Parameters<ElectronAPI[M]>;
  method: M;
  result: Result<M>;
};

type Result<M extends keyof ElectronAPI> = Awaited<ReturnType<ElectronAPI[M]>>;

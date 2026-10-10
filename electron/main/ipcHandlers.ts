import { getErrorMessage } from "@romper/shared/errorUtils.js";
import { app, BrowserWindow, dialog, shell } from "electron";
import * as path from "node:path";

import type { InMemorySettings } from "./types/settings.js";

import {
  closeAllDbConnections,
  setDatabaseMissingListener,
} from "./db/utils/dbConnections.js";
import { handle, sendEvent } from "./ipcHandle.js";
import { requestLocalStoreAccess } from "./security/localStoreAccessPrompt.js";
import { checkSetupPathAccess, pathAccess } from "./security/pathAccess.js";
import {
  archiveService,
  getFactorySamplesArchiveUrl,
} from "./services/archiveService.js";
import { kitService } from "./services/kitService.js";
import { localStoreService } from "./services/localStoreService.js";
import { localStoreSetupService } from "./services/localStoreSetupService.js";
import { sampleService } from "./services/sampleService.js";
import { getSdCardDialogDefaultPath } from "./services/sdCardSafety.js";
import { settingsService } from "./services/settingsService.js";
import { storeCheckService } from "./services/storeCheckService.js";
import {
  checkDiskSpaceSufficient,
  checkPathWritable,
  ServicePathManager,
} from "./utils/fileSystemUtils.js";
import { logger } from "./utils/logger.js";

// Settings whose value becomes an allowed root, so the renderer can't widen
// its own file access by writing one (RE-03).
const PATH_SETTING_KEYS: ReadonlySet<string> = new Set([
  "localStorePath",
  "sdCardPath",
]);

export function registerIpcHandlers(inMemorySettings: InMemorySettings) {
  pathAccess.useSettings(inMemorySettings);

  handle("read-settings", () => settingsService.readSettings(inMemorySettings));

  handle("write-settings", async (_event, key: string, value: unknown) => {
    const clearing = value === null || value === undefined || value === "";
    if (PATH_SETTING_KEYS.has(key) && !clearing) {
      await pathAccess.assertAllowed(value, { write: true });
    }
    const previousStore = inMemorySettings.localStorePath;
    settingsService.writeSetting(inMemorySettings, key, value);
    // A different store: stop checking the old one's files (#812), then
    // close its connection (RE-81). The new store's connection opens on its
    // first use, and its check starts when its kit grid has loaded.
    if (key === "localStorePath" && value !== previousStore) {
      storeCheckService.cancel();
      closeAllDbConnections();
    }
    // The wizard saves the store as the last step of a successful setup. It
    // marked the store finished already (finish-setup); this covers any
    // other caller that saves a store setup built.
    if (key === "localStorePath" && typeof value === "string" && !clearing) {
      localStoreSetupService.markSetupComplete(value);
    }
  });

  // Add local store status handler
  handle("get-local-store-status", (_) => {
    logger.log("[Main] get-local-store-status called");

    const result = localStoreService.getLocalStoreStatus(
      inMemorySettings.localStorePath,
      process.env.ROMPER_LOCAL_PATH,
    );

    logger.log("[Main] Returning local store status:", result);
    return result;
  });

  // The store's database file went missing while Romper ran (deleted or
  // moved outside it). Tell the renderer, which checks the store again and
  // shows the Invalid Local Store dialog (#535).
  setDatabaseMissingListener(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        sendEvent(win.webContents, "local-store-database-missing");
      }
    }
  });

  // The background check of the store's sample files (#812). The kit grid
  // asks for its status once it has loaded, which also starts the check; a
  // step that changes a kit's finding is pushed to the renderer.
  storeCheckService.onUpdate((update) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        sendEvent(win.webContents, "store-check-updated", update);
      }
    }
  });
  handle("get-store-check-status", () => {
    const localStorePath =
      ServicePathManager.getLocalStorePath(inMemorySettings);
    if (localStorePath) storeCheckService.start(localStorePath);
    return { data: storeCheckService.getStatus(), success: true };
  });

  // Add close app handler
  handle("close-app", () => {
    app.quit();
  });

  handle("select-sd-card", async () => {
    // In test mode with ROMPER_SDCARD_PATH set, use that instead of opening dialog
    if (
      process.env.ROMPER_TEST_MODE === "true" &&
      process.env.ROMPER_SDCARD_PATH
    ) {
      return process.env.ROMPER_SDCARD_PATH;
    }

    const result = await dialog.showOpenDialog({
      defaultPath: getSdCardDialogDefaultPath(),
      properties: ["openDirectory"],
      title: "Select SD Card Path",
    });
    if (result.canceled) return null;
    pathAccess.grantRoot(result.filePaths[0]);
    return result.filePaths[0];
  });

  // Show item in folder handler
  handle("show-item-in-folder", (_event, path: string) => {
    shell.showItemInFolder(path);
  });

  // Open an external link in the system browser (https only)
  handle("open-external", async (_event, url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { error: `Invalid URL: ${url}`, success: false };
    }
    if (parsed.protocol !== "https:") {
      return {
        error: `Refusing to open non-https URL: ${url}`,
        success: false,
      };
    }
    // No app to open the link with, say: a result, as the contract says,
    // rather than a rejected call (#472)
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { error: getErrorMessage(error), success: false };
    }
  });

  handle("get-kit-delete-summary", (_event, kitName: string) =>
    kitService.getKitDeleteSummary(inMemorySettings, kitName),
  );

  handle("delete-kit", (_event, kitName: string) =>
    kitService.deleteKit(inMemorySettings, kitName),
  );

  handle("create-kit", (_event, kitSlot: string) =>
    kitService.createKit(inMemorySettings, kitSlot),
  );

  handle("copy-kit", (_event, sourceKit: string, destKit: string) =>
    kitService.copyKit(inMemorySettings, sourceKit, destKit),
  );
  // Setup lists the card's kit folders with this. The result says why a
  // listing failed (a card that stopped responding, #724), rather than
  // rejecting with Electron's IPC wrapping around the reason.
  handle("list-files-in-root", async (_event, localStorePath: string) => {
    const access = await checkSetupPathAccess(localStorePath);
    if (!access.ok) return { error: access.error, success: false };
    return localStoreService.listFilesInRoot(localStorePath);
  });
  // A slot's audio by kit/voice/slot, not by path; skipped when the
  // renderer already holds the file's current version (#478)
  handle(
    "get-sample-audio-buffer",
    (
      _event,
      kitName: string,
      voiceNumber: number,
      slotNumber: number,
      knownVersion?: string,
    ) => {
      return sampleService.getSampleAudioBuffer(
        inMemorySettings,
        kitName,
        voiceNumber,
        slotNumber,
        typeof knownVersion === "string" ? knownVersion : undefined,
      );
    },
  );
  handle("get-user-home-dir", async () => {
    const os = await import("node:os");
    return os.homedir();
  });
  handle("select-local-store-path", async () => {
    const { dialog } = await import("electron");
    const result = await dialog.showOpenDialog({
      message: "Choose a folder for your Romper local store.",
      properties: ["openDirectory", "createDirectory"],
      title: "Select Local Store Folder",
    });
    if (result.canceled || !result.filePaths.length) return undefined;
    pathAccess.grantRoot(result.filePaths[0]);
    return result.filePaths[0];
  });

  handle("select-existing-local-store", async () => {
    const result = await dialog.showOpenDialog({
      message: "Select a folder that contains a .romperdb directory",
      properties: ["openDirectory"],
      title: "Choose Existing Local Store",
    });

    if (result.canceled || !result.filePaths[0]) {
      return { error: "Selection cancelled", path: null, success: false };
    }

    pathAccess.grantRoot(result.filePaths[0]);
    return localStoreService.validateExistingLocalStore(result.filePaths[0]);
  });

  // A folder the user typed into the setup wizard: main asks the user to
  // confirm it before any channel will write there.
  handle("request-local-store-access", (event, targetPath: string) =>
    requestLocalStoreAccess(event.sender, targetPath),
  );

  // The preload reports each file path it resolved from a real user drop
  // (webUtils.getPathForFile), so main can allow reading that file.
  handle("register-dropped-file", (_event, filePath: string) =>
    pathAccess.grantRead(filePath),
  );

  // Installs the Squarp factory samples into destDir. The archive URL is
  // fixed in main (getFactorySamplesArchiveUrl); the renderer can't choose it.
  handle("download-and-extract-archive", async (event, destDir: string) => {
    const access = await checkSetupPathAccess(destDir, { write: true });
    if (!access.ok) {
      sendEvent(event.sender, "archive-error", { message: access.error });
      return { error: access.error, success: false };
    }
    try {
      // Record what the extraction creates so a cancelled or failed
      // setup can remove it (RE-66)
      const result = await localStoreSetupService.trackCreatedEntries(
        destDir,
        () =>
          archiveService.downloadAndExtractArchive(
            getFactorySamplesArchiveUrl(),
            destDir,
            (progress) => {
              sendEvent(event.sender, "archive-progress", progress);
            },
            localStoreSetupService.setupSignal,
          ),
      );

      if (!result.success && !result.cancelled) {
        sendEvent(event.sender, "archive-error", {
          message: result.error,
        });
      }

      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      sendEvent(event.sender, "archive-error", { message });
      return { error: message, success: false };
    }
  });
  handle("ensure-dir", async (_event, dir: string) => {
    const access = await checkSetupPathAccess(dir, { write: true });
    if (!access.ok) return { error: access.error, success: false };
    return archiveService.ensureDirectory(dir);
  });

  handle("copy-dir", async (_event, src: string, dest: string) => {
    const access = await checkSetupPathAccess(src);
    const destAccess = access.ok
      ? await checkSetupPathAccess(dest, { write: true })
      : access;
    if (!destAccess.ok) return { error: destAccess.error, success: false };
    // Setup copies each kit from the card into the new store; record the
    // folder so a cancelled or failed setup can remove it (RE-66)
    return localStoreSetupService.trackCreatedEntries(path.dirname(dest), () =>
      archiveService.copyDirectory(src, dest),
    );
  });

  // Stop the setup download or extraction in progress (RE-66)
  handle("cancel-setup", () => {
    localStoreSetupService.cancelSetup();
    return { success: true };
  });

  // The store setup built is complete: a quit no longer cleans it up, even
  // if saving it as the local store then fails (#616)
  handle("finish-setup", async (_event, targetPath: string) => {
    const access = await checkSetupPathAccess(targetPath, { write: true });
    if (!access.ok) return { error: access.error, success: false };
    localStoreSetupService.markSetupComplete(targetPath);
    return { success: true };
  });

  handle(
    "check-disk-space",
    async (_event, targetPath: string, requiredBytes: number) => {
      const access = await checkSetupPathAccess(targetPath);
      if (!access.ok) {
        return {
          availableBytes: 0,
          error: access.error,
          requiredBytes,
          sufficient: false,
        };
      }
      return checkDiskSpaceSufficient(targetPath, requiredBytes);
    },
  );

  handle("check-path-writable", async (_event, targetPath: string) => {
    const access = await checkSetupPathAccess(targetPath, { write: true });
    if (!access.ok) return { error: access.error, writable: false };
    return checkPathWritable(targetPath);
  });

  // RE-10 decides what setup may remove; RE-03 first confines the target to
  // a folder Romper has been given.
  handle("cleanup-partial-init", async (_event, targetPath: string) => {
    const access = await checkSetupPathAccess(targetPath, { write: true });
    if (!access.ok) return { error: access.error, removed: false };
    return localStoreSetupService.cleanupFailedSetup(
      targetPath,
      ServicePathManager.getLocalStorePath(inMemorySettings),
    );
  });

  // Read-only probe, but it still reveals whether a folder holds a store, so
  // it is confined too. Fails closed: if Romper may not look, the wizard is
  // told to stop (with the access error) rather than that the folder is free.
  handle("check-existing-local-store", async (_event, targetPath: string) => {
    const access = await checkSetupPathAccess(targetPath);
    if (!access.ok) return { error: access.error, exists: true };
    return localStoreSetupService.hasExistingLocalStore(targetPath);
  });
}

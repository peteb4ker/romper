import { app, dialog, ipcMain, shell } from "electron";
import * as path from "node:path";

import type { InMemorySettings } from "./types/settings.js";

import { closeAllDbConnections } from "./db/utils/dbConnections.js";
import { requestLocalStoreAccess } from "./security/localStoreAccessPrompt.js";
import { checkPathAccess, pathAccess } from "./security/pathAccess.js";
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

  ipcMain.handle("read-settings", () =>
    settingsService.readSettings(inMemorySettings),
  );

  ipcMain.handle("write-settings", (_event, key: string, value: unknown) => {
    const clearing = value === null || value === undefined || value === "";
    if (PATH_SETTING_KEYS.has(key) && !clearing) {
      pathAccess.assertAllowed(value, { write: true });
    }
    const previousStore = inMemorySettings.localStorePath;
    settingsService.writeSetting(inMemorySettings, key, value);
    // A different store: close the old one's connection (RE-81). The new
    // store's connection opens on its first use.
    if (key === "localStorePath" && value !== previousStore) {
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
  ipcMain.handle("get-local-store-status", (_) => {
    logger.log("[Main] get-local-store-status called");

    const result = localStoreService.getLocalStoreStatus(
      inMemorySettings.localStorePath,
      process.env.ROMPER_LOCAL_PATH,
    );

    logger.log("[Main] Returning local store status:", result);
    return result;
  });

  // Add close app handler
  ipcMain.handle("close-app", () => {
    app.quit();
  });

  ipcMain.handle("select-sd-card", async () => {
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
  ipcMain.handle("show-item-in-folder", (_event, path: string) => {
    shell.showItemInFolder(path);
  });

  // Open an external link in the system browser (https only)
  ipcMain.handle("open-external", async (_event, url: string) => {
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
    await shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle("get-kit-delete-summary", (_event, kitName: string) =>
    kitService.getKitDeleteSummary(inMemorySettings, kitName),
  );

  ipcMain.handle("delete-kit", (_event, kitName: string) =>
    kitService.deleteKit(inMemorySettings, kitName),
  );

  ipcMain.handle("create-kit", (_event, kitSlot: string) =>
    kitService.createKit(inMemorySettings, kitSlot),
  );

  ipcMain.handle("copy-kit", (_event, sourceKit: string, destKit: string) =>
    kitService.copyKit(inMemorySettings, sourceKit, destKit),
  );
  ipcMain.handle("list-files-in-root", (_event, localStorePath: string) => {
    pathAccess.assertAllowed(localStorePath);
    return localStoreService.listFilesInRoot(localStorePath);
  });
  // Secure method - get audio buffer by sample identifier
  ipcMain.handle(
    "get-sample-audio-buffer",
    (_event, kitName: string, voiceNumber: number, slotNumber: number) => {
      return sampleService.getSampleAudioBuffer(
        inMemorySettings,
        kitName,
        voiceNumber,
        slotNumber,
      );
    },
  );
  ipcMain.handle("get-user-home-dir", async () => {
    const os = await import("node:os");
    return os.homedir();
  });
  ipcMain.handle("select-local-store-path", async () => {
    const { dialog } = await import("electron");
    const result = await dialog.showOpenDialog({
      message: "Choose a folder for your Romper local store.",
      properties: ["openDirectory", "createDirectory"],
      title: "Select Local Store Folder",
    });
    if (result.canceled || !result.filePaths.length) return null;
    pathAccess.grantRoot(result.filePaths[0]);
    return result.filePaths[0];
  });

  ipcMain.handle("select-existing-local-store", async () => {
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
  ipcMain.handle("request-local-store-access", (event, targetPath: string) =>
    requestLocalStoreAccess(event.sender, targetPath),
  );

  // The preload reports each file path it resolved from a real user drop
  // (webUtils.getPathForFile), so main can allow reading that file.
  ipcMain.handle("register-dropped-file", (_event, filePath: string) => {
    pathAccess.grantRead(filePath);
  });

  // Installs the Squarp factory samples into destDir. The archive URL is
  // fixed in main (getFactorySamplesArchiveUrl); the renderer can't choose it.
  ipcMain.handle(
    "download-and-extract-archive",
    async (event, destDir: string) => {
      const access = checkPathAccess(destDir, { write: true });
      if (!access.ok) {
        event.sender.send("archive-error", { message: access.error });
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
                event.sender.send("archive-progress", progress);
              },
              localStoreSetupService.setupSignal,
            ),
        );

        if (!result.success && !result.cancelled) {
          event.sender.send("archive-error", { message: result.error });
        }

        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        event.sender.send("archive-error", { message });
        return { error: message, success: false };
      }
    },
  );
  ipcMain.handle("ensure-dir", (_event, dir: string) => {
    const access = checkPathAccess(dir, { write: true });
    if (!access.ok) return { error: access.error, success: false };
    return archiveService.ensureDirectory(dir);
  });

  ipcMain.handle("copy-dir", (_event, src: string, dest: string) => {
    const access = checkPathAccess(src);
    const destAccess = access.ok
      ? checkPathAccess(dest, { write: true })
      : access;
    if (!destAccess.ok) return { error: destAccess.error, success: false };
    // Setup copies each kit from the card into the new store; record the
    // folder so a cancelled or failed setup can remove it (RE-66)
    return localStoreSetupService.trackCreatedEntries(path.dirname(dest), () =>
      archiveService.copyDirectory(src, dest),
    );
  });

  // Stop the setup download or extraction in progress (RE-66)
  ipcMain.handle("cancel-setup", () => {
    localStoreSetupService.cancelSetup();
    return { success: true };
  });

  // The store setup built is complete: a quit no longer cleans it up, even
  // if saving it as the local store then fails (#616)
  ipcMain.handle("finish-setup", (_event, targetPath: string) => {
    const access = checkPathAccess(targetPath, { write: true });
    if (!access.ok) return { error: access.error, success: false };
    localStoreSetupService.markSetupComplete(targetPath);
    return { success: true };
  });

  ipcMain.handle(
    "check-disk-space",
    (_event, targetPath: string, requiredBytes: number) => {
      const access = checkPathAccess(targetPath);
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

  ipcMain.handle("check-path-writable", (_event, targetPath: string) => {
    const access = checkPathAccess(targetPath, { write: true });
    if (!access.ok) return { error: access.error, writable: false };
    return checkPathWritable(targetPath);
  });

  // RE-10 decides what setup may remove; RE-03 first confines the target to
  // a folder Romper has been given.
  ipcMain.handle("cleanup-partial-init", (_event, targetPath: string) => {
    const access = checkPathAccess(targetPath, { write: true });
    if (!access.ok) return { error: access.error, removed: false };
    return localStoreSetupService.cleanupFailedSetup(
      targetPath,
      ServicePathManager.getLocalStorePath(inMemorySettings),
    );
  });

  // Read-only probe, but it still reveals whether a folder holds a store, so
  // it is confined too. Fails closed: if Romper may not look, the wizard is
  // told to stop (with the access error) rather than that the folder is free.
  ipcMain.handle("check-existing-local-store", (_event, targetPath: string) => {
    const access = checkPathAccess(targetPath);
    if (!access.ok) return { error: access.error, exists: true };
    return localStoreSetupService.hasExistingLocalStore(targetPath);
  });
}

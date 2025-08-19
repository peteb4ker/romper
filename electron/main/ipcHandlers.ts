import { app, dialog, ipcMain, shell } from "electron";

import { archiveService } from "./services/archiveService.js";
import { kitService } from "./services/kitService.js";
import { localStoreService } from "./services/localStoreService.js";
import { sampleService } from "./services/sampleService.js";
import { settingsService } from "./services/settingsService.js";

export function registerIpcHandlers(inMemorySettings: Record<string, any>) {
  ipcMain.handle("read-settings", () =>
    settingsService.readSettings(inMemorySettings)
  );

  ipcMain.handle("write-settings", (_event, key: string, value: any) => {
    settingsService.writeSetting(inMemorySettings, key, value);
  });

  // Add local store status handler
  ipcMain.handle("get-local-store-status", (_) => {
    console.log("[Main] get-local-store-status called");

    const result = localStoreService.getLocalStoreStatus(
      inMemorySettings.localStorePath,
      process.env.ROMPER_LOCAL_PATH
    );

    console.log("[Main] Returning local store status:", result);
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

    const os = await import("os");
    const result = await dialog.showOpenDialog({
      defaultPath: os.homedir(),
      properties: ["openDirectory"],
      title: "Select SD Card Path",
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Show item in folder handler
  ipcMain.handle("show-item-in-folder", async (_event, path: string) => {
    shell.showItemInFolder(path);
  });
  ipcMain.handle("create-kit", async (_event, kitSlot: string) => {
    // Add environment override to settings for this operation
    const effectiveSettings = {
      ...inMemorySettings,
      localStorePath:
        process.env.ROMPER_LOCAL_PATH || inMemorySettings.localStorePath,
    };

    const result = kitService.createKit(effectiveSettings, kitSlot);
    if (!result.success) {
      throw new Error(result.error || "Failed to create kit");
    }
  });

  ipcMain.handle(
    "copy-kit",
    async (_event, sourceKit: string, destKit: string) => {
      // Add environment override to settings for this operation
      const effectiveSettings = {
        ...inMemorySettings,
        localStorePath:
          process.env.ROMPER_LOCAL_PATH || inMemorySettings.localStorePath,
      };

      const result = kitService.copyKit(effectiveSettings, sourceKit, destKit);
      if (!result.success) {
        throw new Error(result.error || "Failed to copy kit");
      }
    }
  );
  ipcMain.handle("list-files-in-root", async (_event, localStorePath: string) =>
    localStoreService.listFilesInRoot(localStorePath)
  );
  // Secure method - get audio buffer by sample identifier
  ipcMain.handle(
    "get-sample-audio-buffer",
    async (
      _event,
      kitName: string,
      voiceNumber: number,
      slotNumber: number
    ) => {
      const result = sampleService.getSampleAudioBuffer(
        inMemorySettings,
        kitName,
        voiceNumber,
        slotNumber
      );

      if (!result.success) {
        throw new Error(result.error || "Failed to get sample audio buffer");
      }

      return result.data;
    }
  );
  ipcMain.handle("read-file", async (_event, filePath: string) => {
    return localStoreService.readFile(filePath);
  });
  ipcMain.handle("get-user-home-dir", async () => {
    const os = await import("os");
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

    return localStoreService.validateExistingLocalStore(result.filePaths[0]);
  });
  ipcMain.handle(
    "download-and-extract-archive",
    async (event, url: string, destDir: string) => {
      try {
        const result = await archiveService.downloadAndExtractArchive(
          url,
          destDir,
          (progress) => {
            event.sender.send("archive-progress", progress);
          }
        );

        if (!result.success) {
          event.sender.send("archive-error", { message: result.error });
        }

        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        event.sender.send("archive-error", { message });
        return { error: message, success: false };
      }
    }
  );
  ipcMain.handle("ensure-dir", async (_event, dir: string) => {
    return archiveService.ensureDirectory(dir);
  });

  ipcMain.handle("copy-dir", async (_event, src: string, dest: string) => {
    return archiveService.copyDirectory(src, dest);
  });
}

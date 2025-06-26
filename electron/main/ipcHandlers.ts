import { app, dialog, ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as unzipper from "unzipper";

import {
  countZipEntries,
  downloadArchive,
  extractZipEntries,
} from "./archiveUtils.js";
import { insertKitRecord } from "./db/romperDbCore.js";
import { getKitByName } from "./db/romperDbCore.js";
import { validateLocalStoreAndDb } from "./localStoreValidator.js";

// Utility: recursively copy a directory
function copyRecursiveSync(src: string, dest: string) {
  fs.mkdirSync(dest);
  for (const item of fs.readdirSync(src)) {
    const srcItem = path.join(src, item);
    const destItem = path.join(dest, item);
    if (fs.lstatSync(srcItem).isDirectory()) {
      copyRecursiveSync(srcItem, destItem);
    } else {
      fs.copyFileSync(srcItem, destItem);
    }
  }
}

export function registerIpcHandlers(
  watchers: { [key: string]: fs.FSWatcher },
  inMemorySettings: Record<string, any>,
) {
  ipcMain.handle("read-settings", (_event) => inMemorySettings);
  ipcMain.handle("write-settings", (_event, key: string, value: any) => {
    console.log("[Main] write-settings called with key:", key, "value:", value);
    const userDataPath = app.getPath("userData");
    const settingsPath = path.join(userDataPath, "settings.json");
    console.log("[Main] Settings path:", settingsPath);
    inMemorySettings[key] = value;
    console.log("[Main] Updated inMemorySettings:", inMemorySettings);

    fs.writeFileSync(
      settingsPath,
      JSON.stringify(inMemorySettings, null, 2),
      "utf-8",
    );
    console.log("[Main] Settings written to file");
  });

  // Add local store status handler
  ipcMain.handle("get-local-store-status", (_event) => {
    console.log("[Main] get-local-store-status called");
    const localStorePath = inMemorySettings.localStorePath;
    console.log("[Main] Current localStorePath in settings:", localStorePath);

    if (!localStorePath) {
      console.log("[Main] No local store configured");
      return {
        hasLocalStore: false,
        localStorePath: null,
        isValid: false,
        error: "No local store configured",
      };
    }

    // Validate current paths using shared validation logic
    console.log("[Main] Validating local store path:", localStorePath);
    const validationResult = validateLocalStoreAndDb(localStorePath);
    console.log("[Main] Validation result:", validationResult);

    const result = {
      hasLocalStore: true,
      localStorePath,
      isValid: validationResult.isValid,
      error: validationResult.error || null,
    };
    console.log("[Main] Returning local store status:", result);
    return result;
  });

  // Add close app handler
  ipcMain.handle("close-app", () => {
    app.quit();
  });

  ipcMain.handle("scan-sd-card", async (event, localStorePath) => {
    return fs
      .readdirSync(localStorePath)
      .filter((folder) => /^[A-Z][0-9]{1,2}$/.test(folder));
  });
  ipcMain.handle("select-sd-card", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select SD Card Path",
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("watch-sd-card", (event, localStorePath: string) => {
    const watcherId = `${localStorePath}-${Date.now()}`;
    const watcher = fs.watch(
      localStorePath,
      { persistent: true },
      (eventType, filename) => {
        if (filename)
          event.sender.send("sd-card-changed", { eventType, filename });
      },
    );
    watchers[watcherId] = watcher;
    return watcherId;
  });
  ipcMain.handle("unwatch-sd-card", (event, watcherId: string) => {
    if (watchers[watcherId]) {
      watchers[watcherId].close();
      delete watchers[watcherId];
    }
  });
  ipcMain.handle("get-user-data-path", () => app.getPath("userData"));
  ipcMain.handle(
    "create-kit",
    async (_event, localStorePath: string, kitSlot: string) => {
      if (!/^[A-Z][0-9]{1,2}$/.test(kitSlot))
        throw new Error("Invalid kit slot. Use format A0-Z99.");
      const kitPath = path.join(localStorePath, kitSlot);
      if (fs.existsSync(kitPath)) throw new Error("Kit already exists.");
      fs.mkdirSync(kitPath);

      // Create kit record in database instead of JSON
      try {
        const kitRecord = {
          name: kitSlot,
          plan_enabled: false,
          locked: false,
        };
        await insertKitRecord(localStorePath, kitRecord);
      } catch (error) {
        // If database insertion fails, remove the created directory
        fs.rmSync(kitPath, { recursive: true, force: true });
        throw error;
      }
    },
  );
  ipcMain.handle(
    "copy-kit",
    async (
      _event,
      localStorePath: string,
      sourceKit: string,
      destKit: string,
    ) => {
      if (
        !/^[A-Z][0-9]{1,2}$/.test(sourceKit) ||
        !/^[A-Z][0-9]{1,2}$/.test(destKit)
      )
        throw new Error("Invalid kit slot. Use format A0-Z99.");
      const srcPath = path.join(localStorePath, sourceKit);
      const destPath = path.join(localStorePath, destKit);
      if (!fs.existsSync(srcPath))
        throw new Error("Source kit does not exist.");
      if (fs.existsSync(destPath))
        throw new Error("Destination kit already exists.");
      copyRecursiveSync(srcPath, destPath);

      // Copy kit metadata in database
      try {
        const sourceKitData = await getKitByName(localStorePath, sourceKit);
        if (sourceKitData.success && sourceKitData.data) {
          const destKitRecord = {
            name: destKit,
            alias: destKit,
            plan_enabled: sourceKitData.data.plan_enabled,
            locked: sourceKitData.data.locked,
          };
          await insertKitRecord(localStorePath, destKitRecord);
        } else {
          // If source kit doesn't exist in database, create default entry
          const defaultKitRecord = {
            name: destKit,
            plan_enabled: false,
            locked: false,
          };
          await insertKitRecord(localStorePath, defaultKitRecord);
        }
      } catch (error) {
        // If database operation fails, remove the copied directory
        fs.rmSync(destPath, { recursive: true, force: true });
        throw error;
      }
    },
  );
  ipcMain.handle("list-files-in-root", async (_event, localStorePath: string) =>
    fs.readdirSync(localStorePath),
  );
  ipcMain.handle("get-audio-buffer", async (_event, filePath: string) => {
    const data = fs.readFileSync(filePath);
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    );
  });
  ipcMain.handle("read-file", async (_event, filePath: string) => {
    try {
      const data = fs.readFileSync(filePath);
      return {
        success: true,
        data: data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ),
      };
    } catch (error: any) {
      console.error("[Main] Failed to read file:", filePath, error);
      return {
        success: false,
        error: error.message || "Failed to read file",
      };
    }
  });
  ipcMain.handle("get-user-home-dir", async () => {
    const os = await import("os");
    return os.homedir();
  });
  ipcMain.handle("select-local-store-path", async () => {
    const { dialog } = await import("electron");
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Select Local Store Folder",
      message: "Choose a folder for your Romper local store.",
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });
  ipcMain.handle(
    "download-and-extract-archive",
    async (event, url: string, destDir: string) => {
      const os = await import("os");
      const fsPromises = fs.promises;
      const tmp = os.tmpdir();
      let tmpZipPath: string | undefined;

      try {
        // Handle file:// URLs for testing
        if (url.startsWith("file://")) {
          // Extract the local file path from the file:// URL
          tmpZipPath = url.replace("file://", "");
          console.log("[Main] Using local file for extraction:", tmpZipPath);

          // Check if the file exists
          if (!fs.existsSync(tmpZipPath)) {
            throw new Error(`Local file does not exist: ${tmpZipPath}`);
          }
        } else {
          // Download from HTTPS URL
          tmpZipPath = path.join(tmp, `romper_download_${Date.now()}.zip`);
          // Download
          await downloadArchive(url, tmpZipPath, (percent: number | null) => {
            event.sender.send("archive-progress", {
              phase: "Downloading",
              percent,
            });
          });
        }

        // Count entries
        let entryCount = 0;
        try {
          entryCount = await countZipEntries(tmpZipPath);
        } catch {
          entryCount = 0;
        }
        // Extract
        await extractZipEntries(
          tmpZipPath,
          destDir,
          entryCount,
          ({ percent, file }: { percent: number | null; file: string }) => {
            event.sender.send("archive-progress", {
              phase: "Extracting",
              percent,
              file,
            });
          },
        );
        event.sender.send("archive-progress", { phase: "Done", percent: 100 });
        return { success: true };
      } catch (e) {
        // Only clean up the temp file if we downloaded it (not for file:// URLs)
        if (!url.startsWith("file://") && tmpZipPath) {
          try {
            await fsPromises.unlink(tmpZipPath);
          } catch {}
        }
        let message = e instanceof Error ? e.message : String(e);
        if (message && message.includes("premature close")) {
          message =
            "Extraction failed: Archive closed unexpectedly. Please try again.";
        }
        event.sender.send("archive-error", { message });
        return { success: false, error: message };
      }
    },
  );
  ipcMain.handle("ensure-dir", async (_event, dir: string) => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
  ipcMain.handle("copy-dir", async (_event, src: string, dest: string) => {
    try {
      copyRecursiveSync(src, dest);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
}

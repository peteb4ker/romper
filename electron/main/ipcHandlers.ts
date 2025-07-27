import { app, dialog, ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as unzipper from "unzipper";

import {
  countZipEntries,
  downloadArchive,
  extractZipEntries,
} from "./archiveUtils.js";
import { addKit } from "./db/romperDbCoreORM.js";
import { getKit } from "./db/romperDbCoreORM.js";
import { getKitSamples } from "./db/romperDbCoreORM.js";
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

export function registerIpcHandlers(inMemorySettings: Record<string, any>) {
  ipcMain.handle("read-settings", (_event) => inMemorySettings);
  ipcMain.handle("write-settings", (_event, key: string, value: any) => {
    console.log("[Main] write-settings called with key:", key, "value:", value);
    const userDataPath = app.getPath("userData");
    const settingsPath = path.join(userDataPath, "romper-settings.json");
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
    // Check environment variable first, then fall back to stored settings
    const localStorePath =
      process.env.ROMPER_LOCAL_PATH || inMemorySettings.localStorePath;
    console.log("[Main] Current localStorePath:", localStorePath);
    console.log("[Main] From environment:", process.env.ROMPER_LOCAL_PATH);
    console.log("[Main] From settings:", inMemorySettings.localStorePath);

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

  ipcMain.handle("select-sd-card", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select SD Card Path",
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("get-user-data-path", () => app.getPath("userData"));
  ipcMain.handle("create-kit", async (_event, kitSlot: string) => {
    if (!/^[A-Z][0-9]{1,2}$/.test(kitSlot))
      throw new Error("Invalid kit slot. Use format A0-Z99.");

    const localStorePath =
      process.env.ROMPER_LOCAL_PATH || inMemorySettings.localStorePath;
    if (!localStorePath) {
      throw new Error("No local store configured");
    }

    const dbPath = path.join(localStorePath, ".romperdb");

    // Check if kit already exists in database
    const existingKit = getKit(dbPath, kitSlot);
    if (existingKit.success && existingKit.data) {
      throw new Error("Kit already exists.");
    }

    // Create kit record in database only (no folder creation)
    const kitRecord = {
      name: kitSlot,
      alias: null,
      artist: null,
      editable: true, // User-created kits are editable by default
      locked: false,
      step_pattern: null,
    };

    const result = addKit(dbPath, kitRecord);
    if (!result.success) {
      throw new Error(`Failed to create kit: ${result.error}`);
    }
  });
  ipcMain.handle(
    "copy-kit",
    async (_event, sourceKit: string, destKit: string) => {
      if (
        !/^[A-Z][0-9]{1,2}$/.test(sourceKit) ||
        !/^[A-Z][0-9]{1,2}$/.test(destKit)
      )
        throw new Error("Invalid kit slot. Use format A0-Z99.");

      const localStorePath =
        process.env.ROMPER_LOCAL_PATH || inMemorySettings.localStorePath;
      if (!localStorePath) {
        throw new Error("No local store configured");
      }

      const dbPath = path.join(localStorePath, ".romperdb");

      // Check if source kit exists in database
      const sourceKitData = getKit(dbPath, sourceKit);
      if (!sourceKitData.success || !sourceKitData.data) {
        throw new Error("Source kit does not exist.");
      }

      // Check if destination kit already exists in database
      const existingDestKit = getKit(dbPath, destKit);
      if (existingDestKit.success && existingDestKit.data) {
        throw new Error("Destination kit already exists.");
      }

      // Copy kit metadata in database only (no folder copying)
      const destKitRecord = {
        name: destKit,
        alias: destKit,
        artist: sourceKitData.data.artist,
        editable: true, // Duplicated kits are editable by default
        locked: false,
        step_pattern: sourceKitData.data.step_pattern,
      };

      const result = addKit(dbPath, destKitRecord);
      if (!result.success) {
        throw new Error(`Failed to duplicate kit: ${result.error}`);
      }

      // TODO: Copy sample references in database as well
      // This will be handled when sample management is fully implemented
    },
  );
  ipcMain.handle("list-files-in-root", async (_event, localStorePath: string) =>
    fs.readdirSync(localStorePath),
  );
  // Secure method - get audio buffer by sample identifier
  ipcMain.handle(
    "get-sample-audio-buffer",
    async (
      _event,
      kitName: string,
      voiceNumber: number,
      slotNumber: number,
    ) => {
      const localStorePath = inMemorySettings.localStorePath;
      if (!localStorePath) {
        throw new Error("No local store path configured");
      }

      const dbDir = path.join(localStorePath, ".romperdb");

      // Get sample from database using static import
      const samplesResult = getKitSamples(dbDir, kitName);

      if (!samplesResult.success || !samplesResult.data) {
        throw new Error(`Failed to get samples for kit ${kitName}`);
      }

      // Find the specific sample
      const sample = samplesResult.data.find(
        (s) => s.voice_number === voiceNumber && s.slot_number === slotNumber,
      );

      if (!sample) {
        // Return null instead of throwing error for missing samples (empty slots)
        return null;
      }

      // Read the file using the database-stored source_path
      const data = fs.readFileSync(sample.source_path);
      return data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      );
    },
  );
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

  ipcMain.handle("select-existing-local-store", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Choose Existing Local Store",
      message: "Select a folder that contains a .romperdb directory",
    });

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, path: null, error: "Selection cancelled" };
    }

    const selectedPath = result.filePaths[0];

    // Validate that the selected path contains a .romperdb directory
    const validation = validateLocalStoreAndDb(selectedPath);

    if (validation.isValid) {
      return { success: true, path: selectedPath, error: null };
    } else {
      return {
        success: false,
        path: null,
        error:
          validation.error ||
          "Selected directory does not contain a valid Romper database",
      };
    }
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

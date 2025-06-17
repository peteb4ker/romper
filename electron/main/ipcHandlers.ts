import { app, dialog, ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as unzipper from "unzipper";

import {
  groupSamplesByVoice,
  inferVoiceTypeFromFilename,
} from "../../shared/kitUtilsShared.js";
import {
  countZipEntries,
  downloadArchive,
  extractZipEntries,
} from "./archiveUtils.js";
import {
  commitKitPlanHandler,
  rescanVoiceNames,
  validateKitPlan,
  writeKitSamples,
} from "./kitPlanOps.js";
import { readRampleLabels, writeRampleLabels } from "./rampleLabels.js";

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
    const userDataPath = app.getPath("userData");
    const settingsPath = path.join(userDataPath, "settings.json");
    inMemorySettings[key] = value;
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(inMemorySettings, null, 2),
      "utf-8",
    );
  });
  ipcMain.handle("scan-sd-card", async (event, sdCardPath) => {
    return fs
      .readdirSync(sdCardPath)
      .filter((folder) => /^[A-Z][0-9]{1,2}$/.test(folder));
  });
  ipcMain.handle("select-sd-card", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select SD Card Path",
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("watch-sd-card", (event, sdCardPath: string) => {
    const watcherId = `${sdCardPath}-${Date.now()}`;
    const watcher = fs.watch(
      sdCardPath,
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
    async (_event, sdCardPath: string, kitSlot: string) => {
      if (!/^[A-Z][0-9]{1,2}$/.test(kitSlot))
        throw new Error("Invalid kit slot. Use format A0-Z99.");
      const kitPath = path.join(sdCardPath, kitSlot);
      if (fs.existsSync(kitPath)) throw new Error("Kit already exists.");
      fs.mkdirSync(kitPath);
      let labels = readRampleLabels(sdCardPath) || { kits: {} };
      labels.kits[kitSlot] = labels.kits[kitSlot] || {
        label: kitSlot,
        plan: [],
      };
      writeRampleLabels(sdCardPath, labels);
    },
  );
  ipcMain.handle(
    "copy-kit",
    async (_event, sdCardPath: string, sourceKit: string, destKit: string) => {
      if (
        !/^[A-Z][0-9]{1,2}$/.test(sourceKit) ||
        !/^[A-Z][0-9]{1,2}$/.test(destKit)
      )
        throw new Error("Invalid kit slot. Use format A0-Z99.");
      const srcPath = path.join(sdCardPath, sourceKit);
      const destPath = path.join(sdCardPath, destKit);
      if (!fs.existsSync(srcPath))
        throw new Error("Source kit does not exist.");
      if (fs.existsSync(destPath))
        throw new Error("Destination kit already exists.");
      copyRecursiveSync(srcPath, destPath);
    },
  );
  ipcMain.handle("list-files-in-root", async (_event, sdCardPath: string) =>
    fs.readdirSync(sdCardPath),
  );
  ipcMain.handle("get-audio-buffer", async (_event, filePath: string) => {
    const data = fs.readFileSync(filePath);
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    );
  });
  ipcMain.handle("read-rample-labels", async (_event, sdCardPath: string) =>
    readRampleLabels(sdCardPath),
  );
  ipcMain.handle(
    "write-rample-labels",
    async (_event, sdCardPath: string, labels) => {
      writeRampleLabels(sdCardPath, labels);
      return true;
    },
  );
  // --- Register handler ---
  ipcMain.handle("commit-kit-plan", async (_event, sdCardPath, kitName) => {
    return commitKitPlanHandler(sdCardPath, kitName);
  });
  ipcMain.handle(
    "discard-kit-plan",
    async (_event, sdCardPath: string, kitName: string) => {
      const errors: string[] = [];
      try {
        const labels = readRampleLabels(sdCardPath);
        if (!labels || !labels.kits[kitName]) {
          errors.push("Kit not found in labels file.");
          return { success: false, errors };
        }
        if (!("plan" in labels.kits[kitName])) {
          errors.push("No plan to discard for this kit.");
          return { success: false, errors };
        }
        delete labels.kits[kitName].plan;
        try {
          writeRampleLabels(sdCardPath, labels);
        } catch (e) {
          errors.push(
            `Failed to update labels file: ${e instanceof Error ? e.message : String(e)}`,
          );
          return { success: false, errors };
        }
        return { success: true };
      } catch (e) {
        errors.push(e instanceof Error && e.message ? e.message : String(e));
        return { success: false, errors };
      }
    },
  );
  // Use kebab-case for consistency with other handlers
  ipcMain.handle(
    "rescan-all-voice-names",
    async (_event, sdCardPath: string, kitNames: string[]) => {
      const labels = readRampleLabels(sdCardPath) || { kits: {} };
      for (const kitName of kitNames) {
        const kitPath = path.join(sdCardPath, kitName);
        const wavFiles = fs.existsSync(kitPath)
          ? fs.readdirSync(kitPath).filter((f) => /\.wav$/i.test(f))
          : [];
        const voices = groupSamplesByVoice(wavFiles);
        const newVoiceNames: { [key: number]: string } = {
          1: "",
          2: "",
          3: "",
          4: "",
        };
        for (let voice = 1; voice <= 4; voice++) {
          const samplesForVoice = voices[voice] || [];
          let inferredName = "";
          for (const sample of samplesForVoice) {
            const type = inferVoiceTypeFromFilename(sample);
            if (type) {
              inferredName = type;
              break;
            }
          }
          newVoiceNames[voice] = inferredName;
        }
        if (!labels.kits[kitName]) labels.kits[kitName] = { label: kitName };
        labels.kits[kitName].voiceNames = newVoiceNames;
      }
      writeRampleLabels(sdCardPath, labels);
      return true;
    },
  );
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
      const tmpZipPath = path.join(tmp, `romper_download_${Date.now()}.zip`);
      try {
        // Download
        await downloadArchive(url, tmpZipPath, (percent: number | null) => {
          event.sender.send("archive-progress", {
            phase: "Downloading",
            percent,
          });
        });
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
        try {
          await fsPromises.unlink(tmpZipPath);
        } catch {}
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

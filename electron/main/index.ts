console.log("[Romper Electron] Main process entrypoint loaded");

import { app, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  groupSamplesByVoice,
  inferVoiceTypeFromFilename,
} from "../../shared/kitUtilsShared";
import {
  createApplicationMenu,
  registerMenuIpcHandlers,
} from "./applicationMenu.js";
import { registerDbIpcHandlers } from "./dbIpcHandlers.js";
// Import IPC handlers
import { registerIpcHandlers } from "./ipcHandlers.js";
import { validateLocalStoreAndDb } from "./localStoreValidator.js";

type Settings = {
  localStorePath?: string;
  darkMode?: boolean;
  theme?: string;
  [key: string]: unknown;
};

let inMemorySettings: Settings = {}; // Store settings in memory
let currentSamplePlayer: unknown = null; // TODO: Refine type if possible

const isDev = process.env.NODE_ENV === "development";

const preloadPath = path.resolve(__dirname, "../preload/index.mjs");
console.log(" Electron will use preload:", preloadPath);

function createWindow() {
  console.log("[Electron Main] Environment variables check:");
  console.log(
    "  ROMPER_SDCARD_PATH:",
    process.env.ROMPER_SDCARD_PATH || "(not set)",
  );
  console.log(
    "  ROMPER_LOCAL_PATH:",
    process.env.ROMPER_LOCAL_PATH || "(not set)",
  );
  console.log(
    "  ROMPER_SQUARP_ARCHIVE_URL:",
    process.env.ROMPER_SQUARP_ARCHIVE_URL || "(not set)",
  );

  if (process.env.ROMPER_LOCAL_PATH) {
    console.log(
      "[Electron Main] Environment override: Using ROMPER_LOCAL_PATH for local store",
    );
  }

  const win: BrowserWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.resolve(__dirname, "../resources/app-icon.icns"), // Set app icon for built app
    webPreferences: {
      preload: path.resolve(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // Type-safe error handling for loadURL
    win.loadURL("http://localhost:5173").catch((err: unknown) => {
      console.error(
        "Failed to load URL:",
        err instanceof Error ? err.message : String(err),
      );
    });
  } else {
    const indexPath = path.resolve(__dirname, "../../renderer/index.html");
    if (process.env.NODE_ENV !== "test") {
      console.log("[Romper Electron] Attempting to load:", indexPath);
      if (!fs.existsSync(indexPath)) {
        console.error("[Romper Electron] index.html not found at:", indexPath);
      }
    }
    win.loadFile(indexPath).catch((err: unknown) => {
      console.error(
        "Failed to load index.html:",
        err instanceof Error ? err.message : String(err),
      );
    });
  }
}

function loadSettings(): Settings {
  const userDataPath = app.getPath("userData");
  const newSettingsPath = path.join(userDataPath, "romper-settings.json");
  const oldSettingsPath = path.join(userDataPath, "settings.json");

  // Migration: rename old settings file if it exists and new one doesn't
  if (fs.existsSync(oldSettingsPath) && !fs.existsSync(newSettingsPath)) {
    try {
      fs.renameSync(oldSettingsPath, newSettingsPath);
      console.log("[Startup] Migrated settings.json to romper-settings.json");
    } catch (error) {
      console.warn("[Startup] Failed to migrate settings file:", error);
    }
  }

  const settingsPath = newSettingsPath;

  // Log settings file status only if there are issues
  if (!fs.existsSync(settingsPath)) {
    console.log("[Startup] Settings file not found:", settingsPath);
  }

  let settings: Settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const fileContent = fs.readFileSync(settingsPath, "utf-8");
      // Only log content details if file is empty or corrupted
      if (fileContent.length <= 2) {
        console.log(
          "[Startup] Settings file appears empty or corrupted:",
          fileContent,
        );
      }

      const parsed = JSON.parse(fileContent);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        settings = parsed as Settings;
        // Only log settings details if localStorePath is missing or for debugging
        if (!settings.localStorePath) {
          console.info(
            "[Startup] Settings loaded but no local store configured",
          );
        }
      } else {
        console.warn(
          "[Startup] Settings file did not contain an object. Using empty settings.",
        );
      }
    } catch (error) {
      console.error(
        "[Startup] Failed to parse settings file. Using empty settings:",
        error,
      );
    }
  }
  return settings;
}

function validateAndFixLocalStore(settings: Settings): Settings {
  const userDataPath = app.getPath("userData");
  const settingsPath = path.join(userDataPath, "romper-settings.json");

  if (settings.localStorePath) {
    const validation = validateLocalStoreAndDb(settings.localStorePath);

    if (!validation.isValid) {
      console.warn("[Startup] ✗ Saved local store path is invalid");
      console.warn("  - Path:", settings.localStorePath);
      console.warn("  - Error:", validation.error);
      console.warn("[Startup] Removing invalid path from settings...");

      delete settings.localStorePath;
      try {
        fs.writeFileSync(
          settingsPath,
          JSON.stringify(settings, null, 2),
          "utf-8",
        );
        console.log(
          "[Startup] Invalid local store path removed from settings file",
        );
      } catch (writeError) {
        console.error("[Startup] Failed to update settings file:", writeError);
      }
    }
  }

  return settings;
}

function registerAllIpcHandlers(settings: Settings) {
  registerIpcHandlers(settings);
  registerDbIpcHandlers(settings);
}

app.whenReady().then(async () => {
  console.log("[Startup] App is starting...");
  try {
    console.log("[Startup] App is ready. Configuring...");
    createWindow();
    createApplicationMenu();
    registerMenuIpcHandlers();

    // Load and validate settings
    inMemorySettings = loadSettings();
    inMemorySettings = validateAndFixLocalStore(inMemorySettings);

    // Final summary of local store configuration
    console.log("[Startup] Final local store configuration:");
    if (process.env.ROMPER_LOCAL_PATH) {
      console.log(
        "  - Using environment override:",
        process.env.ROMPER_LOCAL_PATH,
      );
    } else if (inMemorySettings.localStorePath) {
      console.log(
        "  - Using settings file path:",
        inMemorySettings.localStorePath,
      );
    } else {
      console.log("  - No local store configured - wizard will be shown");
    }

    // Register IPC handlers
    registerAllIpcHandlers(inMemorySettings);
    createApplicationMenu();
  } catch (error: unknown) {
    console.error(
      "[Startup] Error during app initialization:",
      error instanceof Error ? error.message : String(error),
    );
  }
});

// Add helper function to validate local store and DB
process.on("unhandledRejection", (reason: unknown) => {
  console.error(
    "Unhandled Promise Rejection:",
    reason instanceof Error ? reason.message : String(reason),
  );
});

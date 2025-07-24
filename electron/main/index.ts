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
  console.log("[Electron Main] Environment variables:");
  console.log("  ROMPER_SDCARD_PATH:", process.env.ROMPER_SDCARD_PATH);
  console.log("  ROMPER_LOCAL_PATH:", process.env.ROMPER_LOCAL_PATH);
  console.log(
    "  ROMPER_SQUARP_ARCHIVE_URL:",
    process.env.ROMPER_SQUARP_ARCHIVE_URL,
  );

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
    console.log("[Romper Electron] Attempting to load:", indexPath);
    if (!fs.existsSync(indexPath)) {
      console.error("[Romper Electron] index.html not found at:", indexPath);
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
  const settingsPath = path.join(userDataPath, "settings.json");
  let settings: Settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const fileContent = fs.readFileSync(settingsPath, "utf-8");
      const parsed = JSON.parse(fileContent);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        settings = parsed as Settings;
        console.info("[Startup] Settings loaded from file:", settings);
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
  } else {
    console.warn(
      "[Startup] Settings file not found. Starting with empty settings.",
    );
  }
  return settings;
}

function validateAndFixLocalStore(settings: Settings): Settings {
  const userDataPath = app.getPath("userData");
  const settingsPath = path.join(userDataPath, "settings.json");
  if (settings.localStorePath) {
    console.log(
      "[Startup] Validating saved local store path:",
      settings.localStorePath,
    );
    const validation = validateLocalStoreAndDb(settings.localStorePath);
    if (validation.isValid) {
      console.info("[Startup] Local store validated successfully:", {
        localStorePath: settings.localStorePath,
      });
    } else {
      console.warn(
        "[Startup] Saved local store path is invalid:",
        validation.error,
      );
      console.warn("[Startup] Clearing invalid local store settings");
      delete settings.localStorePath;
      try {
        fs.writeFileSync(
          settingsPath,
          JSON.stringify(settings, null, 2),
          "utf-8",
        );
        console.log(
          "[Startup] Invalid local store path removed from settings file.",
        );
      } catch (writeError) {
        console.error("[Startup] Failed to update settings file:", writeError);
      }
    }
  } else {
    console.log("[Startup] No local store path found in settings.");
  }
  return settings;
}

function registerAllIpcHandlers(settings: Settings) {
  console.log(
    "[Startup] Registering IPC handlers with settings:",
    Object.keys(settings),
  );
  registerIpcHandlers(settings);
  registerDbIpcHandlers();
  console.log("[Startup] IPC handlers registered");
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

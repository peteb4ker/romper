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
  sdCardPath?: string;
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
  const settingsPath = path.join(userDataPath, "romper-settings.json");

  console.log("[Settings] Loading settings from:", settingsPath);
  console.log("[Settings] User data path:", userDataPath);

  if (!fs.existsSync(settingsPath)) {
    console.log("[Settings] Settings file not found - will use empty settings");
    return {};
  }

  let settings: Settings = {};
  try {
    const fileContent = fs.readFileSync(settingsPath, "utf-8");

    if (fileContent.length === 0) {
      console.log("[Settings] Settings file is empty - using empty settings");
      return {};
    }

    const parsed = JSON.parse(fileContent);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      settings = parsed as Settings;
      console.log(
        "[Settings] Loaded settings:",
        JSON.stringify(settings, null, 2),
      );
    } else {
      console.warn(
        "[Settings] Settings file did not contain an object. Using empty settings.",
      );
      console.warn(
        "[Settings] Parsed type:",
        typeof parsed,
        "Is array:",
        Array.isArray(parsed),
      );
    }
  } catch (error) {
    console.error("[Settings] Failed to parse settings file:", error);
    console.error("[Settings] Using empty settings");
  }

  return settings;
}

function validateAndFixLocalStore(settings: Settings): Settings {
  const userDataPath = app.getPath("userData");
  const settingsPath = path.join(userDataPath, "romper-settings.json");

  console.log("[Validation] Starting local store validation");
  console.log(
    "[Validation] Settings have localStorePath:",
    !!settings.localStorePath,
  );

  if (settings.localStorePath) {
    console.log(
      "[Validation] Validating local store path:",
      settings.localStorePath,
    );
    const validation = validateLocalStoreAndDb(settings.localStorePath);
    console.log("[Validation] Validation result:", {
      isValid: validation.isValid,
      error: validation.error,
      errorSummary: validation.errorSummary,
    });

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
    } else {
      console.log("[Validation] ✓ Local store path is valid");
    }
  } else {
    console.log("[Validation] No local store path to validate");
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

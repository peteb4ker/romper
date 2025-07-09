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
import { createApplicationMenu, registerMenuIpcHandlers } from "./applicationMenu.js";
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
      preload: path.resolve(__dirname, "../preload/index.js"), // Always read from dist folder
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

app.whenReady().then(async () => {
  console.log("App is starting..."); // Early log to confirm execution

  try {
    console.log("App is ready. Configuring...");

    createWindow();

    // Create application menu with Tools menu
    createApplicationMenu();
    registerMenuIpcHandlers();

    // Load settings into memory
    const userDataPath = app.getPath("userData");
    const settingsPath = path.join(userDataPath, "settings.json");

    if (fs.existsSync(settingsPath)) {
      try {
        const fileContent = fs.readFileSync(settingsPath, "utf-8");
        const parsed = JSON.parse(fileContent);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          inMemorySettings = parsed as Settings;
        } else {
          inMemorySettings = {};
          console.warn(
            "Settings file did not contain an object. Using empty settings.",
          );
        }
        console.info("Settings loaded from file:", inMemorySettings);

        // Validate local store path on startup if present
        if (inMemorySettings.localStorePath) {
          console.log(
            "Validating saved local store path:",
            inMemorySettings.localStorePath,
          );
          const validation = validateLocalStoreAndDb(
            inMemorySettings.localStorePath,
          );

          if (validation.isValid) {
            console.info("Local store validated successfully:", {
              localStorePath: inMemorySettings.localStorePath,
            });
          } else {
            // Clear invalid local store path
            console.warn(
              "Saved local store path is invalid:",
              validation.error,
            );
            console.warn("Clearing invalid local store settings");
            delete inMemorySettings.localStorePath;

            // Update settings file to remove invalid paths
            try {
              fs.writeFileSync(
                settingsPath,
                JSON.stringify(inMemorySettings, null, 2),
                "utf-8",
              );
            } catch (writeError) {
              console.error("Failed to update settings file:", writeError);
            }
          }
        }
      } catch (error) {
        inMemorySettings = {};
        console.error(
          "Failed to parse settings file. Using empty settings:",
          error,
        );
      }
    } else {
      inMemorySettings = {};
      console.warn("Settings file not found. Starting with empty settings.");
    }

    // Register all IPC handlers
    console.log(
      "[Romper Electron] Registering IPC handlers with settings:",
      Object.keys(inMemorySettings),
    );
    registerIpcHandlers(inMemorySettings);
    registerDbIpcHandlers();
    console.log("[Romper Electron] IPC handlers registered");

    // Create application menu
    createApplicationMenu();
  } catch (error: unknown) {
    console.error(
      "Error during app initialization:",
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

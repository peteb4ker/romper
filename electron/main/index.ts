console.log("[Romper Electron] Main process entrypoint loaded");

import { app, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type { InMemorySettings } from "./types/settings.js";

import {
  createApplicationMenu,
  registerMenuIpcHandlers,
} from "./applicationMenu.js";
import { registerDbIpcHandlers } from "./dbIpcHandlers.js";
import { registerIpcHandlers } from "./ipcHandlers.js";
import {
  loadSettings,
  loadWindowState,
  saveWindowState,
  validateAndFixLocalStore,
} from "./mainProcessSetup.js";

let inMemorySettings: InMemorySettings = {
  localStorePath: null,
};

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

  const statePath = getWindowStatePath();
  const windowState = loadWindowState(statePath);

  const win: BrowserWindow = new BrowserWindow({
    height: windowState.height,
    icon: path.resolve(__dirname, "../resources/app-icon.icns"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.resolve(__dirname, "../preload/index.cjs"),
    },
    width: windowState.width,
    x: windowState.x,
    y: windowState.y,
  });

  if (windowState.isMaximized) {
    win.maximize();
  }

  win.on("close", () => {
    const windowStatePath = getWindowStatePath();
    if (!win.isMaximized()) {
      saveWindowState(win.getBounds(), win.isMaximized(), windowStatePath);
    } else {
      // Save maximized flag but keep previous bounds for restore
      try {
        const existing = fs.existsSync(windowStatePath)
          ? JSON.parse(fs.readFileSync(windowStatePath, "utf-8"))
          : {};
        fs.writeFileSync(
          windowStatePath,
          JSON.stringify({ ...existing, isMaximized: true }),
        );
      } catch {
        // Ignore
      }
    }
  });

  if (isDev) {
    const vitePort = process.env.VITE_DEV_SERVER_PORT || "5173";
    win.loadURL(`http://localhost:${vitePort}`).catch((err: unknown) => {
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

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "romper-settings.json");
}

function getWindowStatePath(): string {
  return path.join(app.getPath("userData"), "window-state.json");
}

function registerAllIpcHandlers(settings: InMemorySettings) {
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
    const settingsPath = getSettingsPath();
    inMemorySettings = loadSettings(settingsPath);
    inMemorySettings = validateAndFixLocalStore(
      inMemorySettings,
      settingsPath,
      process.env.ROMPER_LOCAL_PATH,
    );

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

process.on("unhandledRejection", (reason: unknown) => {
  console.error(
    "Unhandled Promise Rejection:",
    reason instanceof Error ? reason.message : String(reason),
  );
});

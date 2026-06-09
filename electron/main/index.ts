import { app, BrowserWindow, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type { InMemorySettings } from "./types/settings.js";

import {
  createApplicationMenu,
  registerMenuIpcHandlers,
} from "./applicationMenu.js";
import { initAutoUpdater } from "./autoUpdater.js";
import { registerDbIpcHandlers } from "./dbIpcHandlers.js";
import { registerIpcHandlers } from "./ipcHandlers.js";
import {
  loadSettings,
  loadWindowState,
  saveWindowState,
  validateAndFixLocalStore,
} from "./mainProcessSetup.js";
import { logger } from "./utils/logger.js";

logger.log("[Romper Electron] Main process entrypoint loaded");

let inMemorySettings: InMemorySettings = {
  localStorePath: null,
};

const isDev = process.env.NODE_ENV === "development";

const preloadPath = path.resolve(__dirname, "../preload/index.mjs");
logger.log(" Electron will use preload:", preloadPath);

function createWindow() {
  logger.log("[Electron Main] Environment variables check:");
  logger.log(
    "  ROMPER_SDCARD_PATH:",
    process.env.ROMPER_SDCARD_PATH || "(not set)",
  );
  logger.log(
    "  ROMPER_LOCAL_PATH:",
    process.env.ROMPER_LOCAL_PATH || "(not set)",
  );
  logger.log(
    "  ROMPER_SQUARP_ARCHIVE_URL:",
    process.env.ROMPER_SQUARP_ARCHIVE_URL || "(not set)",
  );

  if (process.env.ROMPER_LOCAL_PATH) {
    logger.log(
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

  hardenNavigation(win);

  if (windowState.isMaximized) {
    win.maximize();
  }

  win.on("close", () => {
    const windowStatePath = getWindowStatePath();
    if (win.isMaximized()) {
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
    } else {
      saveWindowState(win.getBounds(), win.isMaximized(), windowStatePath);
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
      logger.log("[Romper Electron] Attempting to load:", indexPath);
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

/**
 * Apply Electron navigation hardening to a window's web contents:
 * - Deny all `window.open` / target=_blank popups, sending http(s) URLs to the
 *   user's external browser instead of opening an in-app window.
 * - Block any top-level navigation that would leave the app's own origin
 *   (e.g. an injected link), routing external http(s) links to the browser.
 *
 * Same-origin SPA routing uses the history API and does not trigger
 * `will-navigate`, so this does not interfere with normal app navigation.
 */
function hardenNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, navigationUrl) => {
    if (isSameOrigin(navigationUrl, win.webContents.getURL())) {
      return;
    }
    event.preventDefault();
    if (/^https?:\/\//i.test(navigationUrl)) {
      void shell.openExternal(navigationUrl);
    }
  });
}

function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function registerAllIpcHandlers(settings: InMemorySettings) {
  registerIpcHandlers(settings);
  registerDbIpcHandlers(settings);
}

app.setName("Romper");

// NOTE: Kept as a `.then()` chain rather than top-level `await` (SonarCloud
// S7785). Converting the Electron main entry to top-level await causes
// `electron.launch` to hang in e2e (ESM-main bootstrap deadlock), so this
// pattern is intentional.
void app.whenReady().then(async () => {
  logger.log("[Startup] App is starting...");
  try {
    logger.log("[Startup] App is ready. Configuring...");
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
    logger.log("[Startup] Final local store configuration:");
    if (process.env.ROMPER_LOCAL_PATH) {
      logger.log(
        "  - Using environment override:",
        process.env.ROMPER_LOCAL_PATH,
      );
    } else if (inMemorySettings.localStorePath) {
      logger.log(
        "  - Using settings file path:",
        inMemorySettings.localStorePath,
      );
    } else {
      logger.log("  - No local store configured - wizard will be shown");
    }

    // Register IPC handlers
    registerAllIpcHandlers(inMemorySettings);
    createApplicationMenu();

    // Kick off auto-update (no-op outside packaged macOS builds). Fire-and-
    // forget so a slow/failed update check never delays the window or menu.
    void initAutoUpdater();
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

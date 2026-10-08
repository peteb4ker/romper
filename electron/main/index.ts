import { app, BrowserWindow, ipcMain, shell } from "electron";
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
import { closeAllDbConnections } from "./db/utils/dbConnections.js";
import { registerDbIpcHandlers } from "./dbIpcHandlers.js";
import { registerIpcHandlers } from "./ipcHandlers.js";
import {
  loadSettings,
  loadWindowState,
  saveWindowState,
  validateSavedLocalStore,
} from "./mainProcessSetup.js";
import {
  type AppNavigationTarget,
  isAllowedAppNavigation,
  isExternalHttpUrl,
} from "./navigationPolicy.js";
import { enforceTrustedIpcSenders } from "./security/ipcSender.js";
import { localStoreSetupService } from "./services/localStoreSetupService.js";
import { ServicePathManager } from "./utils/fileSystemUtils.js";
import { logger } from "./utils/logger.js";

logger.log("[Romper Electron] Main process entrypoint loaded");

let inMemorySettings: InMemorySettings = {
  localStorePath: null,
};

const isDev = process.env.NODE_ENV === "development";
const vitePort = process.env.VITE_DEV_SERVER_PORT || "5173";
const devServerUrl = `http://localhost:${vitePort}`;
const rendererIndexPath = path.resolve(__dirname, "../../renderer/index.html");
// The app's own page: the only place the window may navigate to (RE-02) and
// the only page IPC is accepted from (RE-03).
const appTarget: AppNavigationTarget = isDev
  ? { devServerOrigin: devServerUrl, kind: "dev" }
  : { indexPath: rendererIndexPath, kind: "file" };

// ROMPER_HEADLESS=true keeps the window hidden and the app out of the way
// (no Dock icon, no focus stealing). The e2e suite sets it so test runs
// don't take over the developer's screen; Playwright drives the hidden
// window over CDP the same way it drives a visible one.
const isHeadless = process.env.ROMPER_HEADLESS === "true";

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
    show: !isHeadless,
    webPreferences: {
      // Never let Chromium treat the hidden window as backgrounded and
      // throttle its timers or animation frames. tests/e2e/
      // headless-window.e2e.test.ts checks the page still behaves as visible.
      backgroundThrottling: !isHeadless,
      contextIsolation: true,
      nodeIntegration: false,
      // A hidden native window gets no compositor frames on Linux and
      // Windows, so requestAnimationFrame stalls after the first couple of
      // frames. Offscreen rendering drives frames without showing anything.
      offscreen: isHeadless,
      preload: path.resolve(__dirname, "../preload/index.cjs"),
      sandbox: true,
    },
    width: windowState.width,
    x: windowState.x,
    y: windowState.y,
  });

  hardenNavigation(win, appTarget);

  // A headless run (the e2e suite) shouldn't be heard either. Muting the
  // page silences output only: the audio graph and timing run as normal.
  if (isHeadless) win.webContents.setAudioMuted(true);

  // maximize() would show the window, and a hidden window's bounds shouldn't
  // overwrite the user's saved ones.
  if (windowState.isMaximized && !isHeadless) {
    win.maximize();
  }

  win.on("close", () => {
    if (isHeadless) return;
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
    win.loadURL(devServerUrl).catch((err: unknown) => {
      console.error(
        "Failed to load URL:",
        err instanceof Error ? err.message : String(err),
      );
    });
  } else {
    const indexPath = rendererIndexPath;
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
 * Apply Electron navigation hardening to a window's web contents (RE-02):
 * - Deny all `window.open` / target=_blank popups, sending http(s) URLs to the
 *   user's external browser instead of opening an in-app window.
 * - Allow a top-level navigation or redirect only when it stays on the app's
 *   own page (see `isAllowedAppNavigation`). Anything else is blocked; http(s)
 *   links go to the external browser, other schemes are dropped. This stops a
 *   dropped or linked local HTML file from loading with the preload bridge.
 * - Refuse `<webview>` attachment.
 *
 * Hash-router navigation doesn't trigger `will-navigate`, and a full reload
 * of the app's own page is still allowed.
 */
function hardenNavigation(
  win: BrowserWindow,
  appTarget: AppNavigationTarget,
): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalHttpUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, navigationUrl) => {
    if (isAllowedAppNavigation(navigationUrl, appTarget)) {
      return;
    }
    event.preventDefault();
    if (isExternalHttpUrl(navigationUrl)) {
      void shell.openExternal(navigationUrl);
    } else {
      console.warn(
        "[Security] Blocked navigation to:",
        navigationUrl.slice(0, 200),
      );
    }
  });

  win.webContents.on("will-redirect", (event, redirectUrl) => {
    if (isAllowedAppNavigation(redirectUrl, appTarget)) {
      return;
    }
    event.preventDefault();
    console.warn("[Security] Blocked redirect to:", redirectUrl.slice(0, 200));
  });

  win.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

function registerAllIpcHandlers(settings: InMemorySettings) {
  // Wrap every handler registered from here on with sender validation.
  enforceTrustedIpcSenders(ipcMain, appTarget);
  registerIpcHandlers(settings);
  registerDbIpcHandlers(settings);
}

app.setName("Romper");

// ROMPER_USER_DATA_DIR moves settings, window state and Chromium's profile
// to another folder. The e2e suite sets it so test runs never touch the
// installed app's settings, which share the "Romper" folder (RE-68). It has
// to be set before the app is ready.
const userDataOverride = process.env.ROMPER_USER_DATA_DIR;
if (userDataOverride) {
  app.setPath("userData", userDataOverride);
}

if (isHeadless && process.platform === "darwin") {
  // Accessory apps get no Dock icon and don't activate on launch, so a
  // headless run never takes keyboard focus from the user.
  app.setActivationPolicy("accessory");
}

function onAppReady(): void {
  logger.log("[Startup] App is starting...");
  try {
    logger.log("[Startup] App is ready. Configuring...");
    createWindow();
    createApplicationMenu();
    registerMenuIpcHandlers();

    // Load and validate settings
    const settingsPath = getSettingsPath();
    inMemorySettings = loadSettings(settingsPath);
    inMemorySettings = validateSavedLocalStore(
      inMemorySettings,
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
}

// NOTE: Kept as a `.then()` chain rather than top-level `await` (SonarCloud
// S7785). Converting the Electron main entry to top-level await causes
// `electron.launch` to hang in e2e (ESM-main bootstrap deadlock), so this
// pattern is intentional.
void app.whenReady().then(onAppReady); // NOSONAR - S7785, see note

// A setup that never finished (Cancel on first run quits mid-import) must not
// leave a half-built store that makes the next launch refuse the folder
// (RE-66). Synchronous, so it completes before the process exits.
app.on("will-quit", () => {
  const results = localStoreSetupService.cleanupUnfinishedSetups(
    ServicePathManager.getLocalStorePath(inMemorySettings),
  );
  for (const result of results) {
    if (result.error) {
      console.warn(
        `[Setup] Couldn't clean up the unfinished setup in ${result.targetPath}: ${result.error}`,
      );
    }
  }
  // Closing checkpoints the write-ahead log into the database file (RE-81)
  closeAllDbConnections();
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error(
    "Unhandled Promise Rejection:",
    reason instanceof Error ? reason.message : String(reason),
  );
});
// proof for #702

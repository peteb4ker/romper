import { app, BrowserWindow } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Import IPC handlers
import { registerIpcHandlers } from "./ipcHandlers.js";
import { registerDbIpcHandlers } from "./dbIpcHandlers.js";

type Settings = {
  sdCardPath?: string;
  darkMode?: boolean;
  theme?: string;
  localStorePath?: string;
  [key: string]: unknown;
};

const watchers: { [key: string]: fs.FSWatcher } = {};
let inMemorySettings: Settings = {}; // Store settings in memory
let currentSamplePlayer: unknown = null; // TODO: Refine type if possible

const isDev = process.env.NODE_ENV === "development";

function createWindow() {
  const win: BrowserWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.resolve(__dirname, "../../dist/resources/app-icon.icns"), // Set app icon for built app
    webPreferences: {
      preload: path.resolve(__dirname, "../../dist/preload/index.js"), // Always read from dist folder
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // Type-safe error handling for loadURL
    win.loadURL("http://localhost:5173").catch((err: unknown) => {
      console.error(
        "Failed to load URL:",
        err instanceof Error ? err.message : String(err)
      );
    });
  } else {
    const indexPath = path.resolve(__dirname, "../../dist/renderer/index.html");
    win.loadFile(indexPath).catch((err: unknown) => {
      console.error(
        "Failed to load index.html:",
        err instanceof Error ? err.message : String(err)
      );
    });
  }
}

app.whenReady().then(async () => {
  console.log("App is starting..."); // Early log to confirm execution

  try {
    console.log("App is ready. Configuring...");

    createWindow();

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
          console.warn("Settings file did not contain an object. Using empty settings.");
        }
        console.info("Settings loaded from file:", inMemorySettings);
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
      "[Romper Electron] Registering IPC handlers with:",
      Object.keys(watchers),
      Object.keys(inMemorySettings),
    );
    registerIpcHandlers(watchers, inMemorySettings);
    registerDbIpcHandlers();
    console.log("[Romper Electron] IPC handlers registered");
  } catch (error: unknown) {
    console.error(
      "Error during app initialization:",
      error instanceof Error ? error.message : String(error)
    );
  }
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error(
    "Unhandled Promise Rejection:",
    reason instanceof Error ? reason.message : String(reason)
  );
});

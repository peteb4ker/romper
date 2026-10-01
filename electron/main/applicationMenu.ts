import { app, BrowserWindow, Menu, shell } from "electron";

import { menuIcons } from "./menuIcons";
import { logger } from "./utils/logger.js";

const isDev = !app.isPackaged;
// Power-user escape hatch for inspecting a packaged build. Set
// ROMPER_ENABLE_DEVTOOLS=1 in the launch env to expose View → Reload /
// Force Reload / Toggle DevTools in production. See issue #262.
const allowDevTools = isDev || process.env.ROMPER_ENABLE_DEVTOOLS === "1";

/**
 * Creates and sets the application menu with streamlined structure
 */
export function createApplicationMenu() {
  // Brand the native About panel in case any other code path triggers it
  // directly; the menu entry below routes to the custom AboutDialog instead.
  if (process.platform === "darwin") {
    app.setAboutPanelOptions({
      applicationName: app.getName(),
      applicationVersion: app.getVersion(),
    });
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    // Application menu (macOS only)
    ...(process.platform === "darwin"
      ? [
          {
            label: app.getName(),
            submenu: [
              {
                click: () => {
                  const focusedWindow = BrowserWindow.getFocusedWindow();
                  if (focusedWindow) {
                    focusedWindow.webContents.send("menu-about");
                  }
                },
                label: `About ${app.getName()}`,
              },
              { type: "separator" as const },
              {
                accelerator: "Cmd+,",
                click: () => {
                  const focusedWindow = BrowserWindow.getFocusedWindow();
                  if (focusedWindow) {
                    focusedWindow.webContents.send("menu-preferences");
                  }
                },
                icon: menuIcons.preferences,
                label: "Preferences...",
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: "File",
      submenu: [
        {
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send("menu-scan-all-kits");
            }
          },
          icon: menuIcons.scanAll,
          label: "Scan All",
        },
        { type: "separator" as const },
        {
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send(
                "menu-change-local-store-directory",
              );
            }
          },
          icon: menuIcons.changeLocalStore,
          label: "Change Local Store...",
        },
        ...(process.platform === "darwin"
          ? []
          : [
              { type: "separator" as const },
              {
                accelerator: "Ctrl+,",
                click: () => {
                  const focusedWindow = BrowserWindow.getFocusedWindow();
                  if (focusedWindow) {
                    focusedWindow.webContents.send("menu-preferences");
                  }
                },
                icon: menuIcons.preferences,
                label: "Preferences...",
              },
              { type: "separator" as const },
              { role: "quit" as const },
            ]),
      ],
    },

    // Edit menu
    {
      label: "Edit",
      submenu: [
        // Not the native undo/redo roles: those only reach text fields, so
        // the renderer decides between a text field's undo and Romper's
        // (RE-65)
        {
          accelerator: "CmdOrCtrl+Z",
          click: (_item, window) => sendToWindow(window, "menu-undo"),
          id: "undo",
          label: "Undo",
        },
        {
          accelerator: "Shift+CmdOrCtrl+Z",
          click: (_item, window) => sendToWindow(window, "menu-redo"),
          id: "redo",
          label: "Redo",
        },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "selectAll" as const },
      ],
    },

    // View menu
    {
      label: "View",
      submenu: [
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
        ...(allowDevTools
          ? [
              { type: "separator" as const },
              { role: "reload" as const },
              { role: "forceReload" as const },
              { role: "toggleDevTools" as const },
            ]
          : []),
      ],
    },

    // Window menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" as const },
        { role: "close" as const },
        ...(process.platform === "darwin"
          ? [
              { type: "separator" as const },
              { role: "front" as const },
              { type: "separator" as const },
              { role: "window" as const },
            ]
          : []),
      ],
    },

    // Help menu
    {
      label: "Help",
      submenu: [
        {
          click: () => {
            void shell.openExternal(
              "https://peteb4ker.github.io/romper/manual/",
            );
          },
          icon: menuIcons.romperManual,
          label: "Romper Manual",
        },
        {
          click: () => {
            void shell.openExternal("https://squarp.net/rample/manual/");
          },
          icon: menuIcons.rampleManual,
          label: "Rample Manual",
        },
        ...(process.platform === "darwin"
          ? []
          : [
              { type: "separator" as const },
              {
                click: () => {
                  const focusedWindow = BrowserWindow.getFocusedWindow();
                  if (focusedWindow) {
                    focusedWindow.webContents.send("menu-about");
                  }
                },
                label: "About Romper",
              },
            ]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Registers IPC handlers for menu actions that need to communicate with the main process
 */
export function registerMenuIpcHandlers() {
  // Menu actions are handled via webContents.send() to the renderer process
  // No additional IPC handlers needed for basic menu functionality
  logger.log("[Menu] Menu IPC handlers registered");
}

/**
 * Sends a menu event to the window the menu acted on, or the focused one
 * when the click came without a window
 */
function sendToWindow(
  window: Electron.BaseWindow | undefined,
  channel: string,
) {
  const target =
    window instanceof BrowserWindow ? window : BrowserWindow.getFocusedWindow();
  target?.webContents.send(channel);
}

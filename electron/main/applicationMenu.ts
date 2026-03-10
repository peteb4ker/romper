import { app, BrowserWindow, Menu, shell } from "electron";

const isDev = !app.isPackaged;

/**
 * Creates and sets the application menu with streamlined structure
 */
export function createApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    // Application menu (macOS only)
    ...(process.platform === "darwin"
      ? [
          {
            label: app.getName(),
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                accelerator: "Cmd+,",
                click: () => {
                  const focusedWindow = BrowserWindow.getFocusedWindow();
                  if (focusedWindow) {
                    focusedWindow.webContents.send("menu-preferences");
                  }
                },
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
          label: "Scan All Kits",
        },
        {
          accelerator: "CmdOrCtrl+Shift+B",
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send("menu-scan-banks");
            }
          },
          label: "Scan Banks",
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
          label: "Change Local Store...",
        },
        ...(process.platform !== "darwin"
          ? [
              { type: "separator" as const },
              {
                accelerator: "Ctrl+,",
                click: () => {
                  const focusedWindow = BrowserWindow.getFocusedWindow();
                  if (focusedWindow) {
                    focusedWindow.webContents.send("menu-preferences");
                  }
                },
                label: "Preferences...",
              },
              { type: "separator" as const },
              { role: "quit" as const },
            ]
          : []),
      ],
    },

    // Edit menu
    {
      label: "Edit",
      submenu: [
        {
          accelerator: "CmdOrCtrl+Z",
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send("menu-undo");
            }
          },
          label: "Undo",
        },
        {
          accelerator: "CmdOrCtrl+Shift+Z",
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send("menu-redo");
            }
          },
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
        ...(isDev
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
            shell.openExternal("https://peteb4ker.github.io/romper/manual/");
          },
          label: "Romper Manual",
        },
        {
          click: () => {
            shell.openExternal("https://squarp.net/rample/manual/");
          },
          label: "Rample Manual",
        },
        ...(process.platform !== "darwin"
          ? [
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
            ]
          : []),
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
  console.log("[Menu] Menu IPC handlers registered");
}

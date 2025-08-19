import { app, BrowserWindow, Menu } from "electron";

/**
 * Creates and sets the application menu with Tools menu containing scanning and maintenance operations
 */
export function createApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    // Application menu (macOS) or File menu (Windows/Linux)
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
        ...(process.platform !== "darwin" ? [{ role: "quit" as const }] : []),
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
            ]
          : []),
      ],
    },

    // Tools menu - This is where we put administrative actions
    {
      label: "Tools",
      submenu: [
        {
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => {
            // Send IPC message to renderer to trigger scan all kits
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
            // Send IPC message to renderer to trigger bank scanning
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send("menu-scan-banks");
            }
          },
          label: "Scan Banks",
        },
        {
          accelerator: "CmdOrCtrl+Shift+V",
          click: () => {
            // Send IPC message to renderer to trigger validation
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send("menu-validate-database");
            }
          },
          label: "Validate Database",
        },
        { type: "separator" },
        {
          click: () => {
            // Send IPC message to renderer to open local store wizard
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send("menu-setup-local-store");
            }
          },
          label: "Setup Local Store...",
        },
        {
          click: () => {
            // Send IPC message to renderer to open change directory dialog
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send(
                "menu-change-local-store-directory",
              );
            }
          },
          label: "Change Local Store Directory...",
        },
      ],
    },

    // View menu
    {
      label: "View",
      submenu: [
        { role: "reload" as const },
        { role: "forceReload" as const },
        { role: "toggleDevTools" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
        { type: "separator" as const },
        { role: "togglefullscreen" as const },
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
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.send("menu-about");
            }
          },
          label: "About Romper",
        },
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

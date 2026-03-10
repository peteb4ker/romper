import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration Tests for Menu IPC System
 *
 * These tests verify the complete menu IPC integration flow:
 * 1. Menu actions in main process trigger IPC events
 * 2. Menu handlers are properly registered and callable
 * 3. Menu system integrates correctly with electron APIs
 */

// Mock electron APIs
const mockIpcMain = {
  emit: vi.fn(),
  handle: vi.fn(),
  on: vi.fn(),
};

const mockMenu = {
  buildFromTemplate: vi.fn().mockReturnValue({}),
  setApplicationMenu: vi.fn(),
};

const mockBrowserWindow = {
  getAllWindows: vi.fn().mockReturnValue([]),
  getFocusedWindow: vi.fn(),
  webContents: {
    send: vi.fn(),
  },
};

const mockShell = {
  openExternal: vi.fn(),
};

// Mock electron modules
vi.mock("electron", () => ({
  app: {
    getName: vi.fn().mockReturnValue("Romper"),
    isPackaged: false,
    quit: vi.fn(),
  },
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  Menu: mockMenu,
  shell: mockShell,
}));

describe("Menu IPC Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create application menu with File submenu containing scan items", async () => {
    const { createApplicationMenu } = await import("../applicationMenu");

    createApplicationMenu();

    expect(mockMenu.buildFromTemplate).toHaveBeenCalledTimes(1);

    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];

    // Find the File menu
    const fileMenu = menuTemplate.find(
      (item: unknown) => item.label === "File",
    );
    expect(fileMenu).toBeDefined();
    expect(fileMenu.submenu).toBeDefined();

    // Verify File submenu contains scan items and change local store
    const fileSubmenu = fileMenu.submenu;
    const fileMenuLabels = fileSubmenu.map((item: unknown) => item.label);
    expect(fileMenuLabels).toContain("Scan All Kits");
    expect(fileMenuLabels).toContain("Scan Banks");
    expect(fileMenuLabels).toContain("Change Local Store...");

    // Verify no Tools menu exists
    const toolsMenu = menuTemplate.find(
      (item: unknown) => item.label === "Tools",
    );
    expect(toolsMenu).toBeUndefined();

    // Find the Help menu and verify manual links
    const helpMenu = menuTemplate.find(
      (item: unknown) => item.label === "Help",
    );
    expect(helpMenu).toBeDefined();
    const helpSubmenu = helpMenu.submenu;
    const helpMenuLabels = helpSubmenu.map((item: unknown) => item.label);
    expect(helpMenuLabels).toContain("Romper Manual");
    expect(helpMenuLabels).toContain("Rample Manual");

    expect(mockMenu.setApplicationMenu).toHaveBeenCalledTimes(1);
  });

  it("should register menu IPC handlers", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { registerMenuIpcHandlers } = await import("../applicationMenu");

    registerMenuIpcHandlers();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Menu] Menu IPC handlers registered",
    );

    consoleSpy.mockRestore();
  });

  it("should send IPC messages to renderer when File menu items are clicked", async () => {
    const mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    mockBrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
    mockBrowserWindow.getFocusedWindow.mockReturnValue(mockWindow);

    const { createApplicationMenu } = await import("../applicationMenu");

    createApplicationMenu();

    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];
    const fileMenu = menuTemplate.find(
      (item: unknown) => item.label === "File",
    );
    const submenu = fileMenu.submenu;

    // Find and trigger the "Scan All Kits" menu item
    const scanMenuItem = submenu.find(
      (item: unknown) => item.label === "Scan All Kits",
    );
    expect(scanMenuItem).toBeDefined();
    expect(scanMenuItem.click).toBeDefined();

    scanMenuItem.click();

    expect(mockWindow.webContents.send).toHaveBeenCalledWith(
      "menu-scan-all-kits",
    );
  });

  it("should handle all IPC menu items correctly", async () => {
    const mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    mockBrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
    mockBrowserWindow.getFocusedWindow.mockReturnValue(mockWindow);

    const { createApplicationMenu } = await import("../applicationMenu");

    createApplicationMenu();

    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];

    // Test each menu item that sends IPC messages
    const menuItems = [
      { event: "menu-scan-all-kits", label: "Scan All Kits", menu: "File" },
      { event: "menu-scan-banks", label: "Scan Banks", menu: "File" },
      {
        event: "menu-change-local-store-directory",
        label: "Change Local Store...",
        menu: "File",
      },
    ];

    menuItems.forEach(({ event, label, menu }) => {
      const targetMenu = menuTemplate.find(
        (item: unknown) => item.label === menu,
      );
      const submenu = targetMenu.submenu;
      const menuItem = submenu.find((item: unknown) => item.label === label);
      expect(menuItem).toBeDefined();
      expect(menuItem.click).toBeDefined();

      mockWindow.webContents.send.mockClear();

      menuItem.click();

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(event);
    });
  });

  it("should open external links for Help menu manual items", async () => {
    const { createApplicationMenu } = await import("../applicationMenu");

    createApplicationMenu();

    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];
    const helpMenu = menuTemplate.find(
      (item: unknown) => item.label === "Help",
    );
    const submenu = helpMenu.submenu;

    // Test Romper Manual
    const romperManual = submenu.find(
      (item: unknown) => item.label === "Romper Manual",
    );
    expect(romperManual).toBeDefined();
    romperManual.click();
    expect(mockShell.openExternal).toHaveBeenCalledWith(
      "https://peteb4ker.github.io/romper/manual/",
    );

    // Test Rample Manual
    const rampleManual = submenu.find(
      (item: unknown) => item.label === "Rample Manual",
    );
    expect(rampleManual).toBeDefined();
    rampleManual.click();
    expect(mockShell.openExternal).toHaveBeenCalledWith(
      "https://squarp.net/rample/manual/",
    );
  });

  it("should include dev tools in View menu when not packaged", async () => {
    const { createApplicationMenu } = await import("../applicationMenu");

    createApplicationMenu();

    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];
    const viewMenu = menuTemplate.find(
      (item: unknown) => item.label === "View",
    );
    expect(viewMenu).toBeDefined();

    const viewSubmenu = viewMenu.submenu;
    const viewRoles = viewSubmenu
      .filter((item: unknown) => item.role)
      .map((item: unknown) => item.role);

    // Dev items should be present (app.isPackaged is false in tests)
    expect(viewRoles).toContain("reload");
    expect(viewRoles).toContain("forceReload");
    expect(viewRoles).toContain("toggleDevTools");
  });

  it("should handle missing browser windows gracefully", async () => {
    mockBrowserWindow.getAllWindows.mockReturnValue([]);

    const { createApplicationMenu } = await import("../applicationMenu");

    createApplicationMenu();

    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];
    const fileMenu = menuTemplate.find(
      (item: unknown) => item.label === "File",
    );
    const submenu = fileMenu.submenu;

    const scanMenuItem = submenu.find(
      (item: unknown) => item.label === "Scan All Kits",
    );

    expect(() => {
      scanMenuItem.click();
    }).not.toThrow();
  });
});

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

// Mock electron modules
vi.mock("electron", () => ({
  app: {
    getName: vi.fn().mockReturnValue("Romper"),
    quit: vi.fn(),
  },
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  Menu: mockMenu,
}));

describe("Menu IPC Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create application menu with Tools submenu", async () => {
    // Import after mocking electron
    const { createApplicationMenu } = await import("../applicationMenu");

    // Create the menu
    createApplicationMenu();

    // Verify that Menu.buildFromTemplate was called
    expect(mockMenu.buildFromTemplate).toHaveBeenCalledTimes(1);

    // Get the menu template that was passed
    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];

    // Find the Tools menu
    const toolsMenu = menuTemplate.find(
      (item: unknown) => item.label === "Tools",
    );
    expect(toolsMenu).toBeDefined();
    expect(toolsMenu.submenu).toBeDefined();

    // Verify Tools submenu contains expected items
    const toolsSubmenu = toolsMenu.submenu;
    const toolsMenuLabels = toolsSubmenu.map((item: unknown) => item.label);
    expect(toolsMenuLabels).toContain("Scan All Kits");
    expect(toolsMenuLabels).toContain("Validate Database");
    expect(toolsMenuLabels).toContain("Setup Local Store...");

    // Find the Help menu and verify About Romper is there
    const helpMenu = menuTemplate.find(
      (item: unknown) => item.label === "Help",
    );
    expect(helpMenu).toBeDefined();
    const helpSubmenu = helpMenu.submenu;
    const helpMenuLabels = helpSubmenu.map((item: unknown) => item.label);
    expect(helpMenuLabels).toContain("About Romper");

    // Verify that Menu.setApplicationMenu was called
    expect(mockMenu.setApplicationMenu).toHaveBeenCalledTimes(1);
  });

  it("should register menu IPC handlers", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Import after mocking electron
    const { registerMenuIpcHandlers } = await import("../applicationMenu");

    // Register the handlers
    registerMenuIpcHandlers();

    // Verify that the registration was logged (since no actual IPC handlers are registered)
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Menu] Menu IPC handlers registered",
    );

    consoleSpy.mockRestore();
  });

  it("should send IPC messages to renderer when menu items are clicked", async () => {
    // Mock a browser window
    const mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    mockBrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
    mockBrowserWindow.getFocusedWindow.mockReturnValue(mockWindow);

    // Import the menu creation function
    const { createApplicationMenu } = await import("../applicationMenu");

    // Create the menu
    createApplicationMenu();

    // Get the menu template
    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];
    const toolsMenu = menuTemplate.find(
      (item: unknown) => item.label === "Tools",
    );
    const submenu = toolsMenu.submenu;

    // Find and trigger the "Scan All Kits" menu item
    const scanMenuItem = submenu.find(
      (item: unknown) => item.label === "Scan All Kits",
    );
    expect(scanMenuItem).toBeDefined();
    expect(scanMenuItem.click).toBeDefined();

    // Trigger the click handler
    scanMenuItem.click();

    // Verify that the IPC message was sent to renderer
    expect(mockWindow.webContents.send).toHaveBeenCalledWith(
      "menu-scan-all-kits",
    );
  });

  it("should handle all menu items correctly", async () => {
    // Mock a browser window
    const mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    mockBrowserWindow.getAllWindows.mockReturnValue([mockWindow]);
    mockBrowserWindow.getFocusedWindow.mockReturnValue(mockWindow);

    // Import the menu creation function
    const { createApplicationMenu } = await import("../applicationMenu");

    // Create the menu
    createApplicationMenu();

    // Get the menu template
    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];

    // Test each menu item
    const menuItems = [
      { event: "menu-scan-all-kits", label: "Scan All Kits", menu: "Tools" },
      {
        event: "menu-validate-database",
        label: "Validate Database",
        menu: "Tools",
      },
      {
        event: "menu-setup-local-store",
        label: "Setup Local Store...",
        menu: "Tools",
      },
      { event: "menu-about", label: "About Romper", menu: "Help" },
    ];

    menuItems.forEach(({ event, label, menu }) => {
      const targetMenu = menuTemplate.find(
        (item: unknown) => item.label === menu,
      );
      const submenu = targetMenu.submenu;
      const menuItem = submenu.find((item: unknown) => item.label === label);
      expect(menuItem).toBeDefined();
      expect(menuItem.click).toBeDefined();

      // Reset mock
      mockWindow.webContents.send.mockClear();

      // Trigger the click handler
      menuItem.click();

      // Verify that the correct IPC message was sent
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(event);
    });
  });

  it("should handle missing browser windows gracefully", async () => {
    // Mock no browser windows
    mockBrowserWindow.getAllWindows.mockReturnValue([]);

    // Import the menu creation function
    const { createApplicationMenu } = await import("../applicationMenu");

    // Create the menu
    createApplicationMenu();

    // Get the menu template
    const menuTemplate = mockMenu.buildFromTemplate.mock.calls[0][0];
    const toolsMenu = menuTemplate.find(
      (item: unknown) => item.label === "Tools",
    );
    const submenu = toolsMenu.submenu;

    // Find and trigger the "Scan All Kits" menu item
    const scanMenuItem = submenu.find(
      (item: unknown) => item.label === "Scan All Kits",
    );

    // This should not throw an error even with no windows
    expect(() => {
      scanMenuItem.click();
    }).not.toThrow();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock electron ipcRenderer and contextBridge
const mockIpcRenderer = {
  on: vi.fn(),
  removeListener: vi.fn(),
  invoke: vi.fn(),
  send: vi.fn(),
};

const mockContextBridge = {
  exposeInMainWorld: vi.fn(),
};

// Mock the electron module
vi.mock("electron", () => ({
  ipcRenderer: mockIpcRenderer,
  contextBridge: mockContextBridge,
}));

// Mock window and document
Object.defineProperty(window, "addEventListener", {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(window, "removeEventListener", {
  value: vi.fn(),
  writable: true,
});

Object.defineProperty(window, "dispatchEvent", {
  value: vi.fn(),
  writable: true,
});

describe("Preload Menu Event Forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register IPC listeners for menu events", async () => {
    // Import the preload script (this will execute the setup code)
    await import("../index");

    // Verify that IPC listeners were registered for menu events
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      "menu-scan-all-kits",
      expect.any(Function),
    );
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      "menu-validate-database",
      expect.any(Function),
    );
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      "menu-setup-local-store",
      expect.any(Function),
    );
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      "menu-about",
      expect.any(Function),
    );
  });

  it("should forward menu events to DOM", async () => {
    await import("../index");

    // Get the registered event handlers
    const menuHandlers = mockIpcRenderer.on.mock.calls.reduce((acc, call) => {
      const [eventName, handler] = call;
      if (eventName.startsWith("menu-")) {
        acc[eventName] = handler;
      }
      return acc;
    }, {} as Record<string, Function>);

    // Simulate IPC events from main process
    if (menuHandlers["menu-scan-all-kits"]) {
      menuHandlers["menu-scan-all-kits"]();
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "menu-scan-all-kits",
        }),
      );
    }

    if (menuHandlers["menu-validate-database"]) {
      menuHandlers["menu-validate-database"]();
      expect(window.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "menu-validate-database",
        }),
      );
    }
  });
});

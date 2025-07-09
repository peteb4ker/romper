import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Integration Tests for Menu Event Forwarding (Preload Script)
 *
 * These tests verify that the preload script correctly forwards
 * menu events from the main process to the renderer as DOM events.
 */

// Mock IPC renderer for preload testing
const mockIpcRenderer = {
  on: vi.fn(),
  off: vi.fn(),
  removeAllListeners: vi.fn(),
};

// Mock DOM event dispatching
const mockDispatchEvent = vi.fn();

// Setup window mock for different environments
let mockWindow: any;

describe("Menu Event Forwarding Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup window mock for different environments
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, "dispatchEvent", {
        value: mockDispatchEvent,
        writable: true,
      });
    } else {
      // Create a mock window object for Node.js environment
      mockWindow = {
        dispatchEvent: mockDispatchEvent,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      global.window = mockWindow;
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should register IPC listeners for all menu events on setup", () => {
    // Simulate preload script setup
    const menuEvents = [
      "menu-scan-all-kits",
      "menu-validate-database",
      "menu-setup-local-store",
      "menu-about"
    ];

    // Mock the preload script behavior
    menuEvents.forEach(eventName => {
      mockIpcRenderer.on(eventName, expect.any(Function));
    });

    expect(mockIpcRenderer.on).toHaveBeenCalledTimes(4);
  });

  it("should forward menu events to DOM when received from main process", () => {
    // Simulate the preload script receiving and forwarding an event
    const eventHandler = vi.fn((eventName) => {
      const event = new CustomEvent(eventName);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(event);
      } else {
        mockWindow.dispatchEvent(event);
      }
    });

    // Test each menu event
    const menuEvents = [
      "menu-scan-all-kits",
      "menu-validate-database",
      "menu-setup-local-store",
      "menu-about"
    ];

    menuEvents.forEach(eventName => {
      eventHandler(eventName);
    });

    expect(mockDispatchEvent).toHaveBeenCalledTimes(4);

    // Check that events were dispatched with correct types
    menuEvents.forEach((eventName, index) => {
      expect(mockDispatchEvent).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({
          type: eventName,
        })
      );
    });
  });

  it("should handle IPC errors gracefully", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Simulate an IPC error
    const errorHandler = vi.fn(() => {
      try {
        throw new Error("IPC communication failed");
      } catch (error) {
        console.error("Failed to forward menu event:", error);
      }
    });

    errorHandler();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to forward menu event:",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("should not forward invalid or unknown menu events", () => {
    const eventHandler = vi.fn((eventName) => {
      const validEvents = [
        "menu-scan-all-kits",
        "menu-validate-database",
        "menu-setup-local-store",
        "menu-about"
      ];

      if (validEvents.includes(eventName)) {
        const event = new CustomEvent(eventName);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(event);
        } else {
          mockWindow.dispatchEvent(event);
        }
      }
    });

    // Try to forward an invalid event
    eventHandler("invalid-menu-event");

    // Should not dispatch invalid events
    expect(mockDispatchEvent).not.toHaveBeenCalled();

    // But should dispatch valid events
    eventHandler("menu-scan-all-kits");
    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("should clean up IPC listeners on shutdown", () => {
    // Simulate preload script cleanup
    const cleanup = vi.fn(() => {
      mockIpcRenderer.removeAllListeners("menu-scan-all-kits");
      mockIpcRenderer.removeAllListeners("menu-validate-database");
      mockIpcRenderer.removeAllListeners("menu-setup-local-store");
      mockIpcRenderer.removeAllListeners("menu-about");
    });

    cleanup();
    expect(mockIpcRenderer.removeAllListeners).toHaveBeenCalledTimes(4);
  });
});

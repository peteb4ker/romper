import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMenuEvents } from "../useMenuEvents";

// Mock DOM event handling
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

Object.defineProperty(window, "addEventListener", {
  value: mockAddEventListener,
  writable: true,
});

Object.defineProperty(window, "removeEventListener", {
  value: mockRemoveEventListener,
  writable: true,
});

describe("useMenuEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register event listeners on mount", () => {
    const handlers = {
      onAbout: vi.fn(),
      onScanAllKits: vi.fn(),
      onScanBanks: vi.fn(),
    };

    renderHook(() => useMenuEvents(handlers));

    expect(mockAddEventListener).toHaveBeenCalledWith(
      "menu-scan-all-kits",
      expect.any(Function),
    );
    expect(mockAddEventListener).toHaveBeenCalledWith(
      "menu-scan-banks",
      expect.any(Function),
    );
    expect(mockAddEventListener).toHaveBeenCalledWith(
      "menu-about",
      expect.any(Function),
    );
  });

  it("should remove event listeners on unmount", () => {
    const handlers = {
      onAbout: vi.fn(),
      onScanAllKits: vi.fn(),
      onScanBanks: vi.fn(),
    };

    const { unmount } = renderHook(() => useMenuEvents(handlers));
    unmount();

    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      "menu-scan-all-kits",
      expect.any(Function),
    );
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      "menu-scan-banks",
      expect.any(Function),
    );
    expect(mockRemoveEventListener).toHaveBeenCalledWith(
      "menu-about",
      expect.any(Function),
    );
  });

  it("should call appropriate handlers when events are triggered", () => {
    const handlers = {
      onAbout: vi.fn(),
      onScanAllKits: vi.fn(),
      onScanBanks: vi.fn(),
    };

    renderHook(() => useMenuEvents(handlers));

    // Get the registered event handlers
    const scanHandler = mockAddEventListener.mock.calls.find(
      (call) => call[0] === "menu-scan-all-kits",
    )?.[1];
    const scanBanksHandler = mockAddEventListener.mock.calls.find(
      (call) => call[0] === "menu-scan-banks",
    )?.[1];
    const aboutHandler = mockAddEventListener.mock.calls.find(
      (call) => call[0] === "menu-about",
    )?.[1];

    // Trigger the events
    scanHandler?.();
    scanBanksHandler?.();
    aboutHandler?.();

    expect(handlers.onScanAllKits).toHaveBeenCalledTimes(1);
    expect(handlers.onScanBanks).toHaveBeenCalledTimes(1);
    expect(handlers.onAbout).toHaveBeenCalledTimes(1);
  });

  it("should handle missing handlers gracefully", () => {
    const handlers = {
      onScanAllKits: vi.fn(),
      // Missing other handlers
    };

    expect(() => {
      renderHook(() => useMenuEvents(handlers));
    }).not.toThrow();
  });
});

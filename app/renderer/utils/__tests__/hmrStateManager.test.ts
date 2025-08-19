import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as hmrStateManager from "../hmrStateManager";
import {
  clearExplicitNavigation,
  clearHmrState,
  clearSavedSelectedKit,
  getSavedSelectedKit,
  isHmrAvailable,
  kitExists,
  markExplicitNavigation,
  restoreRouteState,
  restoreSelectedKitIfExists,
  saveRouteState,
  saveSelectedKitState,
  setupRouteHmrHandlers,
  wasRecentExplicitNavigation,
} from "../hmrStateManager";

describe("hmrStateManager", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe("saveRouteState", () => {
    it("should save current hash to session storage", () => {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: { hash: "#/kits" },
      });

      saveRouteState();

      expect(sessionStorage.getItem("hmr_route")).toBe("#/kits");
    });
  });

  describe("restoreRouteState", () => {
    it("should restore saved route when different from current", () => {
      const mockLocation = { hash: "#/" };
      Object.defineProperty(window, "location", {
        configurable: true,
        value: mockLocation,
        writable: true,
      });

      sessionStorage.setItem("hmr_route", "#/kits");

      restoreRouteState();

      expect(mockLocation.hash).toBe("#/kits");
    });

    it("should not change route when saved matches current", () => {
      const mockLocation = { hash: "#/kits" };
      Object.defineProperty(window, "location", {
        configurable: true,
        value: mockLocation,
        writable: true,
      });

      sessionStorage.setItem("hmr_route", "#/kits");

      restoreRouteState();

      expect(mockLocation.hash).toBe("#/kits");
    });

    it("should not change route when no saved route exists", () => {
      const mockLocation = { hash: "#/kits" };
      Object.defineProperty(window, "location", {
        configurable: true,
        value: mockLocation,
        writable: true,
      });

      restoreRouteState();

      expect(mockLocation.hash).toBe("#/kits");
    });
  });

  describe("saveSelectedKitState", () => {
    it("should save kit name to session storage", () => {
      saveSelectedKitState("MyKit");

      expect(sessionStorage.getItem("hmr_selected_kit")).toBe("MyKit");
    });
  });

  describe("clearSavedSelectedKit", () => {
    it("should remove saved kit from session storage", () => {
      // First save a kit
      saveSelectedKitState("MyKit");
      expect(sessionStorage.getItem("hmr_selected_kit")).toBe("MyKit");

      // Then clear it
      clearSavedSelectedKit();
      expect(sessionStorage.getItem("hmr_selected_kit")).toBeNull();
    });
  });

  describe("explicit navigation tracking", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("markExplicitNavigation", () => {
      it("should mark explicit navigation with current timestamp", () => {
        const now = Date.now();
        vi.setSystemTime(now);

        markExplicitNavigation();

        expect(sessionStorage.getItem("hmr_explicit_navigation")).toBe(
          now.toString(),
        );
      });
    });

    describe("wasRecentExplicitNavigation", () => {
      it("should return false when no explicit navigation recorded", () => {
        expect(wasRecentExplicitNavigation()).toBe(false);
      });

      it("should return true when explicit navigation was recent", () => {
        const now = Date.now();
        vi.setSystemTime(now);
        markExplicitNavigation();

        // Move forward 500ms (within 1000ms window)
        vi.setSystemTime(now + 500);
        expect(wasRecentExplicitNavigation()).toBe(true);
      });

      it("should return false when explicit navigation was too long ago", () => {
        const now = Date.now();
        vi.setSystemTime(now);
        markExplicitNavigation();

        // Move forward 1500ms (outside 1000ms window)
        vi.setSystemTime(now + 1500);
        expect(wasRecentExplicitNavigation()).toBe(false);
      });
    });

    describe("clearExplicitNavigation", () => {
      it("should remove explicit navigation marker", () => {
        markExplicitNavigation();
        expect(sessionStorage.getItem("hmr_explicit_navigation")).toBeTruthy();

        clearExplicitNavigation();
        expect(sessionStorage.getItem("hmr_explicit_navigation")).toBeNull();
      });
    });
  });

  describe("getSavedSelectedKit", () => {
    it("should return saved kit name", () => {
      sessionStorage.setItem("hmr_selected_kit", "SavedKit");

      const result = getSavedSelectedKit();

      expect(result).toBe("SavedKit");
    });

    it("should return null when no saved kit", () => {
      const result = getSavedSelectedKit();

      expect(result).toBeNull();
    });
  });

  describe("clearHmrState", () => {
    it("should remove all HMR keys from session storage", () => {
      sessionStorage.setItem("hmr_route", "#/kits");
      sessionStorage.setItem("hmr_selected_kit", "MyKit");
      sessionStorage.setItem("hmr_explicit_navigation", "123456");
      sessionStorage.setItem("other_key", "value");

      clearHmrState();

      expect(sessionStorage.getItem("hmr_route")).toBeNull();
      expect(sessionStorage.getItem("hmr_selected_kit")).toBeNull();
      expect(sessionStorage.getItem("hmr_explicit_navigation")).toBeNull();
      expect(sessionStorage.getItem("other_key")).toBe("value");
    });
  });

  describe("setupRouteHmrHandlers", () => {
    it("should not throw when hot module is not available", () => {
      const originalHot = import.meta.hot;
      Object.defineProperty(import.meta, "hot", {
        configurable: true,
        value: undefined,
      });

      expect(() => setupRouteHmrHandlers()).not.toThrow();

      // Restore original
      Object.defineProperty(import.meta, "hot", {
        configurable: true,
        value: originalHot,
      });
    });
  });

  describe("isHmrAvailable", () => {
    it("should check if import.meta.hot is available", () => {
      const result = isHmrAvailable();
      // In test environment, this depends on the test setup
      expect(typeof result).toBe("boolean");
    });
  });

  describe("kitExists", () => {
    it("should return true when kit exists", () => {
      const kits = [{ name: "Kit1" }, { name: "Kit2" }, { name: "Kit3" }];

      expect(kitExists("Kit2", kits)).toBe(true);
    });

    it("should return false when kit does not exist", () => {
      const kits = [{ name: "Kit1" }, { name: "Kit2" }];

      expect(kitExists("Kit3", kits)).toBe(false);
    });

    it("should return false for empty kit list", () => {
      expect(kitExists("Kit1", [])).toBe(false);
    });
  });

  describe("restoreSelectedKitIfExists", () => {
    it("should restore kit when conditions are met", () => {
      // Mock isHmrAvailable to return true
      vi.spyOn(hmrStateManager, "isHmrAvailable").mockReturnValue(true);

      sessionStorage.setItem("hmr_selected_kit", "Kit2");
      const kits = [{ name: "Kit1" }, { name: "Kit2" }];
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, null, setSelectedKit);

      expect(setSelectedKit).toHaveBeenCalledWith("Kit2");

      vi.restoreAllMocks();
    });

    it("should not restore kit when already selected", () => {
      vi.spyOn(hmrStateManager, "isHmrAvailable").mockReturnValue(true);

      sessionStorage.setItem("hmr_selected_kit", "Kit2");
      const kits = [{ name: "Kit1" }, { name: "Kit2" }];
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, "Kit1", setSelectedKit);

      expect(setSelectedKit).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it("should not restore kit when kit does not exist", () => {
      vi.spyOn(hmrStateManager, "isHmrAvailable").mockReturnValue(true);

      sessionStorage.setItem("hmr_selected_kit", "Kit3");
      const kits = [{ name: "Kit1" }, { name: "Kit2" }];
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, null, setSelectedKit);

      expect(setSelectedKit).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it("should not restore when kits list is empty", () => {
      vi.spyOn(hmrStateManager, "isHmrAvailable").mockReturnValue(true);

      sessionStorage.setItem("hmr_selected_kit", "Kit1");
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists([], null, setSelectedKit);

      expect(setSelectedKit).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it("should not restore when no saved kit", () => {
      vi.spyOn(hmrStateManager, "isHmrAvailable").mockReturnValue(true);

      const kits = [{ name: "Kit1" }];
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, null, setSelectedKit);

      expect(setSelectedKit).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it("should not run when setSelectedKit is undefined", () => {
      vi.spyOn(hmrStateManager, "isHmrAvailable").mockReturnValue(true);

      sessionStorage.setItem("hmr_selected_kit", "Kit1");
      const kits = [{ name: "Kit1" }];

      restoreSelectedKitIfExists(kits, null, undefined);

      // Should not throw
      expect(true).toBe(true);
      vi.restoreAllMocks();
    });

    it("should not restore kit when recent explicit navigation occurred", () => {
      vi.useFakeTimers();
      vi.spyOn(hmrStateManager, "isHmrAvailable").mockReturnValue(true);

      const now = Date.now();
      vi.setSystemTime(now);

      // Mark explicit navigation
      markExplicitNavigation();

      // Move forward slightly but within the window
      vi.setSystemTime(now + 500);

      sessionStorage.setItem("hmr_selected_kit", "Kit1");
      const kits = [{ name: "Kit1" }];
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, null, setSelectedKit);

      // Should not restore because of recent explicit navigation
      expect(setSelectedKit).not.toHaveBeenCalled();

      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("should restore kit when explicit navigation was long ago", () => {
      vi.useFakeTimers();
      vi.spyOn(hmrStateManager, "isHmrAvailable").mockReturnValue(true);

      const now = Date.now();
      vi.setSystemTime(now);

      // Mark explicit navigation
      markExplicitNavigation();

      // Move forward beyond the window
      vi.setSystemTime(now + 1500);

      sessionStorage.setItem("hmr_selected_kit", "Kit1");
      const kits = [{ name: "Kit1" }];
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, null, setSelectedKit);

      // Should restore because explicit navigation was long ago
      expect(setSelectedKit).toHaveBeenCalledWith("Kit1");

      vi.useRealTimers();
      vi.restoreAllMocks();
    });
  });
});

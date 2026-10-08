import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

      it("counts a navigation as recent for just under a second", () => {
        markExplicitNavigation();

        vi.advanceTimersByTime(999);
        expect(wasRecentExplicitNavigation()).toBe(true);

        vi.advanceTimersByTime(1);
        expect(wasRecentExplicitNavigation()).toBe(false);
      });

      it("ignores a marker that isn't a timestamp", () => {
        sessionStorage.setItem("hmr_explicit_navigation", "invalid-timestamp");

        expect(wasRecentExplicitNavigation()).toBe(false);
      });

      it("counts a marker from the future as recent (clock skew)", () => {
        sessionStorage.setItem(
          "hmr_explicit_navigation",
          (Date.now() + 3_600_000).toString(),
        );

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
    // Each module has its own import.meta, so a test can't take the
    // module's hot away; this checks the handlers register without throwing
    it("should not throw when registering the handlers", () => {
      expect(() => setupRouteHmrHandlers()).not.toThrow();
    });
  });

  describe("isHmrAvailable", () => {
    // Vitest defines import.meta.hot in the jsdom environment, not in the
    // node one the integration runner uses (#601)
    it("is true in this test environment", () => {
      expect(isHmrAvailable()).toBe(true);
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
      expect(kitExists("", kits)).toBe(false);
    });

    it("should return false for empty kit list", () => {
      expect(kitExists("Kit1", [])).toBe(false);
    });
  });

  describe("[Q-07] restoreSelectedKitIfExists", () => {
    const kits = [{ name: "Kit1" }, { name: "Kit2" }];

    beforeEach(() => {
      // Without HMR the function returns before its rules, and every
      // "doesn't restore" case below would pass whatever the rules are
      expect(isHmrAvailable()).toBe(true);
    });

    it("should restore kit when conditions are met", () => {
      saveSelectedKitState("Kit2");
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, null, setSelectedKit);

      expect(setSelectedKit).toHaveBeenCalledWith("Kit2");
    });

    it("should not restore kit when already selected", () => {
      saveSelectedKitState("Kit2");
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, "Kit1", setSelectedKit);

      expect(setSelectedKit).not.toHaveBeenCalled();
    });

    it("should not restore kit when kit does not exist", () => {
      saveSelectedKitState("Kit3");
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, null, setSelectedKit);

      expect(setSelectedKit).not.toHaveBeenCalled();
    });

    it("should not restore when kits list is empty", () => {
      saveSelectedKitState("Kit1");
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists([], null, setSelectedKit);

      expect(setSelectedKit).not.toHaveBeenCalled();
    });

    it("should not restore when no saved kit", () => {
      const setSelectedKit = vi.fn();

      restoreSelectedKitIfExists(kits, null, setSelectedKit);

      expect(setSelectedKit).not.toHaveBeenCalled();
    });

    it("should not run when setSelectedKit is undefined", () => {
      saveSelectedKitState("Kit1");

      expect(() =>
        restoreSelectedKitIfExists(kits, null, undefined),
      ).not.toThrow();
      expect(getSavedSelectedKit()).toBe("Kit1");
    });

    describe("after an explicit navigation, like Back", () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it("doesn't restore within a second, and keeps the saved kit", () => {
        saveSelectedKitState("Kit1");
        markExplicitNavigation();
        vi.advanceTimersByTime(500);
        const setSelectedKit = vi.fn();

        restoreSelectedKitIfExists(kits, null, setSelectedKit);

        expect(setSelectedKit).not.toHaveBeenCalled();
        expect(getSavedSelectedKit()).toBe("Kit1");
      });

      it("restores once the navigation has settled", () => {
        saveSelectedKitState("Kit1");
        markExplicitNavigation();
        const setSelectedKit = vi.fn();

        restoreSelectedKitIfExists(kits, null, setSelectedKit);
        expect(setSelectedKit).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1100);
        restoreSelectedKitIfExists(kits, null, setSelectedKit);
        expect(setSelectedKit).toHaveBeenCalledWith("Kit1");
      });

      it("waits a second from the last of several rapid navigations", () => {
        saveSelectedKitState("Kit1");
        markExplicitNavigation();
        vi.advanceTimersByTime(600);
        markExplicitNavigation();
        vi.advanceTimersByTime(600);
        const setSelectedKit = vi.fn();

        // 1200 ms after the first, 600 ms after the last
        restoreSelectedKitIfExists(kits, null, setSelectedKit);
        expect(setSelectedKit).not.toHaveBeenCalled();

        vi.advanceTimersByTime(400);
        restoreSelectedKitIfExists(kits, null, setSelectedKit);
        expect(setSelectedKit).toHaveBeenCalledWith("Kit1");
      });

      it("restores straight away once the marker is cleared", () => {
        saveSelectedKitState("Kit1");
        markExplicitNavigation();
        clearExplicitNavigation();
        const setSelectedKit = vi.fn();

        restoreSelectedKitIfExists(kits, null, setSelectedKit);

        expect(setSelectedKit).toHaveBeenCalledWith("Kit1");
      });
    });
  });
});

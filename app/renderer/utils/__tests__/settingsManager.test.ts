import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyTheme } from "../settingsManager";

describe("settingsManager", () => {
  let mockLocalStorage: any;
  let mockClassList: any;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    };
    global.localStorage = mockLocalStorage;

    // Mock document.documentElement.classList
    mockClassList = {
      add: vi.fn(),
      remove: vi.fn(),
    };
    global.document = {
      documentElement: {
        classList: mockClassList,
      },
    } as any;

    // Mock console.error
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("applyTheme", () => {
    it("applies dark theme when darkMode is true in saved settings", () => {
      const settings = { darkMode: true };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(settings));

      applyTheme();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("settings");
      expect(mockClassList.add).toHaveBeenCalledWith("dark");
      expect(mockClassList.remove).not.toHaveBeenCalled();
    });

    it("applies light theme when darkMode is false in saved settings", () => {
      const settings = { darkMode: false };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(settings));

      applyTheme();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("settings");
      expect(mockClassList.remove).toHaveBeenCalledWith("dark");
      expect(mockClassList.add).not.toHaveBeenCalled();
    });

    it("applies light theme when darkMode is undefined (defaults to false)", () => {
      const settings = {};
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(settings));

      applyTheme();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("settings");
      expect(mockClassList.remove).toHaveBeenCalledWith("dark");
      expect(mockClassList.add).not.toHaveBeenCalled();
    });

    it("applies light theme when no saved settings exist", () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      applyTheme();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("settings");
      expect(mockClassList.remove).toHaveBeenCalledWith("dark");
      expect(mockClassList.add).not.toHaveBeenCalled();
    });

    it("applies light theme when localStorage contains empty string", () => {
      mockLocalStorage.getItem.mockReturnValue("");

      applyTheme();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("settings");
      expect(mockClassList.remove).toHaveBeenCalledWith("dark");
      expect(mockClassList.add).not.toHaveBeenCalled();
    });

    it("handles JSON parse error gracefully and defaults to light theme", () => {
      mockLocalStorage.getItem.mockReturnValue("invalid json");

      applyTheme();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith("settings");
      expect(console.error).toHaveBeenCalledWith(
        "Failed to apply saved theme:",
        expect.any(Error),
      );
      expect(mockClassList.remove).toHaveBeenCalledWith("dark");
      expect(mockClassList.add).not.toHaveBeenCalled();
    });

    it("handles localStorage access error gracefully", () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error("localStorage access denied");
      });

      applyTheme();

      expect(console.error).toHaveBeenCalledWith(
        "Failed to apply saved theme:",
        expect.any(Error),
      );
      expect(mockClassList.remove).toHaveBeenCalledWith("dark");
      expect(mockClassList.add).not.toHaveBeenCalled();
    });

    it("handles different truthy values for darkMode", () => {
      const settings = { darkMode: 1 };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(settings));

      applyTheme();

      expect(mockClassList.add).toHaveBeenCalledWith("dark");
    });

    it("handles different falsy values for darkMode", () => {
      const settings = { darkMode: 0 };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(settings));

      applyTheme();

      expect(mockClassList.remove).toHaveBeenCalledWith("dark");
    });
  });
});

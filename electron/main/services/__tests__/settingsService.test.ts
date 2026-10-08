import * as path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock electron app
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(),
  },
}));

// Keep the real value checks; only the file write is mocked
vi.mock("../../settingsFile.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../settingsFile.js")>()),
  writeSettingsFile: vi.fn(),
}));

// Mock path
vi.mock("node:path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

import { app } from "electron";

import type { InMemorySettings } from "../../types/settings.js";

import { writeSettingsFile } from "../../settingsFile.js";
import { SettingsService } from "../settingsService.js";

const mockApp = vi.mocked(app);
const mockWriteSettingsFile = vi.mocked(writeSettingsFile);
const mockPath = vi.mocked(path);

describe("SettingsService", () => {
  let settingsService: SettingsService;
  let mockInMemorySettings: InMemorySettings;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsService = new SettingsService();
    mockInMemorySettings = {
      localStorePath: "/test/local/store",
      theme: "dark",
    };

    mockApp.getPath.mockReturnValue("/test/userData");
    mockPath.join.mockImplementation((...args) => args.join("/"));

    // Silence console.log for tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("readSettings", () => {
    it("returns the current in-memory settings with environment overrides", () => {
      const result = settingsService.readSettings(mockInMemorySettings);

      // Should return a new object (not the same reference due to spread syntax)
      expect(result).not.toBe(mockInMemorySettings);
      expect(result).toStrictEqual({
        localStorePath: "/test/local/store",
        theme: "dark",
      });
    });

    it("returns new object for empty settings", () => {
      const emptySettings = {} as InMemorySettings;
      const result = settingsService.readSettings(emptySettings);

      // Should return a new object (not the same reference due to spread syntax)
      expect(result).not.toBe(emptySettings);
      expect(result).toStrictEqual({});
    });
  });

  describe("[UC-35] writeSetting", () => {
    it("updates in-memory settings and writes to file", () => {
      settingsService.writeSetting(mockInMemorySettings, "newKey", "newValue");

      // Should update in-memory settings
      expect(mockInMemorySettings.newKey).toBe("newValue");
      expect(mockInMemorySettings).toEqual({
        localStorePath: "/test/local/store",
        newKey: "newValue",
        theme: "dark",
      });

      // Should write to persistent storage
      expect(mockWriteSettingsFile).toHaveBeenCalledWith(
        "/test/userData/romper-settings.json",
        {
          localStorePath: "/test/local/store",
          newKey: "newValue",
          theme: "dark",
        },
      );
    });

    it("overwrites existing keys", () => {
      settingsService.writeSetting(mockInMemorySettings, "theme", "light");

      expect(mockInMemorySettings.theme).toBe("light");
      expect(mockWriteSettingsFile).toHaveBeenCalledWith(
        "/test/userData/romper-settings.json",
        { localStorePath: "/test/local/store", theme: "light" },
      );
    });

    it("handles complex values", () => {
      const complexValue = {
        nested: { array: [1, 2, 3], boolean: true },
        nullValue: null,
      };

      settingsService.writeSetting(
        mockInMemorySettings,
        "complex",
        complexValue,
      );

      expect(mockInMemorySettings.complex).toEqual(complexValue);
      expect(mockWriteSettingsFile).toHaveBeenCalledWith(
        "/test/userData/romper-settings.json",
        expect.objectContaining({ complex: complexValue }),
      );
    });

    it("constructs correct settings file path", () => {
      mockApp.getPath.mockReturnValue("/custom/userData");

      settingsService.writeSetting(mockInMemorySettings, "test", "value");

      expect(mockApp.getPath).toHaveBeenCalledWith("userData");
      expect(mockPath.join).toHaveBeenCalledWith(
        "/custom/userData",
        "romper-settings.json",
      );
      expect(mockWriteSettingsFile).toHaveBeenCalledWith(
        "/custom/userData/romper-settings.json",
        expect.any(Object),
      );
    });

    it("keeps every other setting when writing one (RE-21)", () => {
      const settings: InMemorySettings = {
        confirmDestructiveActions: false,
        futureSetting: { kept: true },
        localStorePath: "/store",
        themeMode: "dark",
      };

      settingsService.writeSetting(settings, "sdCardPath", "/sd");

      expect(mockWriteSettingsFile).toHaveBeenCalledWith(
        "/test/userData/romper-settings.json",
        {
          confirmDestructiveActions: false,
          futureSetting: { kept: true },
          localStorePath: "/store",
          sdCardPath: "/sd",
          themeMode: "dark",
        },
      );
    });

    it.each([
      ["themeMode", "purple"],
      ["themeMode", null],
      ["confirmDestructiveActions", "yes"],
      ["localStorePath", 42],
      ["sdCardPath", false],
    ])("refuses %s = %j and leaves memory and file alone", (key, value) => {
      const before = { ...mockInMemorySettings };
      expect(() =>
        settingsService.writeSetting(mockInMemorySettings, key, value),
      ).toThrow(`Invalid value for setting ${key}`);
      expect(mockInMemorySettings).toEqual(before);
      expect(mockWriteSettingsFile).not.toHaveBeenCalled();
    });

    it("leaves memory unchanged when the file can't be written", () => {
      mockWriteSettingsFile.mockImplementationOnce(() => {
        throw new Error("disk full");
      });

      expect(() =>
        settingsService.writeSetting(mockInMemorySettings, "themeMode", "dark"),
      ).toThrow("disk full");
      expect(mockInMemorySettings).not.toHaveProperty("themeMode");
    });
  });
});

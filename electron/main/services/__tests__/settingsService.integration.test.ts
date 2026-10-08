import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InMemorySettings } from "../../types/settings.js";

// Mock electron app - vi.mock is hoisted, so we cannot reference variables here.
// The actual return value is set in beforeEach via mockReturnValue.
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(),
  },
}));

// Each test gets its own directory under the OS temp dir (see beforeEach),
// so nothing is written into the source tree.
let TEST_DATA_DIR: string;

import { app } from "electron";

import { loadSettings } from "../../mainProcessSetup.js";
import { SettingsService } from "../settingsService.js";

const mockApp = vi.mocked(app);

describe("[UC-35] SettingsService Integration Tests", () => {
  let settingsService: SettingsService;
  let mockInMemorySettings: InMemorySettings;

  beforeEach(() => {
    vi.clearAllMocks();

    TEST_DATA_DIR = fs.mkdtempSync(
      path.join(os.tmpdir(), "romper-settings-service-"),
    );

    // Set the mock return value for app.getPath
    mockApp.getPath.mockReturnValue(TEST_DATA_DIR);

    settingsService = new SettingsService();
    mockInMemorySettings = {
      localStorePath: "/test/local/store",
    };

    // Silence console.log for tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(TEST_DATA_DIR, { force: true, recursive: true });
    vi.restoreAllMocks();
  });

  describe("readSettings", () => {
    it("should return a copy of in-memory settings", () => {
      const result = settingsService.readSettings(mockInMemorySettings);

      expect(result).not.toBe(mockInMemorySettings); // Different reference
      expect(result.localStorePath).toBe("/test/local/store");
    });

    it("should include environment variable overrides for ROMPER_LOCAL_PATH", () => {
      const originalEnv = process.env.ROMPER_LOCAL_PATH;
      try {
        process.env.ROMPER_LOCAL_PATH = "/env/override/local";

        const result = settingsService.readSettings(mockInMemorySettings);
        expect(result.localStorePath).toBe("/env/override/local");
      } finally {
        if (originalEnv === undefined) {
          delete process.env.ROMPER_LOCAL_PATH;
        } else {
          process.env.ROMPER_LOCAL_PATH = originalEnv;
        }
      }
    });

    it("should include environment variable overrides for ROMPER_SDCARD_PATH", () => {
      const originalEnv = process.env.ROMPER_SDCARD_PATH;
      try {
        process.env.ROMPER_SDCARD_PATH = "/env/sdcard";

        const result = settingsService.readSettings(mockInMemorySettings);
        expect(result.sdCardPath).toBe("/env/sdcard");
      } finally {
        if (originalEnv === undefined) {
          delete process.env.ROMPER_SDCARD_PATH;
        } else {
          process.env.ROMPER_SDCARD_PATH = originalEnv;
        }
      }
    });

    it("should not modify the original settings object", () => {
      const originalPath = mockInMemorySettings.localStorePath;
      settingsService.readSettings(mockInMemorySettings);
      expect(mockInMemorySettings.localStorePath).toBe(originalPath);
    });

    it("should handle settings with extra properties", () => {
      const settings: InMemorySettings = {
        localStorePath: "/path",
        sdCardPath: "/sdcard",
      };
      (settings as Record<string, unknown>).customProperty = "custom";

      const result = settingsService.readSettings(settings);
      expect((result as Record<string, unknown>).customProperty).toBe("custom");
    });
  });

  describe("writeSetting (real file I/O)", () => {
    it("should write settings to a JSON file on disk", () => {
      settingsService.writeSetting(mockInMemorySettings, "theme", "dark");

      const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
      expect(fs.existsSync(settingsPath)).toBe(true);

      const fileContents = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      expect(fileContents.theme).toBe("dark");
      expect(fileContents.localStorePath).toBe("/test/local/store");
    });

    it("should update the in-memory settings object", () => {
      settingsService.writeSetting(
        mockInMemorySettings,
        "newSetting",
        "newValue",
      );

      expect(mockInMemorySettings.newSetting).toBe("newValue");
    });

    it("should overwrite the settings file on subsequent writes", () => {
      settingsService.writeSetting(mockInMemorySettings, "first", "value1");
      settingsService.writeSetting(mockInMemorySettings, "second", "value2");

      const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
      const fileContents = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

      expect(fileContents.first).toBe("value1");
      expect(fileContents.second).toBe("value2");
    });

    it("should write properly formatted JSON", () => {
      settingsService.writeSetting(mockInMemorySettings, "key", "value");

      const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
      const raw = fs.readFileSync(settingsPath, "utf-8");

      // Should be formatted with 2-space indentation (JSON.stringify null, 2)
      expect(raw).toContain("\n");
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it("should handle boolean values", () => {
      settingsService.writeSetting(mockInMemorySettings, "darkMode", true);

      const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
      const fileContents = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

      expect(fileContents.darkMode).toBe(true);
    });

    it("should handle null values", () => {
      settingsService.writeSetting(mockInMemorySettings, "clearThis", null);

      const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
      const fileContents = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));

      expect(fileContents.clearThis).toBeNull();
    });

    it("[UC-06] should handle updating the localStorePath", () => {
      settingsService.writeSetting(
        mockInMemorySettings,
        "localStorePath",
        "/new/path",
      );

      expect(mockInMemorySettings.localStorePath).toBe("/new/path");

      const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
      const fileContents = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      expect(fileContents.localStorePath).toBe("/new/path");
    });
  });

  describe("End-to-end: write then read settings", () => {
    it("should persist settings that can be read back", () => {
      // Write a setting
      settingsService.writeSetting(
        mockInMemorySettings,
        "localStorePath",
        "/updated/path",
      );

      // Read settings back
      const result = settingsService.readSettings(mockInMemorySettings);
      expect(result.localStorePath).toBe("/updated/path");
    });

    it("should handle multiple write-read cycles", () => {
      const settings: InMemorySettings = {
        localStorePath: "/initial",
      };

      // Cycle 1
      settingsService.writeSetting(settings, "localStorePath", "/path1");
      let result = settingsService.readSettings(settings);
      expect(result.localStorePath).toBe("/path1");

      // Cycle 2
      settingsService.writeSetting(settings, "localStorePath", "/path2");
      result = settingsService.readSettings(settings);
      expect(result.localStorePath).toBe("/path2");

      // Verify file on disk has the latest value
      const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
      const fileContents = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      expect(fileContents.localStorePath).toBe("/path2");
    });
  });

  // RE-21: what a relaunch does. Load the file, change one setting, load
  // again: every other setting survives.
  describe("[UC-04] [UC-06] Load, write, load again", () => {
    it("keeps the theme and destructive-action preference across a relaunch", () => {
      const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
      fs.writeFileSync(
        settingsPath,
        JSON.stringify({
          confirmDestructiveActions: false,
          fromANewerVersion: { kept: true },
          localStorePath: "/store",
          themeMode: "dark",
        }),
      );

      // Launch: load, then the user picks a card folder
      const firstLaunch = loadSettings(settingsPath);
      settingsService.writeSetting(
        firstLaunch,
        "sdCardPath",
        "/Volumes/RAMPLE",
      );

      // Next launch
      const secondLaunch = loadSettings(settingsPath);
      expect(secondLaunch).toEqual({
        confirmDestructiveActions: false,
        fromANewerVersion: { kept: true },
        localStorePath: "/store",
        sdCardPath: "/Volumes/RAMPLE",
        themeMode: "dark",
      });
      expect(settingsService.readSettings(secondLaunch).themeMode).toBe("dark");
    });

    it("saves a preference changed in Preferences for the next launch", () => {
      const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
      const settings = loadSettings(settingsPath);

      settingsService.writeSetting(settings, "localStorePath", "/store");
      settingsService.writeSetting(settings, "themeMode", "light");
      settingsService.writeSetting(
        settings,
        "confirmDestructiveActions",
        false,
      );
      settingsService.writeSetting(settings, "localStorePath", "/other-store");

      expect(loadSettings(settingsPath)).toEqual({
        confirmDestructiveActions: false,
        localStorePath: "/other-store",
        themeMode: "light",
      });
      expect(fs.readdirSync(TEST_DATA_DIR)).toEqual(["romper-settings.json"]);
    });
  });
});

import * as fs from "node:fs";
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

const TEST_DATA_DIR = path.join(__dirname, "test-data-settings");

import { app } from "electron";

import { SettingsService } from "../settingsService.js";

const mockApp = vi.mocked(app);

describe("SettingsService Integration Tests", () => {
  let settingsService: SettingsService;
  let mockInMemorySettings: InMemorySettings;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set the mock return value for app.getPath
    mockApp.getPath.mockReturnValue(TEST_DATA_DIR);

    // Ensure test directory exists
    if (!fs.existsSync(TEST_DATA_DIR)) {
      fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    }

    settingsService = new SettingsService();
    mockInMemorySettings = {
      localStorePath: "/test/local/store",
    };

    // Silence console.log for tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    // Clean up settings file
    const settingsPath = path.join(TEST_DATA_DIR, "romper-settings.json");
    if (fs.existsSync(settingsPath)) {
      fs.unlinkSync(settingsPath);
    }
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { force: true, recursive: true });
    }
    vi.restoreAllMocks();
  });

  describe("getLocalStorePath", () => {
    it("should return the localStorePath from settings", () => {
      const result = settingsService.getLocalStorePath(mockInMemorySettings);
      expect(result).toBe("/test/local/store");
    });

    it("should return environment override when provided", () => {
      const result = settingsService.getLocalStorePath(
        mockInMemorySettings,
        "/override/path",
      );
      expect(result).toBe("/override/path");
    });

    it("should prefer environment override over settings", () => {
      const result = settingsService.getLocalStorePath(
        mockInMemorySettings,
        "/env/path",
      );
      expect(result).toBe("/env/path");
    });

    it("should return null when no path is configured", () => {
      const emptySettings: InMemorySettings = {
        localStorePath: null,
      };
      const result = settingsService.getLocalStorePath(emptySettings);
      expect(result).toBeNull();
    });

    it("should return null for empty string localStorePath", () => {
      const settings: InMemorySettings = {
        localStorePath: "",
      };
      // Note: SettingsService.getLocalStorePath returns envOverride || inMemorySettings.localStorePath || null
      // Empty string is falsy so it returns null
      const result = settingsService.getLocalStorePath(settings);
      expect(result).toBeNull();
    });
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

  describe("validateLocalStorePath", () => {
    it("should return success with path when localStorePath is set", () => {
      const result =
        settingsService.validateLocalStorePath(mockInMemorySettings);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.path).toBe("/test/local/store");
      }
    });

    it("should return success with environment override path", () => {
      const emptySettings: InMemorySettings = {
        localStorePath: null,
      };

      const result = settingsService.validateLocalStorePath(
        emptySettings,
        "/override/path",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.path).toBe("/override/path");
      }
    });

    it("should return failure when no path is configured", () => {
      const emptySettings: InMemorySettings = {
        localStorePath: null,
      };

      const result = settingsService.validateLocalStorePath(emptySettings);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("No local store configured");
      }
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

    it("should handle updating the localStorePath", () => {
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

    it("should validate a path after writing it", () => {
      const settings: InMemorySettings = {
        localStorePath: null,
      };

      // Initially invalid
      const invalidResult = settingsService.validateLocalStorePath(settings);
      expect(invalidResult.success).toBe(false);

      // Write a path
      settingsService.writeSetting(settings, "localStorePath", "/new/store");

      // Now valid
      const validResult = settingsService.validateLocalStorePath(settings);
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.path).toBe("/new/store");
      }
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
});

import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock electron app
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(),
  },
}));

// Mock fs
vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

import { app } from "electron";

import { SettingsService } from "../settingsService.js";

const mockApp = vi.mocked(app);
const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);

describe("SettingsService", () => {
  let settingsService: SettingsService;
  let mockInMemorySettings: Record<string, unknown>;

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
      const emptySettings = {};
      const result = settingsService.readSettings(emptySettings);

      // Should return a new object (not the same reference due to spread syntax)
      expect(result).not.toBe(emptySettings);
      expect(result).toStrictEqual({});
    });
  });

  describe("writeSetting", () => {
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
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        "/test/userData/romper-settings.json",
        JSON.stringify(mockInMemorySettings, null, 2),
        "utf-8",
      );
    });

    it("overwrites existing keys", () => {
      settingsService.writeSetting(mockInMemorySettings, "theme", "light");

      expect(mockInMemorySettings.theme).toBe("light");
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        "/test/userData/romper-settings.json",
        JSON.stringify(
          {
            localStorePath: "/test/local/store",
            theme: "light",
          },
          null,
          2,
        ),
        "utf-8",
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
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        "/test/userData/romper-settings.json",
        expect.stringContaining('"complex"'),
        "utf-8",
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
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        "/custom/userData/romper-settings.json",
        expect.any(String),
        "utf-8",
      );
    });
  });

  describe("getLocalStorePath", () => {
    it("returns environment override when provided", () => {
      const result = settingsService.getLocalStorePath(
        mockInMemorySettings,
        "/env/override/path",
      );

      expect(result).toBe("/env/override/path");
    });

    it("returns in-memory settings path when no environment override", () => {
      const result = settingsService.getLocalStorePath(mockInMemorySettings);

      expect(result).toBe("/test/local/store");
    });

    it("returns null when no path is configured", () => {
      const emptySettings = {};
      const result = settingsService.getLocalStorePath(emptySettings);

      expect(result).toBeNull();
    });

    it("prioritizes environment override over in-memory settings", () => {
      const result = settingsService.getLocalStorePath(
        mockInMemorySettings,
        "/priority/env/path",
      );

      expect(result).toBe("/priority/env/path");
      // Should not use the in-memory setting
      expect(result).not.toBe("/test/local/store");
    });

    it("handles falsy environment override", () => {
      const result = settingsService.getLocalStorePath(
        mockInMemorySettings,
        "",
      );

      expect(result).toBe("/test/local/store");
    });
  });

  describe("validateLocalStorePath", () => {
    it("returns success when path is configured via environment", () => {
      const result = settingsService.validateLocalStorePath({}, "/env/path");

      expect(result).toEqual({
        path: "/env/path",
        success: true,
      });
    });

    it("returns success when path is configured in memory", () => {
      const result =
        settingsService.validateLocalStorePath(mockInMemorySettings);

      expect(result).toEqual({
        path: "/test/local/store",
        success: true,
      });
    });

    it("returns failure when no path is configured", () => {
      const emptySettings = {};
      const result = settingsService.validateLocalStorePath(emptySettings);

      expect(result).toEqual({
        error: "No local store configured",
        success: false,
      });
    });

    it("prioritizes environment override in validation", () => {
      const result = settingsService.validateLocalStorePath(
        mockInMemorySettings,
        "/env/override",
      );

      expect(result).toEqual({
        path: "/env/override",
        success: true,
      });
    });

    it("fails validation with empty environment override and no memory setting", () => {
      const emptySettings = {};
      const result = settingsService.validateLocalStorePath(emptySettings, "");

      expect(result).toEqual({
        error: "No local store configured",
        success: false,
      });
    });
  });
});

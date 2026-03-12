import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../localStoreValidator.js", () => ({
  validateLocalStoreAndDb: vi.fn(() => ({ isValid: true })),
}));

import { validateLocalStoreAndDb } from "../localStoreValidator.js";
import {
  loadSettings,
  loadWindowState,
  saveWindowState,
  validateAndFixLocalStore,
} from "../mainProcessSetup.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(fs, "existsSync").mockReturnValue(true);
  vi.spyOn(fs, "readFileSync").mockReturnValue('{"foo": "bar"}');
  vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadSettings", () => {
  it("returns empty settings when file does not exist", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const result = loadSettings("/mock/settings.json");
    expect(result).toEqual({ localStorePath: null });
    expect(console.log).toHaveBeenCalledWith(
      "[Settings] Settings file not found - will use empty settings",
    );
  });

  it("returns empty settings when file is empty", () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue("");
    const result = loadSettings("/mock/settings.json");
    expect(result).toEqual({ localStorePath: null });
    expect(console.log).toHaveBeenCalledWith(
      "[Settings] Settings file is empty - using empty settings",
    );
  });

  it("parses valid settings object", () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      '{"localStorePath": "/store", "sdCardPath": "/sd"}',
    );
    const result = loadSettings("/mock/settings.json");
    expect(result).toEqual({
      localStorePath: "/store",
      sdCardPath: "/sd",
    });
  });

  it("logs loaded settings", () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue('{"foo": "bar"}');
    loadSettings("/mock/settings.json");
    expect(console.log).toHaveBeenCalledWith(
      "[Settings] Loaded settings:",
      expect.any(String),
    );
  });

  it("warns when settings file contains non-object", () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      '["array", "instead", "of", "object"]',
    );
    const result = loadSettings("/mock/settings.json");
    expect(result).toEqual({ localStorePath: null });
    expect(console.warn).toHaveBeenCalledWith(
      "[Settings] Settings file did not contain an object. Using empty settings.",
    );
  });

  it("logs error for invalid JSON", () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue("not json");
    const result = loadSettings("/mock/settings.json");
    expect(result).toEqual({ localStorePath: null });
    expect(console.error).toHaveBeenCalledWith(
      "[Settings] Failed to parse settings file:",
      expect.any(Error),
    );
  });

  it("defaults localStorePath to null when not present", () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue('{"sdCardPath": "/sd"}');
    const result = loadSettings("/mock/settings.json");
    expect(result.localStorePath).toBeNull();
  });
});

describe("validateAndFixLocalStore", () => {
  it("returns settings unchanged when no localStorePath and no env override", () => {
    const settings = { localStorePath: null };
    const result = validateAndFixLocalStore(settings, "/mock/settings.json");
    expect(result).toEqual({ localStorePath: null });
    expect(console.log).toHaveBeenCalledWith(
      "[Validation] No local store path to validate",
    );
  });

  it("validates localStorePath when present and valid", () => {
    const settings = { localStorePath: "/mock/store" };
    vi.mocked(validateLocalStoreAndDb).mockReturnValue({ isValid: true });
    const result = validateAndFixLocalStore(settings, "/mock/settings.json");
    expect(validateLocalStoreAndDb).toHaveBeenCalledWith("/mock/store");
    expect(result.localStorePath).toBe("/mock/store");
    expect(console.log).toHaveBeenCalledWith(
      "[Validation] ✓ Local store path is valid",
    );
  });

  it("removes invalid localStorePath and writes updated settings", () => {
    const settings = { localStorePath: "/invalid/path" };
    vi.mocked(validateLocalStoreAndDb).mockReturnValue({
      error: "Path does not exist",
      errorSummary: "Invalid path",
      isValid: false,
    });
    const result = validateAndFixLocalStore(settings, "/mock/settings.json");
    expect(result.localStorePath).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      "[Startup] ✗ Saved local store path is invalid",
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/mock/settings.json",
      expect.any(String),
      "utf-8",
    );
  });

  it("handles write error when removing invalid localStorePath", () => {
    const settings = { localStorePath: "/invalid/path" };
    vi.mocked(validateLocalStoreAndDb).mockReturnValue({
      error: "Path does not exist",
      isValid: false,
    });
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("Write failed");
    });
    const result = validateAndFixLocalStore(settings, "/mock/settings.json");
    expect(result.localStorePath).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "[Startup] Failed to update settings file:",
      expect.any(Error),
    );
  });

  it("accepts valid env override and returns settings unchanged", () => {
    const settings = { localStorePath: null };
    vi.mocked(validateLocalStoreAndDb).mockReturnValue({ isValid: true });
    const result = validateAndFixLocalStore(
      settings,
      "/mock/settings.json",
      "/env/override",
    );
    expect(validateLocalStoreAndDb).toHaveBeenCalledWith("/env/override");
    expect(result).toEqual({ localStorePath: null });
    expect(console.log).toHaveBeenCalledWith(
      "[Validation] ✓ Environment override path is valid",
    );
  });

  it("falls back to settings validation when env override is invalid", () => {
    const settings = { localStorePath: "/mock/store" };
    vi.mocked(validateLocalStoreAndDb)
      .mockReturnValueOnce({ error: "Invalid", isValid: false })
      .mockReturnValueOnce({ isValid: true });
    const result = validateAndFixLocalStore(
      settings,
      "/mock/settings.json",
      "/invalid/env",
    );
    expect(console.warn).toHaveBeenCalledWith(
      "[Validation] ✗ Environment override path is invalid",
    );
    expect(validateLocalStoreAndDb).toHaveBeenCalledWith("/mock/store");
    expect(result.localStorePath).toBe("/mock/store");
  });
});

describe("loadWindowState", () => {
  it("returns defaults when state file does not exist", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const result = loadWindowState("/mock/window-state.json");
    expect(result).toEqual({ height: 800, width: 1200 });
  });

  it("merges saved state with defaults", () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      '{"x": 100, "y": 200, "width": 1000, "height": 600, "isMaximized": true}',
    );
    const result = loadWindowState("/mock/window-state.json");
    expect(result).toEqual({
      height: 600,
      isMaximized: true,
      width: 1000,
      x: 100,
      y: 200,
    });
  });

  it("returns defaults when state file is corrupt", () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue("not json");
    const result = loadWindowState("/mock/window-state.json");
    expect(result).toEqual({ height: 800, width: 1200 });
  });
});

describe("saveWindowState", () => {
  it("writes window bounds and maximized state to file", () => {
    const bounds = { height: 600, width: 1000, x: 50, y: 75 };
    saveWindowState(bounds, false, "/mock/window-state.json");
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/mock/window-state.json",
      JSON.stringify({
        height: 600,
        isMaximized: false,
        width: 1000,
        x: 50,
        y: 75,
      }),
    );
  });

  it("does not throw on write error", () => {
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {
      throw new Error("Disk full");
    });
    expect(() =>
      saveWindowState(
        { height: 800, width: 1200, x: 0, y: 0 },
        false,
        "/mock/state.json",
      ),
    ).not.toThrow();
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isValidSettingValue,
  normalizeSettings,
  writeSettingsFile,
} from "../settingsFile.js";

describe("[UC-35] settings file", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isValidSettingValue", () => {
    it.each([
      ["themeMode", "dark"],
      ["themeMode", "light"],
      ["themeMode", "system"],
      ["confirmDestructiveActions", true],
      ["confirmDestructiveActions", false],
      ["localStorePath", "/store"],
      ["localStorePath", null],
      ["sdCardPath", "/sd"],
      ["sdCardPath", null],
      ["somethingNewer", { any: "value" }],
    ])("accepts %s = %j", (key, value) => {
      expect(isValidSettingValue(key, value)).toBe(true);
    });

    it.each([
      ["themeMode", "purple"],
      ["themeMode", undefined],
      ["confirmDestructiveActions", "true"],
      ["confirmDestructiveActions", null],
      ["localStorePath", 1],
      ["sdCardPath", {}],
    ])("refuses %s = %j", (key, value) => {
      expect(isValidSettingValue(key, value)).toBe(false);
    });

    it("doesn't treat inherited object keys as known settings", () => {
      expect(isValidSettingValue("toString", "anything")).toBe(true);
    });
  });

  describe("normalizeSettings", () => {
    it("keeps every known setting (RE-21)", () => {
      expect(
        normalizeSettings({
          confirmDestructiveActions: false,
          localStorePath: "/store",
          sdCardPath: "/sd",
          themeMode: "dark",
        }),
      ).toEqual({
        confirmDestructiveActions: false,
        localStorePath: "/store",
        sdCardPath: "/sd",
        themeMode: "dark",
      });
    });

    it("keeps keys it doesn't know", () => {
      expect(normalizeSettings({ fromANewerVersion: [1, 2] })).toEqual({
        fromANewerVersion: [1, 2],
        localStorePath: null,
      });
    });

    it("drops a known setting with the wrong type, so its default applies", () => {
      const result = normalizeSettings({
        confirmDestructiveActions: "no",
        localStorePath: "/store",
        themeMode: "purple",
      });

      expect(result).toEqual({ localStorePath: "/store" });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Ignoring saved themeMode"),
      );
    });

    it("treats a missing or empty store path as no store", () => {
      expect(normalizeSettings({}).localStorePath).toBeNull();
      expect(normalizeSettings({ localStorePath: "" }).localStorePath).toBe(
        null,
      );
    });
  });

  describe("writeSettingsFile", () => {
    let dir: string;
    let settingsPath: string;

    beforeEach(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "romper-settings-file-"));
      settingsPath = path.join(dir, "romper-settings.json");
    });

    afterEach(() => {
      fs.rmSync(dir, { force: true, recursive: true });
    });

    it("writes formatted JSON and leaves no temporary file", () => {
      writeSettingsFile(settingsPath, {
        localStorePath: "/store",
        themeMode: "light",
      });

      const raw = fs.readFileSync(settingsPath, "utf-8");
      expect(JSON.parse(raw)).toEqual({
        localStorePath: "/store",
        themeMode: "light",
      });
      expect(raw).toContain("\n");
      expect(fs.readdirSync(dir)).toEqual(["romper-settings.json"]);
    });

    it("replaces the old file", () => {
      fs.writeFileSync(settingsPath, '{"localStorePath":"/old"}');

      writeSettingsFile(settingsPath, { localStorePath: "/new" });

      expect(JSON.parse(fs.readFileSync(settingsPath, "utf-8"))).toEqual({
        localStorePath: "/new",
      });
    });

    it("leaves the old file whole when the write fails", () => {
      fs.writeFileSync(settingsPath, '{"localStorePath":"/old"}');
      vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
        throw new Error("ENOSPC: no space left on device");
      });

      expect(() =>
        writeSettingsFile(settingsPath, { localStorePath: "/new" }),
      ).toThrow("ENOSPC");

      expect(fs.readFileSync(settingsPath, "utf-8")).toBe(
        '{"localStorePath":"/old"}',
      );
      expect(fs.readdirSync(dir)).toEqual(["romper-settings.json"]);
    });

    it("removes the temporary file when the rename fails", () => {
      // A non-empty folder where the file should be: the rename can't replace it
      fs.mkdirSync(settingsPath);
      fs.writeFileSync(path.join(settingsPath, "keep"), "");

      expect(() =>
        writeSettingsFile(settingsPath, { localStorePath: "/new" }),
      ).toThrow();

      expect(fs.readdirSync(dir)).toEqual(["romper-settings.json"]);
    });
  });
});

import { describe, expect, test } from "vitest";

import type { InMemorySettings } from "../settings.js";

describe("InMemorySettings Interface", () => {
  test("should accept valid settings configuration", () => {
    const validSettings: InMemorySettings = {
      localStorePath: "/path/to/store",
      sdCardPath: "/path/to/sdcard",
    };

    expect(validSettings.localStorePath).toBe("/path/to/store");
    expect(validSettings.sdCardPath).toBe("/path/to/sdcard");
  });

  test("should accept null localStorePath", () => {
    const settingsWithNullPath: InMemorySettings = {
      localStorePath: null,
    };

    expect(settingsWithNullPath.localStorePath).toBe(null);
  });

  test("should accept minimal configuration with only required fields", () => {
    const minimalSettings: InMemorySettings = {
      localStorePath: null,
    };

    expect(minimalSettings.localStorePath).toBe(null);
    expect(minimalSettings.sdCardPath).toBeUndefined();
  });

  test("should accept all optional fields as undefined", () => {
    const settingsWithUndefined: InMemorySettings = {
      localStorePath: "/test/path",
      sdCardPath: undefined,
    };

    expect(settingsWithUndefined.localStorePath).toBe("/test/path");
    expect(settingsWithUndefined.sdCardPath).toBeUndefined();
  });

  test("should extend Record<string, unknown> for additional properties", () => {
    const extendedSettings: InMemorySettings = {
      anotherProperty: 123,
      customProperty: "custom value",
      localStorePath: "/path",
    };

    // Test Record<string, unknown> extension
    expect(extendedSettings.customProperty).toBe("custom value");
    expect(extendedSettings.anotherProperty).toBe(123);

    // Test required property
    expect(extendedSettings.localStorePath).toBe("/path");
  });

  test("should work with type assertions in settings service patterns", () => {
    const unknownData: Record<string, unknown> = {
      localStorePath: "/test/path",
      randomField: "should be preserved",
    };

    const typedSettings = unknownData as InMemorySettings;

    expect(typedSettings.localStorePath).toBe("/test/path");
    expect((typedSettings as unknown).randomField).toBe("should be preserved");
  });

  test("should handle additional properties via Record extension", () => {
    const extendedSettings: InMemorySettings = {
      customFlag: true,
      localStorePath: null,
    };

    expect(extendedSettings.customFlag).toBe(true);
    expect(extendedSettings.localStorePath).toBe(null);
  });

  test("should handle string path values correctly", () => {
    const pathTests: InMemorySettings[] = [
      { localStorePath: "/absolute/path" },
      { localStorePath: "./relative/path" },
      { localStorePath: "simple-path" },
      { localStorePath: null },
    ];

    expect(pathTests[0].localStorePath).toBe("/absolute/path");
    expect(pathTests[1].localStorePath).toBe("./relative/path");
    expect(pathTests[2].localStorePath).toBe("simple-path");
    expect(pathTests[3].localStorePath).toBe(null);
  });
});

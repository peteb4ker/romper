import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OLD_ENV = { ...process.env };

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("should use ROMPER_LOCAL_PATH if set", async () => {
    vi.stubEnv("ROMPER_LOCAL_PATH", "/test/local");
    const { config: freshConfig } = await import("../config");
    expect(freshConfig.localStorePath).toBe("/test/local");
  });

  it("should be undefined if ROMPER_LOCAL_PATH is not set", async () => {
    vi.stubEnv("ROMPER_LOCAL_PATH", undefined);
    vi.stubEnv("ROMPER_SDCARD_PATH", "/test/sdcard");
    const { config: freshConfig } = await import("../config");
    expect(freshConfig.localStorePath).toBeUndefined();
    expect(freshConfig.sdCardPath).toBe("/test/sdcard");
  });

  it("should be undefined if neither ROMPER_LOCAL_PATH nor ROMPER_SDCARD_PATH is set", async () => {
    vi.stubEnv("ROMPER_LOCAL_PATH", undefined);
    vi.stubEnv("ROMPER_SDCARD_PATH", undefined);
    const { config: freshConfig } = await import("../config");
    expect(freshConfig.localStorePath).toBeUndefined();
  });
});

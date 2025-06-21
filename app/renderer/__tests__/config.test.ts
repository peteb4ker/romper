import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { config } from "../config";

const OLD_ENV = { ...process.env };

describe("config", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("should use ROMPER_SDCARD_PATH if set", async () => {
    vi.stubEnv("ROMPER_SDCARD_PATH", "/test/sdcard");
    const { config: freshConfig } = await import("../config");
    expect(freshConfig.localStorePath).toBe("/test/sdcard");
  });

  it("should be undefined if ROMPER_SDCARD_PATH is not set", async () => {
    vi.stubEnv("ROMPER_SDCARD_PATH", undefined);
    const { config: freshConfig } = await import("../config");
    expect(freshConfig.localStorePath).toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initAutoUpdater } from "../autoUpdater.js";

// Mutable electron app mock — `isPackaged` is overridden per test.
const mockApp = { isPackaged: false };
vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return mockApp.isPackaged;
    },
  },
}));

const updateElectronApp = vi.fn();
vi.mock("update-electron-app", () => ({
  updateElectronApp: (...args: unknown[]) => updateElectronApp(...args),
  UpdateSourceType: { ElectronPublicUpdateService: 0, StaticStorage: 1 },
}));

const originalPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", {
    configurable: true,
    value: platform,
  });
}

describe("initAutoUpdater", () => {
  beforeEach(() => {
    updateElectronApp.mockReset();
    mockApp.isPackaged = false;
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it("does nothing on non-macOS platforms even when packaged", async () => {
    setPlatform("win32");
    mockApp.isPackaged = true;

    await initAutoUpdater();

    expect(updateElectronApp).not.toHaveBeenCalled();
  });

  it("does nothing on macOS when the build is not packaged", async () => {
    setPlatform("darwin");
    mockApp.isPackaged = false;

    await initAutoUpdater();

    expect(updateElectronApp).not.toHaveBeenCalled();
  });

  it("initialises the updater on packaged macOS builds", async () => {
    setPlatform("darwin");
    mockApp.isPackaged = true;

    await initAutoUpdater();

    expect(updateElectronApp).toHaveBeenCalledTimes(1);
    const opts = updateElectronApp.mock.calls[0][0];
    expect(opts.updateSource).toEqual({
      repo: "peteb4ker/romper",
      type: 0,
    });
    expect(opts.updateInterval).toBe("1 week");
    expect(opts.notifyUser).toBe(true);
    expect(typeof opts.logger.log).toBe("function");
  });

  it("swallows updater initialisation errors", async () => {
    setPlatform("darwin");
    mockApp.isPackaged = true;
    updateElectronApp.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    await expect(initAutoUpdater()).resolves.toBeUndefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../logger";

describe("createLogger", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("when the level meets the minimum (info in the test env)", () => {
    it("should emit info with the context-prefixed message and args", () => {
      // Arrange
      const spy = vi.spyOn(console, "info").mockImplementation(() => {});

      // Act
      createLogger("Wizard").info("started", 1);

      // Assert
      expect(spy).toHaveBeenCalledWith("[Wizard] started", 1);
    });

    it("should emit warn with the context-prefixed message", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

      createLogger("Wizard").warn("careful");

      expect(spy).toHaveBeenCalledWith("[Wizard] careful");
    });

    it("should emit error with the context-prefixed message", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      createLogger("Wizard").error("boom");

      expect(spy).toHaveBeenCalledWith("[Wizard] boom");
    });
  });

  describe("when the level is below the minimum", () => {
    it("should suppress debug output outside development", () => {
      // Arrange
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});

      // Act
      createLogger("Wizard").debug("noisy");

      // Assert
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("when running in development", () => {
    it("should emit debug output", async () => {
      // Arrange — re-import the module with NODE_ENV=development so the
      // module-level minLevel is recomputed to "debug".
      vi.stubEnv("NODE_ENV", "development");
      vi.resetModules();
      const { createLogger: createDevLogger } = await import("../logger");
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});

      // Act
      createDevLogger("Wizard").debug("trace", { detail: true });

      // Assert
      expect(spy).toHaveBeenCalledWith("[Wizard] trace", { detail: true });
    });
  });
});

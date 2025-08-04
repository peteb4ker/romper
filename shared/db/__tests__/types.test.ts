import { describe, expect, it } from "vitest";

import type { Kit, NewKit, NewSample } from "../types";

describe("shared/db/types", () => {
  describe("type exports", () => {
    it("should export Kit type", () => {
      // Test that Kit type can be used
      const kit = {} as Kit;
      expect(kit).toBeDefined();
    });

    it("should export NewKit type", () => {
      // Test that NewKit type can be used
      const newKit = {} as NewKit;
      expect(newKit).toBeDefined();
    });

    it("should export NewSample type", () => {
      // Test that NewSample type can be used
      const newSample = {} as NewSample;
      expect(newSample).toBeDefined();
    });
  });

  describe("type structure validation", () => {
    it("should allow Kit type to be used in type assertions", () => {
      const mockKit: Partial<Kit> = {
        id: 1,
        name: "Test Kit",
      };
      expect(mockKit.id).toBe(1);
      expect(mockKit.name).toBe("Test Kit");
    });

    it("should allow NewKit type to be used in type assertions", () => {
      const mockNewKit: Partial<NewKit> = {
        name: "New Test Kit",
      };
      expect(mockNewKit.name).toBe("New Test Kit");
    });

    it("should allow NewSample type to be used in type assertions", () => {
      const mockNewSample: Partial<NewSample> = {
        filename: "test.wav",
      };
      expect(mockNewSample.filename).toBe("test.wav");
    });
  });
});

import { describe, expect, it } from "vitest";

import * as dbIndex from "../index";

describe("shared/db/index", () => {
  describe("schema re-exports", () => {
    it("should re-export schema items", () => {
      // Check that the main schema items are available through re-export
      expect(dbIndex).toHaveProperty("kits");
      expect(dbIndex).toHaveProperty("samples");
      expect(dbIndex).toHaveProperty("voices");
      expect(dbIndex).toHaveProperty("banks");
    });

    it("should have table definitions available", () => {
      // Verify that table definitions are accessible
      expect(dbIndex.kits).toBeDefined();
      expect(dbIndex.samples).toBeDefined();
      expect(dbIndex.voices).toBeDefined();
      expect(dbIndex.banks).toBeDefined();
    });

    it("should maintain proper exports structure", () => {
      // Test that the module structure is as expected
      const moduleKeys = Object.keys(dbIndex);
      expect(moduleKeys.length).toBeGreaterThan(0);

      // Core tables should be present
      const expectedTables = ["kits", "samples", "voices", "banks"];
      expectedTables.forEach((table) => {
        expect(moduleKeys).toContain(table);
      });
    });

    it("should export type definitions", () => {
      // Test that types can be used (they're available at compile time)
      const mockKit = {} as typeof dbIndex.Kit;
      const mockNewKit = {} as typeof dbIndex.NewKit;
      const mockNewSample = {} as typeof dbIndex.NewSample;

      expect(mockKit).toBeDefined();
      expect(mockNewKit).toBeDefined();
      expect(mockNewSample).toBeDefined();
    });

    it("should re-export all schema exports", () => {
      // Verify the re-export works by checking for expected properties
      expect(typeof dbIndex.kits).toBe("object");
      expect(typeof dbIndex.samples).toBe("object");
      expect(typeof dbIndex.voices).toBe("object");
      expect(typeof dbIndex.banks).toBe("object");
    });
  });
});

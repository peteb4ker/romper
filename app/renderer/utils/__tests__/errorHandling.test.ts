import { describe, expect, it, vi } from "vitest";

import { ErrorPatterns } from "../errorHandling";

// Mock console.error to avoid spam in test output
const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

describe("ErrorPatterns", () => {
  describe("apiOperation", () => {
    it("should handle errors without throwing", () => {
      expect(() => {
        ErrorPatterns.apiOperation(
          new Error("Test API error"),
          "test operation",
        );
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("kitOperation", () => {
    it("should handle errors without throwing", () => {
      expect(() => {
        ErrorPatterns.kitOperation(
          new Error("Test kit error"),
          "test operation",
        );
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("sampleOperation", () => {
    it("should handle errors without throwing", () => {
      expect(() => {
        ErrorPatterns.sampleOperation(
          new Error("Test sample error"),
          "test operation",
        );
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});

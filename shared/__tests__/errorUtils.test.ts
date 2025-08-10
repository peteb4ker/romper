import { beforeEach, describe, expect, it, vi } from "vitest";

import { createErrorResult, getErrorMessage } from "../errorUtils";

describe("errorUtils", () => {
  beforeEach(() => {
    // Reset console mocks before each test
    vi.clearAllMocks();
  });

  describe("getErrorMessage", () => {
    it("should return error message for Error instances", () => {
      const error = new Error("Test error message");
      const result = getErrorMessage(error);
      expect(result).toBe("Test error message");
    });

    it("should return string representation for non-Error objects", () => {
      const result = getErrorMessage("Simple string error");
      expect(result).toBe("Simple string error");
    });

    it("should handle null values", () => {
      const result = getErrorMessage(null);
      expect(result).toBe("null");
    });

    it("should handle undefined values", () => {
      const result = getErrorMessage(undefined);
      expect(result).toBe("undefined");
    });

    it("should handle number values", () => {
      const result = getErrorMessage(404);
      expect(result).toBe("404");
    });

    it("should handle boolean values", () => {
      const result = getErrorMessage(false);
      expect(result).toBe("false");
    });

    it("should handle object values", () => {
      const errorObj = { code: 500, message: "Internal Server Error" };
      const result = getErrorMessage(errorObj);
      expect(result).toBe("[object Object]");
    });

    it("should handle array values", () => {
      const errorArray = ["error1", "error2"];
      const result = getErrorMessage(errorArray);
      expect(result).toBe("error1,error2");
    });

    it("should handle custom Error subclasses", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }

      const error = new CustomError("Custom error occurred");
      const result = getErrorMessage(error);
      expect(result).toBe("Custom error occurred");
    });

    it("should handle Error instances with empty messages", () => {
      const error = new Error("");
      const result = getErrorMessage(error);
      expect(result).toBe("");
    });

    it("should handle TypeError instances", () => {
      const error = new TypeError("Cannot read property 'foo' of undefined");
      const result = getErrorMessage(error);
      expect(result).toBe("Cannot read property 'foo' of undefined");
    });

    it("should handle ReferenceError instances", () => {
      const error = new ReferenceError("variable is not defined");
      const result = getErrorMessage(error);
      expect(result).toBe("variable is not defined");
    });
  });

  describe("createErrorResult", () => {
    it("should create error result without prefix", () => {
      const error = new Error("Database connection failed");
      const result = createErrorResult(error);

      expect(result).toEqual({
        error: "Database connection failed",
        success: false,
      });
    });

    it("should create error result with prefix", () => {
      const error = new Error("Connection timeout");
      const result = createErrorResult(error, "Database operation");

      expect(result).toEqual({
        error: "Database operation: Connection timeout",
        success: false,
      });
    });

    it("should handle non-Error objects without prefix", () => {
      const result = createErrorResult("File not found");

      expect(result).toEqual({
        error: "File not found",
        success: false,
      });
    });

    it("should handle non-Error objects with prefix", () => {
      const result = createErrorResult("Invalid format", "File parsing");

      expect(result).toEqual({
        error: "File parsing: Invalid format",
        success: false,
      });
    });

    it("should handle null errors", () => {
      const result = createErrorResult(null, "Operation");

      expect(result).toEqual({
        error: "Operation: null",
        success: false,
      });
    });

    it("should handle undefined errors", () => {
      const result = createErrorResult(undefined);

      expect(result).toEqual({
        error: "undefined",
        success: false,
      });
    });

    it("should handle numeric errors with prefix", () => {
      const result = createErrorResult(500, "HTTP Status");

      expect(result).toEqual({
        error: "HTTP Status: 500",
        success: false,
      });
    });

    it("should handle boolean errors", () => {
      const result = createErrorResult(false, "Validation");

      expect(result).toEqual({
        error: "Validation: false",
        success: false,
      });
    });

    it("should handle object errors", () => {
      const errorObj = { code: "ERR001", details: "Invalid input" };
      const result = createErrorResult(errorObj, "API Call");

      expect(result).toEqual({
        error: "API Call: [object Object]",
        success: false,
      });
    });

    it("should handle empty prefix", () => {
      const error = new Error("Test error");
      const result = createErrorResult(error, "");

      expect(result).toEqual({
        error: "Test error",
        success: false,
      });
    });

    it("should maintain type safety in return object", () => {
      const error = new Error("Type test");
      const result = createErrorResult(error);

      // TypeScript should enforce these properties
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe("string");
      expect(result).not.toHaveProperty("data");
    });
  });
});

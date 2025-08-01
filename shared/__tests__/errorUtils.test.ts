import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createErrorResult, getErrorMessage, logError } from "../errorUtils";

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
        success: false,
        error: "Database connection failed",
      });
    });

    it("should create error result with prefix", () => {
      const error = new Error("Connection timeout");
      const result = createErrorResult(error, "Database operation");

      expect(result).toEqual({
        success: false,
        error: "Database operation: Connection timeout",
      });
    });

    it("should handle non-Error objects without prefix", () => {
      const result = createErrorResult("File not found");

      expect(result).toEqual({
        success: false,
        error: "File not found",
      });
    });

    it("should handle non-Error objects with prefix", () => {
      const result = createErrorResult("Invalid format", "File parsing");

      expect(result).toEqual({
        success: false,
        error: "File parsing: Invalid format",
      });
    });

    it("should handle null errors", () => {
      const result = createErrorResult(null, "Operation");

      expect(result).toEqual({
        success: false,
        error: "Operation: null",
      });
    });

    it("should handle undefined errors", () => {
      const result = createErrorResult(undefined);

      expect(result).toEqual({
        success: false,
        error: "undefined",
      });
    });

    it("should handle numeric errors with prefix", () => {
      const result = createErrorResult(500, "HTTP Status");

      expect(result).toEqual({
        success: false,
        error: "HTTP Status: 500",
      });
    });

    it("should handle boolean errors", () => {
      const result = createErrorResult(false, "Validation");

      expect(result).toEqual({
        success: false,
        error: "Validation: false",
      });
    });

    it("should handle object errors", () => {
      const errorObj = { code: "ERR001", details: "Invalid input" };
      const result = createErrorResult(errorObj, "API Call");

      expect(result).toEqual({
        success: false,
        error: "API Call: [object Object]",
      });
    });

    it("should handle empty prefix", () => {
      const error = new Error("Test error");
      const result = createErrorResult(error, "");

      expect(result).toEqual({
        success: false,
        error: "Test error",
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

  describe("logError", () => {
    beforeEach(() => {
      // Mock console.error
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should log Error instances with message and stack", () => {
      const error = new Error("Database connection failed");
      error.stack = "Error: Database connection failed\n    at test.js:1:1";

      logError(error, "Database Service");

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenNthCalledWith(
        1,
        "[Database Service] Error: Database connection failed",
      );
      expect(console.error).toHaveBeenNthCalledWith(
        2,
        "[Database Service] Stack: Error: Database connection failed\n    at test.js:1:1",
      );
    });

    it("should log Error instances without stack when stack is undefined", () => {
      const error = new Error("Simple error");
      error.stack = undefined;

      logError(error, "Test Context");

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        "[Test Context] Error: Simple error",
      );
    });

    it("should log Error instances without stack when stack is empty", () => {
      const error = new Error("Empty stack error");
      error.stack = "";

      logError(error, "Test Context");

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        "[Test Context] Error: Empty stack error",
      );
    });

    it("should log non-Error objects without stack", () => {
      logError("Simple string error", "File Service");

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        "[File Service] Error: Simple string error",
      );
    });

    it("should log null errors", () => {
      logError(null, "Null Handler");

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith("[Null Handler] Error: null");
    });

    it("should log undefined errors", () => {
      logError(undefined, "Undefined Handler");

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        "[Undefined Handler] Error: undefined",
      );
    });

    it("should log numeric errors", () => {
      logError(404, "HTTP Client");

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith("[HTTP Client] Error: 404");
    });

    it("should log boolean errors", () => {
      logError(false, "Boolean Context");

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        "[Boolean Context] Error: false",
      );
    });

    it("should log object errors", () => {
      const errorObj = { status: 500, message: "Internal error" };
      logError(errorObj, "Object Handler");

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(
        "[Object Handler] Error: [object Object]",
      );
    });

    it("should handle custom Error subclasses with stack", () => {
      class NetworkError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "NetworkError";
        }
      }

      const error = new NetworkError("Connection refused");
      error.stack = "NetworkError: Connection refused\n    at network.js:25:10";

      logError(error, "Network Service");

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenNthCalledWith(
        1,
        "[Network Service] Error: Connection refused",
      );
      expect(console.error).toHaveBeenNthCalledWith(
        2,
        "[Network Service] Stack: NetworkError: Connection refused\n    at network.js:25:10",
      );
    });

    it("should handle TypeError instances", () => {
      const error = new TypeError("Cannot read property 'x' of null");
      error.stack =
        "TypeError: Cannot read property 'x' of null\n    at app.js:10:5";

      logError(error, "Type Validation");

      expect(console.error).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenNthCalledWith(
        1,
        "[Type Validation] Error: Cannot read property 'x' of null",
      );
      expect(console.error).toHaveBeenNthCalledWith(
        2,
        "[Type Validation] Stack: TypeError: Cannot read property 'x' of null\n    at app.js:10:5",
      );
    });

    it("should handle empty context string", () => {
      const error = new Error("Test error");

      logError(error, "");

      expect(console.error).toHaveBeenCalledWith("[] Error: Test error");
    });

    it("should handle context with special characters", () => {
      const error = new Error("Special char test");

      logError(error, "Service-Name [v1.0.0]");

      expect(console.error).toHaveBeenCalledWith(
        "[Service-Name [v1.0.0]] Error: Special char test",
      );
    });
  });

  describe("Integration Tests", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should work together in a typical error handling flow", () => {
      const originalError = new Error("Original database error");
      originalError.stack =
        "Error: Original database error\n    at db.js:42:15";

      // Get message
      const message = getErrorMessage(originalError);
      expect(message).toBe("Original database error");

      // Create error result
      const errorResult = createErrorResult(originalError, "Database Query");
      expect(errorResult).toEqual({
        success: false,
        error: "Database Query: Original database error",
      });

      // Log the error
      logError(originalError, "Database Service");
      expect(console.error).toHaveBeenCalledTimes(2);
    });

    it("should handle error transformation chain", () => {
      const initialError = "Network timeout";

      // Transform string to error result
      const errorResult = createErrorResult(initialError, "API Call");
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBe("API Call: Network timeout");

      // Extract message from error string
      const extractedMessage = getErrorMessage(errorResult.error);
      expect(extractedMessage).toBe("API Call: Network timeout");

      // Log the final error
      logError(extractedMessage, "Error Handler");
      expect(console.error).toHaveBeenCalledWith(
        "[Error Handler] Error: API Call: Network timeout",
      );
    });

    it("should maintain consistency across all functions with same input", () => {
      const testInputs = [
        new Error("Test error"),
        "String error",
        null,
        undefined,
        404,
        false,
        { error: "object" },
      ];

      testInputs.forEach((input) => {
        const message = getErrorMessage(input);
        const errorResult = createErrorResult(input, "Test");

        // The base message should be consistent
        expect(errorResult.error).toBe(`Test: ${message}`);

        // Logging should use the same message format
        logError(input, "Test Context");
        expect(console.error).toHaveBeenCalledWith(
          `[Test Context] Error: ${message}`,
        );
      });
    });
  });
});

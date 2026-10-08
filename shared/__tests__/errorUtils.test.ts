import { beforeEach, describe, expect, it, vi } from "vitest";

import { getErrorMessage } from "../errorUtils";

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
});

import { toast } from "sonner";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// Mock shared error utils
vi.mock("@romper/shared/errorUtils.js", () => ({
  getErrorMessage: vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    return String(error);
  }),
}));

import {
  ApiValidation,
  executeAsyncOperation,
  KitDataErrorHandler,
  KitErrorHandlers,
  KitErrorPatterns,
} from "../kitDataErrorHandling";

describe("Kit Data Error Handling - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("KitDataErrorHandler", () => {
    const handler = new KitDataErrorHandler("TestContext");

    test("should handle API errors with all options", () => {
      const error = new Error("Test API error");

      const result = handler.handleApiError(error, "test operation", {
        defaultValue: "fallback",
        showToast: true,
        silent: false,
      });

      expect(result).toEqual({
        data: "fallback",
        error: "Failed to test operation: Test API error",
        success: false,
      });

      expect(console.error).toHaveBeenCalledWith(
        "[TestContext] Failed to test operation: Test API error",
        error,
      );

      expect(toast.error).toHaveBeenCalledWith("Kit test operation failed", {
        description: "Test API error",
        duration: 5000,
      });
    });

    test("should handle API errors silently", () => {
      const error = new Error("Silent error");

      const result = handler.handleApiError(error, "silent operation", {
        showToast: false,
        silent: true,
      });

      expect(result.success).toBe(false);
      expect(console.error).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    test("should handle sample load errors", () => {
      const error = new Error("Sample load failed");

      const result = handler.handleSampleLoadError(error, "TestKit");

      expect(result).toEqual({ 1: [], 2: [], 3: [], 4: [] });
      expect(console.error).toHaveBeenCalledWith(
        "Error loading samples for kit TestKit:",
        error,
      );
    });

    test("should handle sample load errors silently", () => {
      const error = new Error("Silent sample error");

      const result = handler.handleSampleLoadError(error, "TestKit", true);

      expect(result).toEqual({ 1: [], 2: [], 3: [], 4: [] });
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should handle successful database results", () => {
      const result = handler.handleDbResult(
        { data: "success data", success: true },
        "test operation",
        "fallback",
      );

      expect(result).toBe("success data");
    });

    test("should handle failed database results", () => {
      const result = handler.handleDbResult(
        { error: "DB error", success: false },
        "test operation",
        "fallback",
      );

      expect(result).toBe("fallback");
      expect(console.error).toHaveBeenCalledWith(
        "[TestContext] Failed to test operation:",
        "DB error",
      );
    });

    test("should handle undefined database results", () => {
      const result = handler.handleDbResult(
        undefined,
        "test operation",
        "fallback",
      );

      expect(result).toBe("fallback");
      expect(console.error).toHaveBeenCalledWith(
        "[TestContext] Failed to test operation:",
        "Unknown database error",
      );
    });

    test("should wrap async operations successfully", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await handler.withErrorHandling(
        operation,
        "test operation",
        "fallback",
      );

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    test("should wrap async operations with error", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Async error"));

      const result = await handler.withErrorHandling(
        operation,
        "test operation",
        "fallback",
      );

      expect(result).toBe("fallback");
      expect(console.error).toHaveBeenCalledWith(
        "[TestContext] Error test operation:",
        expect.any(Error),
      );
    });

    test("should wrap async operations with rethrow", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Async error"));

      await expect(
        handler.withErrorHandling(operation, "test operation", "fallback", {
          rethrow: true,
        }),
      ).rejects.toThrow("Async error");
    });

    test("should wrap async operations silently", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Silent error"));

      const result = await handler.withErrorHandling(
        operation,
        "test operation",
        "fallback",
        { silent: true },
      );

      expect(result).toBe("fallback");
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("KitErrorHandlers", () => {
    test("should provide specialized handlers for different contexts", () => {
      expect(KitErrorHandlers.metadata).toBeInstanceOf(KitDataErrorHandler);
      expect(KitErrorHandlers.samples).toBeInstanceOf(KitDataErrorHandler);
      expect(KitErrorHandlers.favorites).toBeInstanceOf(KitDataErrorHandler);
      expect(KitErrorHandlers.sync).toBeInstanceOf(KitDataErrorHandler);
    });
  });

  describe("KitErrorPatterns", () => {
    test("should handle kit loading errors", () => {
      const error = new Error("Loading error");

      const result = KitErrorPatterns.kitLoading(error);

      expect(result).toEqual({ kits: [], samples: {} });
      expect(console.error).toHaveBeenCalledWith(
        "Error loading data from database:",
        error,
      );
    });

    test("should handle favorite toggle errors", () => {
      const error = new Error("Toggle error");

      const result = KitErrorPatterns.favoriteToggle(error, "TestKit");

      expect(result).toEqual({ success: false });
      expect(console.error).toHaveBeenCalledWith(
        "Error toggling kit favorite for TestKit:",
        error,
      );
    });

    test("should handle kit update errors with rethrowing", () => {
      const error = new Error("Update error");

      expect(() => {
        KitErrorPatterns.kitUpdate(error, "updating kit");
      }).toThrow("Update error");

      expect(console.error).toHaveBeenCalledWith("Error updating kit:", error);
    });

    test("should handle successful API validation", () => {
      expect(() => {
        KitErrorPatterns.apiValidation(
          { data: "test", success: true },
          "test operation",
        );
      }).not.toThrow();
    });

    test("should handle failed API validation", () => {
      expect(() => {
        KitErrorPatterns.apiValidation(
          { error: "Validation failed", success: false },
          "test operation",
        );
      }).toThrow("Validation failed");
    });

    test("should handle missing API validation", () => {
      expect(() => {
        KitErrorPatterns.apiValidation(null, "test operation");
      }).toThrow("Failed to test operation");
    });
  });

  describe("executeAsyncOperation", () => {
    test("should execute successful operation", async () => {
      const operation = vi.fn().mockResolvedValue("success data");
      const onSuccess = vi.fn();

      const result = await executeAsyncOperation({
        onSuccess,
        operation,
      });

      expect(result).toEqual({
        data: "success data",
        success: true,
      });
      expect(onSuccess).toHaveBeenCalledWith("success data");
    });

    test("should execute failed operation", async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new Error("Operation failed"));
      const onError = vi.fn();

      const result = await executeAsyncOperation({
        onError,
        operation,
      });

      expect(result).toEqual({
        error: "Operation failed",
        success: false,
      });
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(console.error).toHaveBeenCalled();
    });

    test("should execute with error handler", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Handler error"));
      const errorHandler = new KitDataErrorHandler("TestHandler");

      const result = await executeAsyncOperation({
        errorHandler,
        operation,
        operationName: "test operation",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to test operation");
    });

    test("should execute silently", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Silent error"));

      const result = await executeAsyncOperation({
        operation,
        silent: true,
      });

      expect(result.success).toBe(false);
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("ApiValidation", () => {
    test("should validate successful response", () => {
      const response = { data: "test data", success: true };

      const result = ApiValidation.validateResponse(response, "test operation");

      expect(result).toEqual({
        data: "test data",
        success: true,
      });
    });

    test("should validate failed response", () => {
      const response = { error: "Test error", success: false };

      const result = ApiValidation.validateResponse(response, "test operation");

      expect(result).toEqual({
        error: "Test error",
        success: false,
      });
    });

    test("should validate response without success field", () => {
      const response = { data: "direct data" };

      const result = ApiValidation.validateResponse(response, "test operation");

      expect(result).toEqual({
        data: "direct data",
        success: true,
      });
    });

    test("should handle null response", () => {
      const result = ApiValidation.validateResponse(null, "test operation");

      expect(result).toEqual({
        error: "No response from test operation",
        success: false,
      });
    });

    test("should check valid API method", () => {
      const validMethod = vi.fn();

      expect(() => {
        ApiValidation.checkApiMethod(validMethod, "testMethod");
      }).not.toThrow();
    });

    test("should check invalid API method", () => {
      expect(() => {
        ApiValidation.checkApiMethod(null, "testMethod");
      }).toThrow("testMethod API method not available");
    });

    test("should check non-function API method", () => {
      expect(() => {
        ApiValidation.checkApiMethod("not a function", "testMethod");
      }).toThrow("testMethod API method not available");
    });
  });
});

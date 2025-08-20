import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDbHandler,
  createSampleOperationHandler,
  validateAndGetDbDir,
} from "../ipcHandlerUtils";

// Mock path module
vi.mock("path");

// Mock sample service
vi.mock("../../services/sampleService.js", () => ({
  sampleService: {
    addSampleToSlot: vi.fn(),
    deleteSampleFromSlot: vi.fn(),
    replaceSampleInSlot: vi.fn(),
  },
}));

import { sampleService } from "../../services/sampleService.js";

describe("ipcHandlerUtils", () => {
  let mockInMemorySettings: Record<string, unknown>;
  let mockEvent: unknown;

  beforeEach(() => {
    vi.clearAllMocks();

    mockInMemorySettings = {
      localStorePath: "/test/local/store",
    };

    mockEvent = {};

    // Mock path.join
    vi.mocked(path.join).mockImplementation((...segments) =>
      segments.join("/"),
    );
  });

  describe("validateAndGetDbDir", () => {
    it("should return database directory when local store path is configured", () => {
      const result = validateAndGetDbDir(mockInMemorySettings);

      expect(result.success).toBe(true);
      expect(result.dbDir).toBe("/test/local/store/.romperdb");
      expect(result.error).toBeUndefined();
      expect(path.join).toHaveBeenCalledWith("/test/local/store", ".romperdb");
    });

    it("should return error when local store path is not configured", () => {
      const settingsWithoutPath = {};

      const result = validateAndGetDbDir(settingsWithoutPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
      expect(result.dbDir).toBeUndefined();
    });

    it("should return error when local store path is null", () => {
      const settingsWithNullPath = { localStorePath: null };

      const result = validateAndGetDbDir(settingsWithNullPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });

    it("should return error when local store path is empty string", () => {
      const settingsWithEmptyPath = { localStorePath: "" };

      const result = validateAndGetDbDir(settingsWithEmptyPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No local store path configured");
    });
  });

  describe("createDbHandler", () => {
    it("should create a handler that validates database directory", async () => {
      const mockHandler = vi
        .fn()
        .mockResolvedValue({ data: "test", success: true });
      const wrappedHandler = createDbHandler(mockInMemorySettings, mockHandler);

      const result = await wrappedHandler(mockEvent, "arg1", "arg2");

      expect(result).toEqual({ data: "test", success: true });
      expect(mockHandler).toHaveBeenCalledWith(
        "/test/local/store/.romperdb",
        "arg1",
        "arg2",
      );
    });

    it("should return error when database directory validation fails", async () => {
      const mockHandler = vi.fn();
      const settingsWithoutPath = {};
      const wrappedHandler = createDbHandler(settingsWithoutPath, mockHandler);

      const result = await wrappedHandler(mockEvent, "arg1", "arg2");

      expect(result).toEqual({
        error: "No local store path configured",
        success: false,
      });
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it("should handle synchronous handlers", async () => {
      const mockHandler = vi
        .fn()
        .mockReturnValue({ data: "sync", success: true });
      const wrappedHandler = createDbHandler(mockInMemorySettings, mockHandler);

      const result = await wrappedHandler(mockEvent, "arg1");

      expect(result).toEqual({ data: "sync", success: true });
      expect(mockHandler).toHaveBeenCalledWith(
        "/test/local/store/.romperdb",
        "arg1",
      );
    });

    it("should handle handlers that throw errors", async () => {
      const mockHandler = vi.fn().mockImplementation(() => {
        throw new Error("Handler error");
      });
      const wrappedHandler = createDbHandler(mockInMemorySettings, mockHandler);

      await expect(wrappedHandler(mockEvent, "arg1")).rejects.toThrow(
        "Handler error",
      );
    });
  });

  describe("createSampleOperationHandler", () => {
    const kitName = "TestKit";
    const voiceNumber = 1;
    const slotNumber = 0;
    const filePath = "/test/sample.wav";
    const options = { forceMono: true };

    describe("add operation", () => {
      it("should handle successful add operation", async () => {
        const mockResult = { data: { sampleId: 123 }, success: true };
        vi.mocked(sampleService.addSampleToSlot).mockReturnValue(mockResult);

        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "add",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
          filePath,
          options,
        );

        expect(result).toEqual(mockResult);
        expect(sampleService.addSampleToSlot).toHaveBeenCalledWith(
          mockInMemorySettings,
          kitName,
          voiceNumber,
          slotNumber,
          filePath,
          options,
        );
      });

      it("should return error when file path is missing for add operation", async () => {
        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "add",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
        );

        expect(result).toEqual({
          error: "File path required for add operation",
          success: false,
        });
        expect(sampleService.addSampleToSlot).not.toHaveBeenCalled();
      });

      it("should handle add operation service errors", async () => {
        vi.mocked(sampleService.addSampleToSlot).mockImplementation(() => {
          throw new Error("Service error");
        });

        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "add",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
          filePath,
        );

        expect(result).toEqual({
          error: "Failed to perform sample operation: Service error",
          success: false,
        });
      });
    });

    describe("delete operation", () => {
      it("should handle successful delete operation", async () => {
        const mockResult = { data: { deletedSamples: [] }, success: true };
        vi.mocked(sampleService.deleteSampleFromSlot).mockReturnValue(
          mockResult,
        );

        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "delete",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
        );

        expect(result).toEqual(mockResult);
        expect(sampleService.deleteSampleFromSlot).toHaveBeenCalledWith(
          mockInMemorySettings,
          kitName,
          voiceNumber,
          slotNumber,
        );
      });

      it("should handle delete operation service errors", async () => {
        vi.mocked(sampleService.deleteSampleFromSlot).mockImplementation(() => {
          throw new Error("Delete failed");
        });

        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "delete",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
        );

        expect(result).toEqual({
          error: "Failed to perform sample operation: Delete failed",
          success: false,
        });
      });
    });

    describe("replace operation", () => {
      it("should handle successful replace operation", async () => {
        const mockResult = { data: { sampleId: 456 }, success: true };
        vi.mocked(sampleService.replaceSampleInSlot).mockReturnValue(
          mockResult,
        );

        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "replace",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
          filePath,
          options,
        );

        expect(result).toEqual(mockResult);
        expect(sampleService.replaceSampleInSlot).toHaveBeenCalledWith(
          mockInMemorySettings,
          kitName,
          voiceNumber,
          slotNumber,
          filePath,
          options,
        );
      });

      it("should return error when file path is missing for replace operation", async () => {
        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "replace",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
        );

        expect(result).toEqual({
          error: "File path required for replace operation",
          success: false,
        });
        expect(sampleService.replaceSampleInSlot).not.toHaveBeenCalled();
      });

      it("should handle replace operation service errors", async () => {
        vi.mocked(sampleService.replaceSampleInSlot).mockImplementation(() => {
          throw new Error("Replace failed");
        });

        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "replace",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
          filePath,
        );

        expect(result).toEqual({
          error: "Failed to perform sample operation: Replace failed",
          success: false,
        });
      });
    });

    describe("unknown operation", () => {
      it("should return error for unknown operation type", async () => {
        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "unknown" as unknown,
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
          filePath,
        );

        expect(result).toEqual({
          error: "Unknown operation type",
          success: false,
        });
      });
    });

    describe("error handling", () => {
      it("should handle non-Error exceptions", async () => {
        vi.mocked(sampleService.addSampleToSlot).mockImplementation(() => {
          throw "String error";
        });

        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "add",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
          filePath,
        );

        expect(result).toEqual({
          error: "Failed to perform sample operation: String error",
          success: false,
        });
      });

      it("should handle null/undefined exceptions", async () => {
        vi.mocked(sampleService.addSampleToSlot).mockImplementation(() => {
          throw null;
        });

        const handler = createSampleOperationHandler(
          mockInMemorySettings,
          "add",
        );
        const result = await handler(
          mockEvent,
          kitName,
          voiceNumber,
          slotNumber,
          filePath,
        );

        expect(result).toEqual({
          error: "Failed to perform sample operation: null",
          success: false,
        });
      });
    });
  });
});

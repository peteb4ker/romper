import * as fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
  };
});

vi.mock("../../audioUtils.js", () => ({
  validateSampleFormat: vi.fn(),
}));

import { validateSampleFormat } from "../../audioUtils.js";
import { syncValidationService } from "../syncValidationService.js";

const mockFs = vi.mocked(fs);
const mockValidateSampleFormat = vi.mocked(validateSampleFormat);

describe("SyncValidationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateSyncSourceFile", () => {
    it("should return invalid result when file does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);
      const validationErrors: unknown[] = [];

      const result = syncValidationService.validateSyncSourceFile(
        "test.wav",
        "/path/to/test.wav",
        validationErrors,
      );

      expect(result.isValid).toBe(false);
      expect(result.fileSize).toBe(0);
      expect(validationErrors).toHaveLength(1);
      expect(validationErrors[0]).toEqual({
        error: "Source file not found: /path/to/test.wav",
        filename: "test.wav",
        sourcePath: "/path/to/test.wav",
        type: "missing_file",
      });
    });

    it("should return valid result with file size when file exists", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 1024 } as unknown);
      const validationErrors: unknown[] = [];

      const result = syncValidationService.validateSyncSourceFile(
        "test.wav",
        "/path/to/test.wav",
        validationErrors,
      );

      expect(result.isValid).toBe(true);
      expect(result.fileSize).toBe(1024);
      expect(validationErrors).toHaveLength(0);
    });
  });

  describe("validateSampleFormat", () => {
    it("should delegate to audioUtils validateSampleFormat", () => {
      const mockResult = { data: { issues: [] }, success: true };
      mockValidateSampleFormat.mockReturnValue(mockResult);

      const result =
        syncValidationService.validateSampleFormat("/path/to/test.wav");

      expect(mockValidateSampleFormat).toHaveBeenCalledWith(
        "/path/to/test.wav",
      );
      expect(result).toBe(mockResult);
    });
  });

  describe("categorizeError", () => {
    it("should categorize network errors", () => {
      const error = new Error("Network timeout occurred");

      const result = syncValidationService.categorizeError(error, "/test.wav");

      expect(result.type).toBe("network");
      expect(result.canRetry).toBe(true);
      expect(result.userMessage).toContain("Network error occurred");
      expect(result.userMessage).toContain("/test.wav");
    });

    it("should categorize permission errors", () => {
      const error = new Error("Permission denied");

      const result = syncValidationService.categorizeError(error);

      expect(result.type).toBe("permission");
      expect(result.canRetry).toBe(true);
      expect(result.userMessage).toContain("Permission denied");
    });

    it("should categorize disk space errors", () => {
      const error = new Error("No space left on device");

      const result = syncValidationService.categorizeError(error);

      expect(result.type).toBe("disk_space");
      expect(result.canRetry).toBe(false);
      expect(result.userMessage).toContain("Insufficient disk space");
    });

    it("should categorize file access errors", () => {
      const error = new Error("No such file or directory");

      const result = syncValidationService.categorizeError(error);

      expect(result.type).toBe("file_access");
      expect(result.canRetry).toBe(false);
      expect(result.userMessage).toContain("File not found");
    });

    it("should categorize format errors", () => {
      const error = new Error("Invalid format detected");

      const result = syncValidationService.categorizeError(error);

      expect(result.type).toBe("format_error");
      expect(result.canRetry).toBe(false);
      expect(result.userMessage).toContain("Unsupported audio format");
    });

    it("should categorize unknown errors", () => {
      const error = new Error("Something unexpected happened");

      const result = syncValidationService.categorizeError(error, "/test.wav");

      expect(result.type).toBe("unknown");
      expect(result.canRetry).toBe(true);
      expect(result.userMessage).toContain("An unexpected error occurred");
      expect(result.userMessage).toContain("/test.wav");
    });

    it("should handle string errors", () => {
      const error = "String error message";

      const result = syncValidationService.categorizeError(error);

      expect(result.type).toBe("unknown");
      expect(result.userMessage).toContain("String error message");
    });
  });

  describe("addValidationError", () => {
    it("should add permission error with correct type", () => {
      const validationErrors: unknown[] = [];
      const error = new Error("Permission denied");

      syncValidationService.addValidationError(
        validationErrors,
        "test.wav",
        "/path/test.wav",
        error,
      );

      expect(validationErrors).toHaveLength(1);
      expect(validationErrors[0].type).toBe("access_denied");
      expect(validationErrors[0].filename).toBe("test.wav");
      expect(validationErrors[0].sourcePath).toBe("/path/test.wav");
    });

    it("should add format error with correct type", () => {
      const validationErrors: unknown[] = [];
      const error = new Error("Invalid format");

      syncValidationService.addValidationError(
        validationErrors,
        "test.wav",
        "/path/test.wav",
        error,
      );

      expect(validationErrors).toHaveLength(1);
      expect(validationErrors[0].type).toBe("invalid_format");
    });

    it("should add file access error with correct type", () => {
      const validationErrors: unknown[] = [];
      const error = new Error("No such file");

      syncValidationService.addValidationError(
        validationErrors,
        "test.wav",
        "/path/test.wav",
        error,
      );

      expect(validationErrors).toHaveLength(1);
      expect(validationErrors[0].type).toBe("missing_file");
    });

    it("should add unknown error with correct type", () => {
      const validationErrors: unknown[] = [];
      const error = new Error("Unknown error");

      syncValidationService.addValidationError(
        validationErrors,
        "test.wav",
        "/path/test.wav",
        error,
      );

      expect(validationErrors).toHaveLength(1);
      expect(validationErrors[0].type).toBe("other");
    });
  });
});

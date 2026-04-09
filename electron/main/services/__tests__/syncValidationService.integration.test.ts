import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type SyncValidationError,
  SyncValidationService,
} from "../syncValidationService.js";

// Test utilities
const TEST_DIR = path.join(__dirname, "test-data-sync-val");

describe("SyncValidationService Integration Tests", () => {
  let service: SyncValidationService;
  let testFilesDir: string;

  beforeEach(() => {
    service = new SyncValidationService();

    // Create test directory for real file operations
    testFilesDir = path.join(TEST_DIR, "test-files");
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { force: true, recursive: true });
    }
  });

  describe("validateSyncSourceFile with real filesystem", () => {
    it("should validate an existing file and return its actual size", () => {
      const testContent = "test audio content for size check";
      const filePath = path.join(testFilesDir, "existing.wav");
      fs.writeFileSync(filePath, testContent);

      const validationErrors: SyncValidationError[] = [];
      const result = service.validateSyncSourceFile(
        "existing.wav",
        filePath,
        validationErrors,
      );

      expect(result.isValid).toBe(true);
      expect(result.fileSize).toBe(Buffer.byteLength(testContent));
      expect(validationErrors).toHaveLength(0);
    });

    it("should return invalid for a non-existent file", () => {
      const filePath = path.join(testFilesDir, "does-not-exist.wav");

      const validationErrors: SyncValidationError[] = [];
      const result = service.validateSyncSourceFile(
        "does-not-exist.wav",
        filePath,
        validationErrors,
      );

      expect(result.isValid).toBe(false);
      expect(result.fileSize).toBe(0);
      expect(validationErrors).toHaveLength(1);
      expect(validationErrors[0].type).toBe("missing_file");
      expect(validationErrors[0].filename).toBe("does-not-exist.wav");
      expect(validationErrors[0].sourcePath).toBe(filePath);
      expect(validationErrors[0].error).toContain("Source file not found");
    });

    it("should validate a zero-byte file as valid (file exists)", () => {
      const filePath = path.join(testFilesDir, "empty.wav");
      fs.writeFileSync(filePath, "");

      const validationErrors: SyncValidationError[] = [];
      const result = service.validateSyncSourceFile(
        "empty.wav",
        filePath,
        validationErrors,
      );

      expect(result.isValid).toBe(true);
      expect(result.fileSize).toBe(0);
      expect(validationErrors).toHaveLength(0);
    });

    it("should validate multiple files accumulating errors for missing ones", () => {
      const existingPath = path.join(testFilesDir, "good.wav");
      fs.writeFileSync(existingPath, "audio data");

      const missingPath1 = path.join(testFilesDir, "missing1.wav");
      const missingPath2 = path.join(testFilesDir, "missing2.wav");

      const validationErrors: SyncValidationError[] = [];

      const result1 = service.validateSyncSourceFile(
        "good.wav",
        existingPath,
        validationErrors,
      );
      const result2 = service.validateSyncSourceFile(
        "missing1.wav",
        missingPath1,
        validationErrors,
      );
      const result3 = service.validateSyncSourceFile(
        "missing2.wav",
        missingPath2,
        validationErrors,
      );

      expect(result1.isValid).toBe(true);
      expect(result2.isValid).toBe(false);
      expect(result3.isValid).toBe(false);
      expect(validationErrors).toHaveLength(2);
      expect(validationErrors[0].filename).toBe("missing1.wav");
      expect(validationErrors[1].filename).toBe("missing2.wav");
    });

    it("should correctly report file size for a known-size file", () => {
      const filePath = path.join(testFilesDir, "sized.wav");
      const buffer = Buffer.alloc(1024); // Exactly 1024 bytes
      fs.writeFileSync(filePath, buffer);

      const validationErrors: SyncValidationError[] = [];
      const result = service.validateSyncSourceFile(
        "sized.wav",
        filePath,
        validationErrors,
      );

      expect(result.isValid).toBe(true);
      expect(result.fileSize).toBe(1024);
    });
  });

  describe("categorizeError with real Error objects", () => {
    it("should categorize ENOENT error as file_access", () => {
      // Create a real ENOENT error by trying to stat a non-existent file
      let realError: unknown;
      try {
        fs.statSync(path.join(testFilesDir, "nonexistent-file-xyz.wav"));
      } catch (e) {
        realError = e;
      }

      expect(realError).toBeDefined();
      const result = service.categorizeError(realError, "/test/file.wav");

      expect(result.type).toBe("file_access");
      expect(result.canRetry).toBe(false);
      expect(result.userMessage).toContain("File not found");
      expect(result.userMessage).toContain("/test/file.wav");
    });

    it("should categorize EACCES error string as permission", () => {
      const error = new Error("EACCES: permission denied, open '/test/file'");
      const result = service.categorizeError(error, "/test/file");

      expect(result.type).toBe("permission");
      expect(result.canRetry).toBe(true);
    });

    it("should categorize ENOSPC error string as disk_space", () => {
      const error = new Error("ENOSPC: no space left on device");
      const result = service.categorizeError(error);

      expect(result.type).toBe("disk_space");
      expect(result.canRetry).toBe(false);
      expect(result.userMessage).toContain("Insufficient disk space");
    });

    it("should include filePath in message when provided", () => {
      const error = new Error("connection reset");
      const result = service.categorizeError(error, "/music/kick.wav");

      expect(result.type).toBe("network");
      expect(result.userMessage).toContain("/music/kick.wav");
    });

    it("should omit filePath from message when not provided", () => {
      const error = new Error("connection timeout");
      const result = service.categorizeError(error);

      expect(result.type).toBe("network");
      expect(result.userMessage).not.toContain("undefined");
    });

    it("should handle non-Error values gracefully", () => {
      const result1 = service.categorizeError(42);
      expect(result1.type).toBe("unknown");
      expect(result1.userMessage).toContain("42");

      const result2 = service.categorizeError(null);
      expect(result2.type).toBe("unknown");

      const result3 = service.categorizeError(undefined);
      expect(result3.type).toBe("unknown");
    });

    it("should categorize codec errors as format_error", () => {
      const error = new Error("Unsupported codec in file");
      const result = service.categorizeError(error, "/test/file.ogg");

      expect(result.type).toBe("format_error");
      expect(result.canRetry).toBe(false);
    });
  });

  describe("addValidationError integration", () => {
    it("should categorize and push a file_access error as missing_file", () => {
      const validationErrors: SyncValidationError[] = [];

      // Use a real ENOENT error
      let realError: unknown;
      try {
        fs.readFileSync(path.join(testFilesDir, "ghost.wav"));
      } catch (e) {
        realError = e;
      }

      service.addValidationError(
        validationErrors,
        "ghost.wav",
        "/samples/ghost.wav",
        realError,
      );

      expect(validationErrors).toHaveLength(1);
      expect(validationErrors[0].type).toBe("missing_file");
      expect(validationErrors[0].filename).toBe("ghost.wav");
      expect(validationErrors[0].sourcePath).toBe("/samples/ghost.wav");
      expect(validationErrors[0].error).toContain("File not found");
    });

    it("should accumulate multiple errors of different types", () => {
      const validationErrors: SyncValidationError[] = [];

      service.addValidationError(
        validationErrors,
        "file1.wav",
        "/path/file1.wav",
        new Error("No such file or directory"),
      );

      service.addValidationError(
        validationErrors,
        "file2.wav",
        "/path/file2.wav",
        new Error("Permission denied"),
      );

      service.addValidationError(
        validationErrors,
        "file3.wav",
        "/path/file3.wav",
        new Error("Invalid format detected"),
      );

      service.addValidationError(
        validationErrors,
        "file4.wav",
        "/path/file4.wav",
        new Error("Something unexpected"),
      );

      expect(validationErrors).toHaveLength(4);
      expect(validationErrors[0].type).toBe("missing_file");
      expect(validationErrors[1].type).toBe("access_denied");
      expect(validationErrors[2].type).toBe("invalid_format");
      expect(validationErrors[3].type).toBe("other");
    });

    it("should map network errors to 'other' type", () => {
      const validationErrors: SyncValidationError[] = [];

      service.addValidationError(
        validationErrors,
        "remote.wav",
        "/path/remote.wav",
        new Error("Network timeout"),
      );

      expect(validationErrors).toHaveLength(1);
      // Network errors map to the default "other" type
      expect(validationErrors[0].type).toBe("other");
    });

    it("should map disk_space errors to 'other' type", () => {
      const validationErrors: SyncValidationError[] = [];

      service.addValidationError(
        validationErrors,
        "big.wav",
        "/path/big.wav",
        new Error("No space left on device"),
      );

      expect(validationErrors).toHaveLength(1);
      expect(validationErrors[0].type).toBe("other");
    });
  });

  describe("end-to-end: validate then add errors", () => {
    it("should validate files and accumulate errors for a batch of samples", () => {
      // Create some real files
      const existingPath1 = path.join(testFilesDir, "kick.wav");
      const existingPath2 = path.join(testFilesDir, "snare.wav");
      fs.writeFileSync(existingPath1, Buffer.alloc(512));
      fs.writeFileSync(existingPath2, Buffer.alloc(256));

      const validationErrors: SyncValidationError[] = [];

      // Validate existing files
      const result1 = service.validateSyncSourceFile(
        "kick.wav",
        existingPath1,
        validationErrors,
      );
      const result2 = service.validateSyncSourceFile(
        "snare.wav",
        existingPath2,
        validationErrors,
      );

      // Validate missing files
      const result3 = service.validateSyncSourceFile(
        "hat.wav",
        "/nonexistent/hat.wav",
        validationErrors,
      );

      // Add a manual error for a format issue
      service.addValidationError(
        validationErrors,
        "bad.wav",
        "/path/bad.wav",
        new Error("Unsupported format detected"),
      );

      // Verify results
      expect(result1.isValid).toBe(true);
      expect(result1.fileSize).toBe(512);
      expect(result2.isValid).toBe(true);
      expect(result2.fileSize).toBe(256);
      expect(result3.isValid).toBe(false);

      // Should have 2 errors: 1 missing file + 1 format error
      expect(validationErrors).toHaveLength(2);
      expect(validationErrors[0].type).toBe("missing_file");
      expect(validationErrors[0].filename).toBe("hat.wav");
      expect(validationErrors[1].type).toBe("invalid_format");
      expect(validationErrors[1].filename).toBe("bad.wav");
    });

    it("should handle validating a file that is deleted between checks", () => {
      const filePath = path.join(testFilesDir, "temporary.wav");
      fs.writeFileSync(filePath, "temp data");

      // First validation should pass
      const errors1: SyncValidationError[] = [];
      const result1 = service.validateSyncSourceFile(
        "temporary.wav",
        filePath,
        errors1,
      );
      expect(result1.isValid).toBe(true);
      expect(errors1).toHaveLength(0);

      // Delete the file
      fs.unlinkSync(filePath);

      // Second validation should fail
      const errors2: SyncValidationError[] = [];
      const result2 = service.validateSyncSourceFile(
        "temporary.wav",
        filePath,
        errors2,
      );
      expect(result2.isValid).toBe(false);
      expect(errors2).toHaveLength(1);
      expect(errors2[0].type).toBe("missing_file");
    });
  });
});

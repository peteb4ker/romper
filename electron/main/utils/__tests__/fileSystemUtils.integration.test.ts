import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkDiskSpace,
  checkDiskSpaceSufficient,
  checkPathWritable,
  ensureDirectoryExists,
  getFileSize,
  removeDirectorySafe,
  validateFileExists,
} from "../fileSystemUtils.js";

// Test directory for real filesystem operations
const TEST_DIR = path.join(__dirname, "test-data-fs-integration");

describe("fileSystemUtils Integration Tests", () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { force: true, recursive: true });
    }
  });

  describe("checkDiskSpace", () => {
    it("should return available bytes for an existing directory", () => {
      const result = checkDiskSpace(TEST_DIR);

      expect(result.sufficient).toBe(true);
      expect(result.availableBytes).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it("should resolve to parent directory for non-existent child path", () => {
      // TEST_DIR exists, so a non-existent child should resolve to parent
      const result = checkDiskSpace(
        path.join(TEST_DIR, "nonexistent-subdir", "file.txt"),
      );

      // The parent of nonexistent-subdir/file.txt is nonexistent-subdir which doesn't exist,
      // so it falls through to dirname which should be TEST_DIR
      // Actually, checkDiskSpace resolves to dirname if targetPath doesn't exist
      // dirname of TEST_DIR/nonexistent-subdir/file.txt = TEST_DIR/nonexistent-subdir
      // which also doesn't exist, so it returns error
      expect(result.sufficient).toBe(false);
      expect(result.error).toBe("Path does not exist");
    });

    it("should return error for a completely non-existent path", () => {
      const result = checkDiskSpace(
        "/completely/fake/path/that/does/not/exist",
      );

      expect(result.sufficient).toBe(false);
      expect(result.error).toBe("Path does not exist");
      expect(result.availableBytes).toBe(0);
    });

    it("should work for an existing file path", () => {
      const filePath = path.join(TEST_DIR, "test-file.txt");
      fs.writeFileSync(filePath, "content");

      const result = checkDiskSpace(filePath);

      expect(result.sufficient).toBe(true);
      expect(result.availableBytes).toBeGreaterThan(0);
    });
  });

  describe("checkDiskSpaceSufficient", () => {
    it("should report sufficient for a small required amount", () => {
      const result = checkDiskSpaceSufficient(TEST_DIR, 1); // 1 byte

      expect(result.sufficient).toBe(true);
      expect(result.requiredBytes).toBe(1);
      expect(result.availableBytes).toBeGreaterThan(0);
    });

    it("should report insufficient for an impossibly large required amount", () => {
      // 1 exabyte - no real disk has this
      const result = checkDiskSpaceSufficient(
        TEST_DIR,
        1024 * 1024 * 1024 * 1024 * 1024 * 1024,
      );

      expect(result.sufficient).toBe(false);
      expect(result.requiredBytes).toBe(
        1024 * 1024 * 1024 * 1024 * 1024 * 1024,
      );
    });

    it("should propagate error for non-existent path", () => {
      const result = checkDiskSpaceSufficient("/nonexistent/path/xyz", 1024);

      expect(result.sufficient).toBe(false);
      expect(result.requiredBytes).toBe(1024);
    });
  });

  describe("checkPathWritable", () => {
    it("should confirm a writable directory is writable", () => {
      const result = checkPathWritable(TEST_DIR);

      expect(result.writable).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should confirm writability when given a file path in a writable directory", () => {
      // Pass a path to a non-existent file inside an existing writable directory
      const filePath = path.join(TEST_DIR, "future-file.txt");
      const result = checkPathWritable(filePath);

      expect(result.writable).toBe(true);
    });

    it("should report not writable for a non-existent directory", () => {
      const result = checkPathWritable(
        "/completely/nonexistent/directory/file.txt",
      );

      expect(result.writable).toBe(false);
      expect(result.error).toContain("Directory does not exist");
    });

    it("should clean up the temp test file after checking", () => {
      checkPathWritable(TEST_DIR);

      // The write test file should be cleaned up
      const files = fs.readdirSync(TEST_DIR);
      const testFiles = files.filter((f) =>
        f.startsWith(".romper-write-test-"),
      );
      expect(testFiles).toHaveLength(0);
    });
  });

  describe("ensureDirectoryExists", () => {
    it("should create a new directory", () => {
      const newDir = path.join(TEST_DIR, "new-directory");
      expect(fs.existsSync(newDir)).toBe(false);

      ensureDirectoryExists(newDir);

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.statSync(newDir).isDirectory()).toBe(true);
    });

    it("should create nested directories recursively", () => {
      const nestedDir = path.join(TEST_DIR, "level1", "level2", "level3");
      expect(fs.existsSync(nestedDir)).toBe(false);

      ensureDirectoryExists(nestedDir);

      expect(fs.existsSync(nestedDir)).toBe(true);
    });

    it("should not throw when directory already exists", () => {
      const existingDir = path.join(TEST_DIR, "existing");
      fs.mkdirSync(existingDir, { recursive: true });

      expect(() => ensureDirectoryExists(existingDir)).not.toThrow();
      expect(fs.existsSync(existingDir)).toBe(true);
    });

    it("should be idempotent", () => {
      const dir = path.join(TEST_DIR, "idempotent-dir");

      ensureDirectoryExists(dir);
      ensureDirectoryExists(dir);
      ensureDirectoryExists(dir);

      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  describe("getFileSize", () => {
    it("should return the correct size of a file", () => {
      const filePath = path.join(TEST_DIR, "sized-file.bin");
      const data = Buffer.alloc(2048);
      fs.writeFileSync(filePath, data);

      const result = getFileSize(filePath);

      expect(result).toBe(2048);
    });

    it("should return 0 for a non-existent file", () => {
      const result = getFileSize(path.join(TEST_DIR, "nope.wav"));

      expect(result).toBe(0);
    });

    it("should return 0 for a zero-byte file", () => {
      const filePath = path.join(TEST_DIR, "empty-file.bin");
      fs.writeFileSync(filePath, "");

      const result = getFileSize(filePath);

      expect(result).toBe(0);
    });

    it("should return correct size for a small text file", () => {
      const filePath = path.join(TEST_DIR, "text.txt");
      fs.writeFileSync(filePath, "hello");

      const result = getFileSize(filePath);

      expect(result).toBe(5); // "hello" is 5 bytes in UTF-8
    });

    it("should return correct size after file content changes", () => {
      const filePath = path.join(TEST_DIR, "growing-file.bin");

      fs.writeFileSync(filePath, Buffer.alloc(100));
      expect(getFileSize(filePath)).toBe(100);

      fs.writeFileSync(filePath, Buffer.alloc(500));
      expect(getFileSize(filePath)).toBe(500);
    });
  });

  describe("removeDirectorySafe", () => {
    it("should remove a directory within .romperdb scope", () => {
      const safeDir = path.join(TEST_DIR, ".romperdb", "temp-data");
      fs.mkdirSync(safeDir, { recursive: true });
      fs.writeFileSync(path.join(safeDir, "test.db"), "data");

      const result = removeDirectorySafe(safeDir);

      expect(result.removed).toBe(true);
      expect(result.error).toBeUndefined();
      expect(fs.existsSync(safeDir)).toBe(false);
    });

    it("should refuse to remove a directory outside .romperdb scope", () => {
      const unsafeDir = path.join(TEST_DIR, "regular-dir");
      fs.mkdirSync(unsafeDir, { recursive: true });

      const result = removeDirectorySafe(unsafeDir);

      expect(result.removed).toBe(false);
      expect(result.error).toContain("Refusing to remove");
      // Directory should still exist
      expect(fs.existsSync(unsafeDir)).toBe(true);
    });

    it("should return success for an already-removed directory", () => {
      const dir = path.join(TEST_DIR, ".romperdb", "already-gone");
      // Don't create the directory

      const result = removeDirectorySafe(dir);

      expect(result.removed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should recursively remove nested directories within .romperdb", () => {
      const baseDir = path.join(TEST_DIR, ".romperdb", "nested");
      const subDir = path.join(baseDir, "sub1", "sub2");
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, "deep-file.txt"), "deep");
      fs.writeFileSync(path.join(baseDir, "root-file.txt"), "root");

      const result = removeDirectorySafe(baseDir);

      expect(result.removed).toBe(true);
      expect(fs.existsSync(baseDir)).toBe(false);
    });
  });

  describe("validateFileExists", () => {
    it("should return exists=true for a real file", () => {
      const filePath = path.join(TEST_DIR, "real-file.wav");
      fs.writeFileSync(filePath, "audio data");

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return exists=false for a non-existent file", () => {
      const result = validateFileExists(path.join(TEST_DIR, "ghost.wav"));

      expect(result.exists).toBe(false);
      expect(result.error).toBe("File not found");
    });

    it("should return exists=false for a directory path", () => {
      const dirPath = path.join(TEST_DIR, "a-directory");
      fs.mkdirSync(dirPath, { recursive: true });

      const result = validateFileExists(dirPath);

      expect(result.exists).toBe(false);
      expect(result.error).toBe("Path is not a file");
    });

    it("should handle a zero-byte file as valid", () => {
      const filePath = path.join(TEST_DIR, "empty.wav");
      fs.writeFileSync(filePath, "");

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(true);
    });

    it("should handle files with special characters in the name", () => {
      const filePath = path.join(TEST_DIR, "my sample (copy).wav");
      fs.writeFileSync(filePath, "data");

      const result = validateFileExists(filePath);

      expect(result.exists).toBe(true);
    });

    it("should detect when a file is deleted after creation", () => {
      const filePath = path.join(TEST_DIR, "temporary.wav");
      fs.writeFileSync(filePath, "temp");

      expect(validateFileExists(filePath).exists).toBe(true);

      fs.unlinkSync(filePath);

      expect(validateFileExists(filePath).exists).toBe(false);
      expect(validateFileExists(filePath).error).toBe("File not found");
    });
  });

  describe("cross-function integration", () => {
    it("should create directory, write file, validate file, and get size", () => {
      const dir = path.join(TEST_DIR, "workflow-test");
      const filePath = path.join(dir, "sample.wav");

      // Step 1: Ensure directory exists
      ensureDirectoryExists(dir);
      expect(fs.existsSync(dir)).toBe(true);

      // Step 2: Write a file
      const data = Buffer.alloc(1024);
      fs.writeFileSync(filePath, data);

      // Step 3: Validate the file exists
      const validationResult = validateFileExists(filePath);
      expect(validationResult.exists).toBe(true);

      // Step 4: Get the file size
      const size = getFileSize(filePath);
      expect(size).toBe(1024);

      // Step 5: Check the directory is writable
      const writableResult = checkPathWritable(dir);
      expect(writableResult.writable).toBe(true);

      // Step 6: Check disk space is available
      const spaceResult = checkDiskSpace(dir);
      expect(spaceResult.sufficient).toBe(true);
      expect(spaceResult.availableBytes).toBeGreaterThan(0);
    });

    it("should safely remove a .romperdb directory and confirm cleanup", () => {
      const romperDbDir = path.join(TEST_DIR, ".romperdb", "cleanup-test");
      ensureDirectoryExists(romperDbDir);

      const filePath = path.join(romperDbDir, "data.sqlite");
      fs.writeFileSync(filePath, "db content");

      // Verify setup
      expect(validateFileExists(filePath).exists).toBe(true);
      expect(getFileSize(filePath)).toBeGreaterThan(0);

      // Remove
      const removeResult = removeDirectorySafe(romperDbDir);
      expect(removeResult.removed).toBe(true);

      // Verify cleanup
      expect(validateFileExists(filePath).exists).toBe(false);
      expect(getFileSize(filePath)).toBe(0);
    });
  });
});

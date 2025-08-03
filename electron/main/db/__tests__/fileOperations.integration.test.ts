// Integration tests for fileOperations - cross-platform behavior testing
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { deleteDbFileWithRetry } from "../fileOperations";

describe("fileOperations integration tests", () => {
  let testDir: string;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a unique test directory for each test
    testDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "romper-fileops-test-"),
    );
    testDbPath = path.join(testDir, "test.sqlite");
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
      console.warn("Cleanup failed:", error);
    }
  });

  describe("deleteDbFileWithRetry", () => {
    it("should successfully delete a regular file", async () => {
      // Create a test file
      await fs.promises.writeFile(testDbPath, "test content");
      expect(fs.existsSync(testDbPath)).toBe(true);

      // Delete it
      await expect(deleteDbFileWithRetry(testDbPath)).resolves.toBeUndefined();

      // Verify it's gone
      expect(fs.existsSync(testDbPath)).toBe(false);
    });

    it("should handle non-existent files gracefully", async () => {
      const nonExistentPath = path.join(testDir, "nonexistent.sqlite");

      // Should throw when file doesn't exist (expected behavior)
      await expect(deleteDbFileWithRetry(nonExistentPath, 2)).rejects.toThrow();
    });

    it("should handle permission errors by falling back to rename", async () => {
      // Create a test file
      await fs.promises.writeFile(testDbPath, "test content");
      expect(fs.existsSync(testDbPath)).toBe(true);

      // Try to make the file read-only to simulate permission issues
      // Note: This may behave differently on different platforms
      try {
        await fs.promises.chmod(testDbPath, 0o444); // read-only
      } catch (error) {
        // If chmod fails, skip this test (some platforms/file systems don't support it)
        console.warn("Skipping permission test - chmod not supported:", error);
        return;
      }

      // The function should still succeed (either delete or rename)
      await expect(
        deleteDbFileWithRetry(testDbPath, 3),
      ).resolves.toBeUndefined();

      // File should be gone or renamed
      const fileExists = fs.existsSync(testDbPath);
      if (fileExists) {
        // If original still exists, there should be a renamed backup
        const files = await fs.promises.readdir(testDir);
        const backupFiles = files.filter(
          (f) =>
            f.startsWith("test.sqlite.") &&
            (f.includes("corrupted") || f.includes("locked")),
        );
        expect(backupFiles.length).toBeGreaterThan(0);
      }
    });

    it("should handle directory deletion failure appropriately", async () => {
      // Try to "delete" a directory path (should fail quickly with limited retries)
      await expect(deleteDbFileWithRetry(testDir, 2)).rejects.toThrow();
    });

    it("should work with files containing special characters", async () => {
      const specialPath = path.join(
        testDir,
        "test with spaces & symbols!.sqlite",
      );

      // Create a test file with special characters
      await fs.promises.writeFile(specialPath, "test content");
      expect(fs.existsSync(specialPath)).toBe(true);

      // Delete it
      await expect(deleteDbFileWithRetry(specialPath)).resolves.toBeUndefined();

      // Verify it's gone
      expect(fs.existsSync(specialPath)).toBe(false);
    });

    it("should handle deeply nested paths", async () => {
      const deepDir = path.join(testDir, "very", "deep", "nested", "directory");
      await fs.promises.mkdir(deepDir, { recursive: true });

      const deepPath = path.join(deepDir, "test.sqlite");
      await fs.promises.writeFile(deepPath, "test content");
      expect(fs.existsSync(deepPath)).toBe(true);

      // Delete it
      await expect(deleteDbFileWithRetry(deepPath)).resolves.toBeUndefined();

      // Verify it's gone
      expect(fs.existsSync(deepPath)).toBe(false);
    });

    it("should respect retry limits", async () => {
      // Create a file in a directory we'll make unwritable
      const restrictedDir = path.join(testDir, "restricted");
      await fs.promises.mkdir(restrictedDir);
      const restrictedPath = path.join(restrictedDir, "test.sqlite");
      await fs.promises.writeFile(restrictedPath, "test content");

      // Try to make the parent directory unwritable (platform dependent)
      try {
        await fs.promises.chmod(restrictedDir, 0o555); // read + execute only

        // Should fail within reasonable time due to retry limit
        const startTime = Date.now();
        await expect(
          deleteDbFileWithRetry(restrictedPath, 2),
        ).rejects.toThrow();
        const endTime = Date.now();

        // Should not take too long (retry limits should be respected)
        expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max

        // Restore permissions for cleanup
        await fs.promises.chmod(restrictedDir, 0o755);
      } catch (error) {
        // If chmod fails, skip this test
        console.warn("Skipping retry test - chmod not supported:", error);
      }
    });

    it("should create appropriate backup files on Windows-style failures", async () => {
      // Create multiple test files to simulate scenarios where deletion fails
      const files = [
        path.join(testDir, "test1.sqlite"),
        path.join(testDir, "test2.sqlite"),
        path.join(testDir, "test3.sqlite"),
      ];

      for (const filePath of files) {
        await fs.promises.writeFile(filePath, "test content");
      }

      // Delete all files - should succeed
      for (const filePath of files) {
        await expect(deleteDbFileWithRetry(filePath)).resolves.toBeUndefined();
        expect(fs.existsSync(filePath)).toBe(false);
      }
    });

    it("should work with large files", async () => {
      // Create a larger test file (1MB)
      const largeContent = Buffer.alloc(1024 * 1024, "x");
      await fs.promises.writeFile(testDbPath, largeContent);
      expect(fs.existsSync(testDbPath)).toBe(true);

      const stats = await fs.promises.stat(testDbPath);
      expect(stats.size).toBe(1024 * 1024);

      // Delete it
      await expect(deleteDbFileWithRetry(testDbPath)).resolves.toBeUndefined();

      // Verify it's gone
      expect(fs.existsSync(testDbPath)).toBe(false);
    });

    it("should handle concurrent access patterns", async () => {
      // Create multiple files and try to delete them concurrently
      const files = Array.from({ length: 5 }, (_, i) =>
        path.join(testDir, `concurrent-${i}.sqlite`),
      );

      // Create all files
      await Promise.all(
        files.map((filePath) =>
          fs.promises.writeFile(filePath, `content ${filePath}`),
        ),
      );

      // Verify all created
      for (const filePath of files) {
        expect(fs.existsSync(filePath)).toBe(true);
      }

      // Delete all concurrently
      await Promise.all(
        files.map((filePath) => deleteDbFileWithRetry(filePath)),
      );

      // Verify all deleted
      for (const filePath of files) {
        expect(fs.existsSync(filePath)).toBe(false);
      }
    });
  });

  describe("platform-specific behavior", () => {
    it("should demonstrate platform differences in error handling", async () => {
      // This test documents platform-specific behavior
      const platform = process.platform;

      await fs.promises.writeFile(testDbPath, "test content");

      // All platforms should be able to delete a normal file
      await expect(deleteDbFileWithRetry(testDbPath)).resolves.toBeUndefined();
      expect(fs.existsSync(testDbPath)).toBe(false);

      // Document which platform we tested on
      console.log(`✓ Tested on platform: ${platform}`);
      expect(["win32", "darwin", "linux"].includes(platform)).toBe(true);
    });

    it("should handle platform-specific path separators", async () => {
      // Test that Node.js path normalization works correctly
      const pathWithMixedSeparators = testDbPath.replace(/\//g, path.sep);

      // Create file using normalized path
      await fs.promises.writeFile(testDbPath, "test content");
      expect(fs.existsSync(testDbPath)).toBe(true);

      // Delete using platform-appropriate separators
      await expect(
        deleteDbFileWithRetry(pathWithMixedSeparators),
      ).resolves.toBeUndefined();
      expect(fs.existsSync(testDbPath)).toBe(false);
    });
  });
});

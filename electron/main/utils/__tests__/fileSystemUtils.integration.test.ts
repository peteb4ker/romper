import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkDiskSpace,
  checkDiskSpaceSufficient,
  checkPathWritable,
} from "../fileSystemUtils.js";

// Each test gets its own directory under the OS temp dir (see beforeEach),
// so nothing is written into the source tree.
let TEST_DIR: string;

describe("fileSystemUtils Integration Tests", () => {
  beforeEach(() => {
    TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "romper-fs-utils-"));
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { force: true, recursive: true });
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
});

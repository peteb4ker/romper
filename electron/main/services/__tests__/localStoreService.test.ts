import * as fs from "fs";
import * as path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  lstatSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock path
vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

// Mock local store validator
vi.mock("../../localStoreValidator.js", () => ({
  validateLocalStoreAgainstDb: vi.fn(),
  validateLocalStoreAndDb: vi.fn(),
  validateLocalStoreBasic: vi.fn(),
}));

import {
  validateLocalStoreAgainstDb,
  validateLocalStoreAndDb,
  validateLocalStoreBasic,
} from "../../localStoreValidator.js";
import { LocalStoreService } from "../localStoreService.js";

const mockFs = vi.mocked(fs);
const mockPath = vi.mocked(path);
const mockValidateAgainstDb = vi.mocked(validateLocalStoreAgainstDb);
const mockValidateAndDb = vi.mocked(validateLocalStoreAndDb);
const mockValidateBasic = vi.mocked(validateLocalStoreBasic);

describe("LocalStoreService", () => {
  let localStoreService: LocalStoreService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStoreService = new LocalStoreService();

    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockFs.existsSync.mockReturnValue(true);
    mockFs.lstatSync.mockReturnValue({ isDirectory: () => true } as any);

    // Silence console.error for tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getLocalStoreStatus", () => {
    beforeEach(() => {
      mockValidateAndDb.mockReturnValue({
        details: { dbVersion: "1.0", hasDb: true },
        error: null,
        isValid: true,
      });
    });

    it("returns configured status when environment path is provided", () => {
      const result = localStoreService.getLocalStoreStatus(null, "/env/path");

      expect(result).toEqual({
        error: null,
        hasLocalStore: true,
        isValid: true,
        localStorePath: "/env/path",
      });
      expect(mockValidateAndDb).toHaveBeenCalledWith("/env/path");
    });

    it("returns configured status when local store path is provided", () => {
      const result = localStoreService.getLocalStoreStatus("/local/path");

      expect(result).toEqual({
        error: null,
        hasLocalStore: true,
        isValid: true,
        localStorePath: "/local/path",
      });
      expect(mockValidateAndDb).toHaveBeenCalledWith("/local/path");
    });

    it("prioritizes environment path over local store path", () => {
      const result = localStoreService.getLocalStoreStatus(
        "/local/path",
        "/env/path",
      );

      expect(result.localStorePath).toBe("/env/path");
      expect(mockValidateAndDb).toHaveBeenCalledWith("/env/path");
    });

    it("returns not configured when no path is provided", () => {
      const result = localStoreService.getLocalStoreStatus(null);

      expect(result).toEqual({
        error: "No local store configured",
        hasLocalStore: false,
        isValid: false,
        localStorePath: null,
      });
      expect(mockValidateAndDb).not.toHaveBeenCalled();
    });

    it("returns invalid status when validation fails", () => {
      mockValidateAndDb.mockReturnValue({
        details: { hasDb: false },
        error: "Database not found",
        isValid: false,
      });

      const result = localStoreService.getLocalStoreStatus("/invalid/path");

      expect(result).toEqual({
        error: "Database not found",
        hasLocalStore: true,
        isValid: false,
        localStorePath: "/invalid/path",
      });
    });
  });

  describe("validateLocalStore", () => {
    it("delegates to validateLocalStoreAgainstDb", () => {
      const mockResult = {
        details: { hasDb: true },
        error: null,
        isValid: true,
      };
      mockValidateAgainstDb.mockReturnValue(mockResult);

      const result = localStoreService.validateLocalStore("/test/path");

      expect(result).toBe(mockResult);
      expect(mockValidateAgainstDb).toHaveBeenCalledWith("/test/path");
    });
  });

  describe("validateLocalStoreBasic", () => {
    it("delegates to validateLocalStoreBasic", () => {
      const mockResult = {
        details: { hasPath: true },
        error: null,
        isValid: true,
      };
      mockValidateBasic.mockReturnValue(mockResult);

      const result = localStoreService.validateLocalStoreBasic("/test/path");

      expect(result).toBe(mockResult);
      expect(mockValidateBasic).toHaveBeenCalledWith("/test/path");
    });
  });

  describe("validateExistingLocalStore", () => {
    it("returns success for valid local store", () => {
      mockValidateAndDb.mockReturnValue({
        details: { hasDb: true },
        error: null,
        isValid: true,
      });

      const result =
        localStoreService.validateExistingLocalStore("/valid/path");

      expect(result).toEqual({
        error: null,
        path: "/valid/path",
        success: true,
      });
    });

    it("returns failure for invalid local store", () => {
      mockValidateAndDb.mockReturnValue({
        details: { hasDb: false },
        error: "No database found",
        isValid: false,
      });

      const result =
        localStoreService.validateExistingLocalStore("/invalid/path");

      expect(result).toEqual({
        error: "No database found",
        path: null,
        success: false,
      });
    });

    it("provides default error message when validation error is missing", () => {
      mockValidateAndDb.mockReturnValue({
        details: { hasDb: false },
        error: null,
        isValid: false,
      });

      const result =
        localStoreService.validateExistingLocalStore("/invalid/path");

      expect(result).toEqual({
        error: "Selected directory does not contain a valid Romper database",
        path: null,
        success: false,
      });
    });
  });

  describe("listFilesInRoot", () => {
    it("returns list of files in directory", () => {
      const mockFiles = ["file1.txt", "file2.wav", "subdirectory"];
      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const result = localStoreService.listFilesInRoot("/test/path");

      expect(result).toEqual(mockFiles);
      expect(mockFs.readdirSync).toHaveBeenCalledWith("/test/path");
    });

    it("throws error when directory read fails", () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      expect(() => {
        localStoreService.listFilesInRoot("/bad/path");
      }).toThrow("Failed to read directory: Permission denied");
    });

    it("handles non-Error exceptions", () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw "String error";
      });

      expect(() => {
        localStoreService.listFilesInRoot("/bad/path");
      }).toThrow("Failed to read directory: String error");
    });
  });

  describe("readFile", () => {
    it("successfully reads file and returns ArrayBuffer", () => {
      const mockBuffer = Buffer.from("test file content");
      // Mock the buffer properties that the service uses
      Object.defineProperty(mockBuffer, "buffer", {
        value: new ArrayBuffer(mockBuffer.length),
        writable: false,
      });
      Object.defineProperty(mockBuffer, "byteOffset", {
        value: 0,
        writable: false,
      });
      Object.defineProperty(mockBuffer, "byteLength", {
        value: mockBuffer.length,
        writable: false,
      });

      mockFs.readFileSync.mockReturnValue(mockBuffer);

      const result = localStoreService.readFile("/test/file.txt");

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      expect(mockFs.readFileSync).toHaveBeenCalledWith("/test/file.txt");
    });

    it("returns error when file read fails", () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

      const result = localStoreService.readFile("/missing/file.txt");

      expect(result).toEqual({
        error: "File not found",
        success: false,
      });
    });

    it("handles non-Error exceptions", () => {
      mockFs.readFileSync.mockImplementation(() => {
        const error: any = "String error";
        throw error;
      });

      const result = localStoreService.readFile("/bad/file.txt");

      expect(result).toEqual({
        error: "Failed to read file",
        success: false,
      });
    });
  });

  describe("ensureDirectory", () => {
    it("returns success when directory already exists", () => {
      mockFs.existsSync.mockReturnValue(true);

      const result = localStoreService.ensureDirectory("/existing/dir");

      expect(result).toEqual({ success: true });
      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });

    it("creates directory when it doesn't exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = localStoreService.ensureDirectory("/new/dir");

      expect(result).toEqual({ success: true });
      expect(mockFs.mkdirSync).toHaveBeenCalledWith("/new/dir", {
        recursive: true,
      });
    });

    it("returns error when directory creation fails", () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = localStoreService.ensureDirectory("/forbidden/dir");

      expect(result).toEqual({
        error: "Permission denied",
        success: false,
      });
    });

    it("handles non-Error exceptions", () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw "String error";
      });

      const result = localStoreService.ensureDirectory("/error/dir");

      expect(result).toEqual({
        error: "String error",
        success: false,
      });
    });
  });

  describe("getLocalStorePath", () => {
    it("joins paths correctly", () => {
      const result = localStoreService.getLocalStorePath(
        "/base",
        "sub",
        "path",
      );

      expect(result).toBe("/base/sub/path");
      expect(mockPath.join).toHaveBeenCalledWith("/base", "sub", "path");
    });

    it("handles single path", () => {
      const result = localStoreService.getLocalStorePath("/base");

      expect(result).toBe("/base");
      expect(mockPath.join).toHaveBeenCalledWith("/base");
    });

    it("handles empty sub-paths", () => {
      const result = localStoreService.getLocalStorePath("/base", "", "file");

      expect(result).toBe("/base//file");
      expect(mockPath.join).toHaveBeenCalledWith("/base", "", "file");
    });
  });

  describe("getDbPath", () => {
    it("returns database path within local store", () => {
      const result = localStoreService.getDbPath("/local/store");

      expect(result).toBe("/local/store/.romperdb");
      expect(mockPath.join).toHaveBeenCalledWith("/local/store", ".romperdb");
    });
  });

  describe("isLocalStoreAccessible", () => {
    it("returns true when directory exists and is accessible", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => true } as any);

      const result = localStoreService.isLocalStoreAccessible("/valid/path");

      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith("/valid/path");
      expect(mockFs.lstatSync).toHaveBeenCalledWith("/valid/path");
    });

    it("returns false when directory doesn't exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = localStoreService.isLocalStoreAccessible("/missing/path");

      expect(result).toBe(false);
    });

    it("returns false when path is not a directory", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = localStoreService.isLocalStoreAccessible("/file/path");

      expect(result).toBe(false);
    });

    it("returns false when filesystem operations throw", () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error("Access denied");
      });

      const result = localStoreService.isLocalStoreAccessible("/error/path");

      expect(result).toBe(false);
    });
  });

  describe("hasRomperDb", () => {
    it("returns true when database directory exists", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => true } as any);

      const result = localStoreService.hasRomperDb("/local/store");

      expect(result).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledWith("/local/store/.romperdb");
      expect(mockFs.lstatSync).toHaveBeenCalledWith("/local/store/.romperdb");
    });

    it("returns false when database directory doesn't exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = localStoreService.hasRomperDb("/no/db");

      expect(result).toBe(false);
    });

    it("returns false when database path is not a directory", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => false } as any);

      const result = localStoreService.hasRomperDb("/db/is/file");

      expect(result).toBe(false);
    });

    it("returns false when filesystem operations throw", () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.lstatSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = localStoreService.hasRomperDb("/error/path");

      expect(result).toBe(false);
    });
  });
});

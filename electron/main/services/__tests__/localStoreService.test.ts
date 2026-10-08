import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock fs
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  lstatSync: vi.fn(),
  mkdirSync: vi.fn(),
  promises: { readdir: vi.fn() },
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock path
vi.mock("node:path", () => ({
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
import {
  CARD_NOT_RESPONDING_SETUP_MESSAGE,
  CARD_OPERATION_TIMEOUT_MS,
  cardWatchdogSettings,
} from "../cardWatchdog.js";
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
    mockFs.lstatSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);

    // Silence console.error for tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("[UC-05] getLocalStoreStatus", () => {
    beforeEach(() => {
      mockValidateAndDb.mockReturnValue({
        isValid: true,
      });
    });

    it("returns configured status when environment path is provided", () => {
      const result = localStoreService.getLocalStoreStatus(null, "/env/path");

      expect(result).toEqual({
        error: undefined,
        hasLocalStore: true,
        isCriticalEnvironmentError: false,
        isEnvironmentOverride: true,
        isValid: true,
        localStorePath: "/env/path",
      });
      expect(mockValidateAndDb).toHaveBeenCalledWith("/env/path");
    });

    it("returns configured status when local store path is provided", () => {
      const result = localStoreService.getLocalStoreStatus("/local/path");

      expect(result).toEqual({
        error: undefined,
        hasLocalStore: true,
        isCriticalEnvironmentError: false,
        isEnvironmentOverride: false,
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
        isCriticalEnvironmentError: false,
        isEnvironmentOverride: false,
        isValid: false,
        localStorePath: null,
      });
      expect(mockValidateAndDb).not.toHaveBeenCalled();
    });

    it.each(["", "  "])(
      "treats ROMPER_LOCAL_PATH=%j as unset, not as an override",
      (envPath) => {
        expect(localStoreService.getLocalStoreStatus(null, envPath)).toEqual({
          error: "No local store configured",
          hasLocalStore: false,
          isCriticalEnvironmentError: false,
          isEnvironmentOverride: false,
          isValid: false,
          localStorePath: null,
        });

        const saved = localStoreService.getLocalStoreStatus(
          "/local/path",
          envPath,
        );
        expect(saved.isEnvironmentOverride).toBe(false);
        expect(saved.localStorePath).toBe("/local/path");
      },
    );

    it("returns invalid status when validation fails", () => {
      mockValidateAndDb.mockReturnValue({
        error: "Database not found",
        isValid: false,
      });

      const result = localStoreService.getLocalStoreStatus("/invalid/path");

      expect(result).toEqual({
        error: "Database not found",
        hasLocalStore: true,
        isCriticalEnvironmentError: false,
        isEnvironmentOverride: false,
        isValid: false,
        localStorePath: "/invalid/path",
      });
    });

    it("returns critical environment error when environment path is invalid (non-test env)", () => {
      // Store original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      mockValidateAndDb.mockReturnValue({
        error: "Path does not exist",
        isValid: false,
      });

      const result = localStoreService.getLocalStoreStatus(
        null,
        "/invalid/env/path",
      );

      expect(result).toEqual({
        error: "Path does not exist",
        hasLocalStore: true,
        isCriticalEnvironmentError: true,
        isEnvironmentOverride: true,
        isValid: false,
        localStorePath: "/invalid/env/path",
      });

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

    it("does not return critical environment error in test environment", () => {
      // Store original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      mockValidateAndDb.mockReturnValue({
        error: "Path does not exist",
        isValid: false,
      });

      const result = localStoreService.getLocalStoreStatus(
        null,
        "/invalid/env/path",
      );

      expect(result).toEqual({
        error: "Path does not exist",
        hasLocalStore: true,
        isCriticalEnvironmentError: false,
        isEnvironmentOverride: true,
        isValid: false,
        localStorePath: "/invalid/env/path",
      });

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe("validateLocalStore", () => {
    it("delegates to validateLocalStoreAgainstDb", () => {
      const mockResult = {
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
        isValid: true,
      };
      mockValidateBasic.mockReturnValue(mockResult);

      const result = localStoreService.validateLocalStoreBasic("/test/path");

      expect(result).toBe(mockResult);
      expect(mockValidateBasic).toHaveBeenCalledWith("/test/path");
    });
  });

  describe("[UC-04] validateExistingLocalStore", () => {
    it("returns success for valid local store", () => {
      mockValidateAndDb.mockReturnValue({
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
    // The service calls the overload that returns file names
    const readdir = vi.mocked<(path: fs.PathLike) => Promise<string[]>>(
      mockFs.promises.readdir,
    );

    afterEach(() => {
      cardWatchdogSettings.timeoutMs = CARD_OPERATION_TIMEOUT_MS;
    });

    it("returns list of files in directory", async () => {
      const mockFiles = ["file1.txt", "file2.wav", "subdirectory"];
      readdir.mockResolvedValue(mockFiles);

      const result = await localStoreService.listFilesInRoot("/test/path");

      expect(result).toEqual({ data: mockFiles, success: true });
      expect(readdir).toHaveBeenCalledWith("/test/path");
      // [UC-01] [Q-01] Setup lists the card with it: never synchronously (#724)
      expect(mockFs.readdirSync).not.toHaveBeenCalled();
    });

    it("reports a directory read that fails", async () => {
      readdir.mockRejectedValue(new Error("Permission denied"));

      await expect(
        localStoreService.listFilesInRoot("/bad/path"),
      ).resolves.toEqual({
        error: "Failed to read directory: Permission denied",
        success: false,
      });
    });

    it("handles non-Error exceptions", async () => {
      readdir.mockRejectedValue("String error");

      await expect(
        localStoreService.listFilesInRoot("/bad/path"),
      ).resolves.toEqual({
        error: "Failed to read directory: String error",
        success: false,
      });
    });

    it("[UC-01] [Q-01] says the card stopped responding when the listing never finishes (#724)", async () => {
      readdir.mockReturnValue(new Promise<never>(() => undefined));
      cardWatchdogSettings.timeoutMs = 20;

      await expect(
        localStoreService.listFilesInRoot("/Volumes/RAMPLE"),
      ).resolves.toEqual({
        error: CARD_NOT_RESPONDING_SETUP_MESSAGE,
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
});

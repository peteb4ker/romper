import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocalStoreWizardFileOps } from "../useLocalStoreWizardFileOps";

// Mock dependencies
vi.mock("@romper/shared/kitUtilsShared", () => ({
  groupSamplesByVoice: vi.fn(() => new Map()),
}));

vi.mock("../../config", () => ({
  config: {
    localStoreRootFolderName: "RamplerLocal",
    squarpArchiveUrl: "https://data.squarp.net/RampleSamplesV1-2.zip",
  },
}));

vi.mock("../utils/romperDb", () => ({
  createRomperDb: vi.fn().mockResolvedValue(undefined),
  insertKit: vi.fn().mockResolvedValue(undefined),
  insertSample: vi.fn().mockResolvedValue(undefined),
}));

describe("useLocalStoreWizardFileOps", () => {
  let mockApi: any;
  let mockReportProgress: any;
  let mockReportStepProgress: any;
  let mockSetError: any;
  let mockSetWizardState: any;

  beforeEach(() => {
    // Use centralized mocks instead of manual assignment
    vi.mocked(window.electronAPI.createRomperDb).mockResolvedValue({
      success: true,
    });
    vi.mocked(window.electronAPI.insertKit).mockResolvedValue({
      success: true,
    });
    vi.mocked(window.electronAPI.insertSample).mockResolvedValue({
      success: true,
    });
    mockApi = {
      buildPath: vi.fn((...parts) => parts.join("/")),
      copyDir: vi.fn(() => Promise.resolve({ success: true })),
      createFolder: vi.fn(() => Promise.resolve()),
      downloadAndExtractArchive: vi.fn(() =>
        Promise.resolve({ success: true }),
      ),
      getUserHome: vi.fn(() => "/home/user"),
      listFilesInRoot: vi.fn(() => Promise.resolve(["A0", "B1", "file.txt"])),
      pathExists: vi.fn(() => Promise.resolve(false)),
    };

    mockReportProgress = vi.fn();
    mockReportStepProgress = vi.fn(async ({ items, onStep }) => {
      for (let i = 0; i < items.length; i++) {
        await onStep(items[i], i);
      }
    });
    mockSetError = vi.fn();
    mockSetWizardState = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- Test validateSdCardFolder (working tests) ---
  describe("validateSdCardFolder", () => {
    it("should return null for empty path", async () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      const error = await result.current.validateSdCardFolder("");

      expect(error).toBeNull();
    });

    it("should return error when API is not available", async () => {
      const apiWithoutList = { ...mockApi, listFilesInRoot: undefined };

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: apiWithoutList,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      const error = await result.current.validateSdCardFolder("/path");

      expect(error).toBe("Cannot access filesystem.");
    });

    it("should return error when no kit folders found", async () => {
      mockApi.listFilesInRoot = vi.fn(() =>
        Promise.resolve(["file.txt", "README.md"]),
      );

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      const error = await result.current.validateSdCardFolder("/path");

      expect(error).toBe(
        "No valid kit folders found. Please choose a folder with kit subfolders (e.g. A0, B12, etc).",
      );
    });

    it("should return null when kit folders are found", async () => {
      mockApi.listFilesInRoot = vi.fn(() =>
        Promise.resolve(["A0", "B12", "file.txt"]),
      );

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      const error = await result.current.validateSdCardFolder("/path");

      expect(error).toBeNull();
    });
  });

  // --- Test validateAndCopySdCardKits ---
  describe("validateAndCopySdCardKits", () => {
    it("should validate and copy kit folders successfully", async () => {
      mockApi.listFilesInRoot = vi.fn(() =>
        Promise.resolve(["A0", "B1", "file.txt"]),
      );
      mockApi.copyDir = vi.fn(() => Promise.resolve({ success: true }));

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await result.current.validateAndCopySdCardKits("/sd/card", "/target");

      expect(mockApi.copyDir).toHaveBeenCalledWith("/sd/card/A0", "/target/A0");
      expect(mockApi.copyDir).toHaveBeenCalledWith("/sd/card/B1", "/target/B1");
      expect(mockReportStepProgress).toHaveBeenCalledWith({
        items: ["A0", "B1"],
        onStep: expect.any(Function),
        phase: "Copying kits...",
      });
    });

    it("should handle validation errors", async () => {
      mockApi.listFilesInRoot = vi.fn(() => Promise.resolve(["file.txt"])); // No kit folders

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await expect(
        result.current.validateAndCopySdCardKits("/invalid/path", "/target"),
      ).rejects.toThrow();

      expect(mockSetWizardState).toHaveBeenCalledWith({
        kitFolderValidationError: expect.any(String),
        source: null,
      });
    });

    it("should handle missing API methods", async () => {
      const apiWithoutCopyDir = { ...mockApi, copyDir: undefined };

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: apiWithoutCopyDir,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await expect(
        result.current.validateAndCopySdCardKits("/sd/card", "/target"),
      ).rejects.toThrow("Missing Electron API");
    });

    it("should handle empty source path", async () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await expect(
        result.current.validateAndCopySdCardKits("", "/target"),
      ).rejects.toThrow();
    });
  });

  // --- Test extractSquarpArchive ---
  describe("extractSquarpArchive", () => {
    it("should extract archive successfully", async () => {
      mockApi.downloadAndExtractArchive = vi.fn(() =>
        Promise.resolve({ success: true }),
      );

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await result.current.extractSquarpArchive("/target/path");

      expect(mockApi.downloadAndExtractArchive).toHaveBeenCalledWith(
        "https://data.squarp.net/RampleSamplesV1-2.zip",
        "/target/path",
        expect.any(Function), // progress callback
        expect.any(Function), // error callback
      );
    });

    it("should handle extraction errors", async () => {
      mockApi.downloadAndExtractArchive = vi.fn(() =>
        Promise.resolve({ error: "Download failed", success: false }),
      );

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await expect(
        result.current.extractSquarpArchive("/target/path"),
      ).rejects.toThrow("Download failed");
    });

    it("should handle missing API method", async () => {
      const apiWithoutExtract = {
        ...mockApi,
        downloadAndExtractArchive: undefined,
      };

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: apiWithoutExtract,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await expect(
        result.current.extractSquarpArchive("/target/path"),
      ).rejects.toThrow("Failed to extract archive");
    });
  });

  // --- Test createAndPopulateDb ---
  describe("createAndPopulateDb", () => {
    beforeEach(() => {
      // Database utilities are already mocked at the top level
      vi.clearAllMocks();
    });

    it("should create database and populate with kits", async () => {
      mockApi.listFilesInRoot = vi
        .fn()
        .mockResolvedValueOnce(["A0", "B1"]) // Kit folders
        .mockResolvedValueOnce(["sample1.wav", "sample2.wav"]) // A0 samples
        .mockResolvedValueOnce(["sample3.wav"]); // B1 samples

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      const dbResult = await result.current.createAndPopulateDb("/target/path");

      expect(dbResult.dbDir).toBe("/target/path/.romperdb");
      expect(dbResult.validKits).toEqual(["A0", "B1"]);
      expect(mockReportStepProgress).toHaveBeenCalledWith({
        items: ["A0", "B1"],
        onStep: expect.any(Function),
        phase: "Writing to database",
      });
    });

    it("should handle empty kit folders", async () => {
      mockApi.listFilesInRoot = vi.fn().mockResolvedValue(["file.txt"]); // No kit folders

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      const dbResult = await result.current.createAndPopulateDb("/target/path");

      expect(dbResult.validKits).toEqual([]);
      expect(dbResult.dbDir).toBe("/target/path/.romperdb");
    });

    it("should filter out non-kit folders", async () => {
      mockApi.listFilesInRoot = vi
        .fn()
        .mockResolvedValueOnce(["A0", "invalid-folder", "B12", "README.txt"]) // Mixed content
        .mockResolvedValueOnce(["sample1.wav"]) // A0 samples
        .mockResolvedValueOnce(["sample2.wav"]); // B12 samples

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      const dbResult = await result.current.createAndPopulateDb("/target/path");

      expect(dbResult.validKits).toEqual(["A0", "B12"]);
    });
  });
});

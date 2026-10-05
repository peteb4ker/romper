import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importSetupBankNames, importSetupKit } from "../../../utils/romperDb";
import {
  bankNamesSourcePath,
  useLocalStoreWizardFileOps,
} from "../useLocalStoreWizardFileOps";

vi.mock("../../../../config", () => ({
  config: {
    localStoreRootFolderName: "RamplerLocal",
    squarpArchiveUrl: "https://data.squarp.net/RampleSamplesV1-2.zip",
  },
}));

vi.mock("../../../utils/romperDb", () => ({
  createRomperDb: vi.fn().mockResolvedValue(undefined),
  importSetupBankNames: vi.fn().mockResolvedValue(0),
  importSetupKit: vi.fn(),
}));

describe("useLocalStoreWizardFileOps", () => {
  let mockApi: unknown;
  let mockReportProgress: unknown;
  let mockReportStepProgress: unknown;
  let mockSetError: unknown;
  let mockSetWizardState: unknown;

  beforeEach(() => {
    // Use centralized mocks instead of manual assignment
    vi.mocked(window.electronAPI.createRomperDb).mockResolvedValue({
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
  describe("[UC-01] validateSdCardFolder", () => {
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
        "No kit folders found in /path. Found: file.txt, README.md. Expected kit folders named like the Rample's: a bank letter and a number from 0 to 99, such as A0, B1 or Z99.",
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
  describe("[UC-01] validateAndCopySdCardKits", () => {
    it("stops when a kit can't be copied from the card", async () => {
      mockApi.listFilesInRoot = vi.fn(() => Promise.resolve(["A0", "B1"]));
      mockApi.copyDir = vi.fn(() =>
        Promise.resolve({ error: "card removed", success: false }),
      );
      const runSteps = vi.fn(
        async ({
          items,
          onStep,
        }: {
          items: string[];
          onStep: (item: string) => Promise<void>;
        }) => {
          for (const item of items) await onStep(item);
        },
      );
      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: runSteps,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await expect(
        result.current.validateAndCopySdCardKits("/sd", "/store"),
      ).rejects.toThrow("Couldn't copy kit A0 from the card: card removed");
      expect(mockApi.copyDir).toHaveBeenCalledTimes(1);
    });

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
  describe("[UC-02] extractSquarpArchive", () => {
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

      // The renderer names only the destination; main owns the archive URL.
      expect(mockApi.downloadAndExtractArchive).toHaveBeenCalledWith(
        "/target/path",
        expect.any(Function), // progress callback
        expect.any(Function), // error callback
      );
    });

    it("should forward progress updates and surface error-callback messages", async () => {
      // Arrange — the archive API invokes the progress and error callbacks
      // the hook passes in (the default mock never calls them).
      mockApi.downloadAndExtractArchive = vi.fn(
        async (
          _target: string,
          onProgress: (p: unknown) => void,
          onError: (e: unknown) => void,
        ) => {
          onProgress({ percent: 50, phase: "Downloading" });
          onProgress({ percent: 100, phase: "Downloading" });
          onError(new Error("network blip"));
          return { success: true };
        },
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

      // Act
      await result.current.extractSquarpArchive("/target/path");

      // Assert — first event reported (phase change), 100% always reported,
      // and the error callback routed to setError.
      expect(mockReportProgress).toHaveBeenCalledWith({
        percent: 50,
        phase: "Downloading",
      });
      expect(mockReportProgress).toHaveBeenCalledWith({
        percent: 100,
        phase: "Downloading",
      });
      expect(mockSetError).toHaveBeenCalledWith("network blip");
    });

    const renderFileOps = (api = mockApi) =>
      renderHook(() =>
        useLocalStoreWizardFileOps({
          api,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

    it("shows main's reason at once for a failure another download can't fix (RE-77)", async () => {
      const reason =
        "The downloaded factory sample archive didn't match the expected checksum, so Romper didn't install it.";
      mockApi.downloadAndExtractArchive = vi.fn(() =>
        Promise.resolve({ error: reason, retryable: false, success: false }),
      );
      const { result } = renderFileOps();

      await expect(
        result.current.extractSquarpArchive("/target/path"),
      ).rejects.toThrow(reason);
      expect(mockApi.downloadAndExtractArchive).toHaveBeenCalledTimes(1);
      expect(mockReportProgress).not.toHaveBeenCalledWith(
        expect.objectContaining({
          phase: expect.stringContaining("retrying"),
        }),
      );
    });

    it("doesn't retry a failure main doesn't mark retryable", async () => {
      mockApi.downloadAndExtractArchive = vi.fn(() =>
        Promise.resolve({ error: "Disk full", success: false }),
      );
      const { result } = renderFileOps();

      await expect(
        result.current.extractSquarpArchive("/target/path"),
      ).rejects.toThrow("Disk full");
      expect(mockApi.downloadAndExtractArchive).toHaveBeenCalledTimes(1);
    });

    describe("a network failure", () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });
      afterEach(() => {
        vi.useRealTimers();
      });

      const networkFailure = {
        error:
          "Couldn't connect to the download server. Check your internet connection and try again.",
        retryable: true,
        success: false,
      };

      it("is retried, and the last attempt's reason is shown", async () => {
        mockApi.downloadAndExtractArchive = vi.fn(() =>
          Promise.resolve(networkFailure),
        );
        const { result } = renderFileOps();

        const run = result.current.extractSquarpArchive("/target/path");
        const outcome = expect(run).rejects.toThrow(
          `Factory samples download failed after 3 attempts. ${networkFailure.error}`,
        );
        await vi.runAllTimersAsync();
        await outcome;

        expect(mockApi.downloadAndExtractArchive).toHaveBeenCalledTimes(3);
        expect(mockReportProgress).toHaveBeenCalledWith({
          percent: 0,
          phase: "Download failed, retrying (attempt 2 of 3)...",
        });
      });

      it("stops retrying once an attempt succeeds", async () => {
        mockApi.downloadAndExtractArchive = vi
          .fn()
          .mockResolvedValueOnce(networkFailure)
          .mockResolvedValueOnce({ success: true });
        const { result } = renderFileOps();

        const run = result.current.extractSquarpArchive("/target/path");
        await vi.runAllTimersAsync();
        await run;

        expect(mockApi.downloadAndExtractArchive).toHaveBeenCalledTimes(2);
      });
    });

    it("should handle missing API method", async () => {
      const { result } = renderFileOps({
        ...mockApi,
        downloadAndExtractArchive: undefined,
      });

      await expect(
        result.current.extractSquarpArchive("/target/path"),
      ).rejects.toThrow("The factory samples couldn't be installed.");
    });
  });

  // --- Test createAndPopulateDb ---
  describe("[UC-01] [UC-02] createAndPopulateDb", () => {
    beforeEach(() => {
      // Database utilities are already mocked at the top level
      vi.clearAllMocks();
      vi.mocked(importSetupKit).mockResolvedValue({
        addedSamples: 1,
        locked: false,
        metadataUpdated: 0,
        missingSamples: [],
        scannedSamples: 1,
        skippedFiles: [],
        updatedVoices: 0,
      });
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

    // #564, #567: the card's or the factory archive's bank names arrive
    // with the kits
    it("[UC-12] imports the bank names in the folder it's given", async () => {
      mockApi.listFilesInRoot = vi.fn().mockResolvedValue(["A0"]);
      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await result.current.createAndPopulateDb("/target/path", "/Volumes/SD");
      expect(importSetupBankNames).toHaveBeenCalledWith(
        "/target/path/.romperdb",
        "/Volumes/SD",
      );

      // The factory archive's names, extracted into the store
      vi.mocked(importSetupBankNames).mockClear();
      await result.current.createAndPopulateDb("/target/path", "/target/path");
      expect(importSetupBankNames).toHaveBeenCalledWith(
        "/target/path/.romperdb",
        "/target/path",
      );

      // A blank store has none
      vi.mocked(importSetupBankNames).mockClear();
      await result.current.createAndPopulateDb("/target/path");
      expect(importSetupBankNames).not.toHaveBeenCalled();
    });

    it("stops setup when the card's bank names can't be imported", async () => {
      mockApi.listFilesInRoot = vi.fn().mockResolvedValue(["A0"]);
      vi.mocked(importSetupBankNames).mockRejectedValueOnce(
        new Error("Can't read the bank names in /Volumes/SD: EIO"),
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
        result.current.createAndPopulateDb("/target/path", "/Volumes/SD"),
      ).rejects.toThrow("Can't read the bank names in /Volumes/SD: EIO");
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
    // RE-34: main imports each kit; its "voice full" skips become the
    // wizard's notice, one line per voice
    it("[UC-02] turns main's voice-full skips into one warning per voice", async () => {
      mockApi.listFilesInRoot = vi.fn().mockResolvedValue(["S62"]);
      const runSteps = vi.fn(
        async ({
          items,
          onStep,
        }: {
          items: string[];
          onStep: (item: string) => Promise<void>;
        }) => {
          for (const item of items) await onStep(item);
        },
      );
      vi.mocked(importSetupKit).mockResolvedValue({
        addedSamples: 24,
        locked: false,
        metadataUpdated: 0,
        missingSamples: [],
        scannedSamples: 30,
        skippedFiles: [
          ...Array.from({ length: 6 }, (_, i) => ({
            filename: `2 tom ${i + 13}.wav`,
            reason: "voice_full" as const,
            voiceNumber: 2,
          })),
          { filename: "4 hat.wav", reason: "kit_editable", voiceNumber: 4 },
        ],
        updatedVoices: 2,
      });

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: mockApi,
          reportProgress: mockReportProgress,
          reportStepProgress: runSteps,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      const dbResult = await result.current.createAndPopulateDb("/target/path");

      expect(importSetupKit).toHaveBeenCalledWith(
        "/target/path/.romperdb",
        "S62",
      );
      expect(dbResult.truncationWarnings).toEqual([
        { kept: 12, kitName: "S62", skipped: 6, total: 18, voiceNumber: 2 },
      ]);
    });
  });

  // #567: setup reads the bank name files once, from where the kits came
  describe("[UC-01] [UC-02] [UC-12] bankNamesSourcePath", () => {
    const state = { sdCardSourcePath: "/Volumes/SD", targetPath: "/store" };

    it("is the card for a card setup", () => {
      expect(bankNamesSourcePath({ ...state, source: "sdcard" })).toBe(
        "/Volumes/SD",
      );
    });

    it("is the store for the factory archive, which was extracted into it", () => {
      expect(bankNamesSourcePath({ ...state, source: "squarp" })).toBe(
        "/store",
      );
    });

    it("is nothing for a blank store", () => {
      expect(
        bankNamesSourcePath({ ...state, source: "blank" }),
      ).toBeUndefined();
      expect(bankNamesSourcePath({ ...state, source: null })).toBeUndefined();
    });
  });
});

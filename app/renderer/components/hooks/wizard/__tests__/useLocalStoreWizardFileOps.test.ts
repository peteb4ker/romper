import { renderHook } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import type { ElectronAPI } from "../../../../electron.d";

import { importSetupBankNames, importSetupKit } from "../../../utils/romperDb";
import {
  bankNamesSourcePath,
  useLocalStoreWizardFileOps,
  type UseLocalStoreWizardFileOpsOptions,
} from "../useLocalStoreWizardFileOps";
import { getElectronAPI } from "../wizardInitUtils";

type Options = UseLocalStoreWizardFileOpsOptions;

/** The API the wizard gets when the preload bridge is missing */
function missingBridgeApi(): ElectronAPI {
  vi.stubGlobal("electronAPI", undefined);
  return getElectronAPI();
}

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

/** Main's listing of a folder holding `files` */
function listed(files: string[]) {
  return { data: files, success: true };
}

describe("useLocalStoreWizardFileOps", () => {
  let mockApi: ElectronAPI;
  let mockReportProgress: Mock<Options["reportProgress"]>;
  let mockReportStepProgress: Mock<Options["reportStepProgress"]>;
  let mockSetError: Mock<Options["setError"]>;
  let mockSetWizardState: Mock<Options["setWizardState"]>;

  beforeEach(() => {
    mockApi = globalThis.electronAPI;
    vi.mocked(mockApi.copyDir).mockResolvedValue({ success: true });
    vi.mocked(mockApi.downloadAndExtractArchive).mockResolvedValue({
      success: true,
    });
    vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
      listed(["A0", "B1", "file.txt"]),
    );

    mockReportProgress = vi.fn<Options["reportProgress"]>();
    mockReportStepProgress = vi.fn<Options["reportStepProgress"]>(
      async ({ items, onStep }) => {
        for (let i = 0; i < items.length; i++) {
          await onStep(items[i], i);
        }
      },
    );
    mockSetError = vi.fn<Options["setError"]>();
    mockSetWizardState = vi.fn<Options["setWizardState"]>();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
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
      const apiWithoutList = missingBridgeApi();

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
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
        listed(["file.txt", "README.md"]),
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
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
        listed(["A0", "B12", "file.txt"]),
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
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
        listed(["A0", "B1"]),
      );
      vi.mocked(mockApi.copyDir).mockResolvedValue({
        error: "card removed",
        success: false,
      });
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
        result.current.validateAndCopySdCardKits("/sd", "/store"),
      ).rejects.toThrow("Couldn't copy kit A0 from the card: card removed");
      expect(mockApi.copyDir).toHaveBeenCalledTimes(1);
    });

    it("should validate and copy kit folders successfully", async () => {
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
        listed(["A0", "B1", "file.txt"]),
      );
      vi.mocked(mockApi.copyDir).mockResolvedValue({ success: true });

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

    // #573: a write treats a lowercase card folder as its kit's, so setup
    // must import it, or the first write would delete a kit it never read
    it("[Q-04] copies a lowercase kit folder in as its upper-case kit", async () => {
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
        listed(["a5", "B1", "Ä1", "_save"]),
      );
      vi.mocked(mockApi.copyDir).mockResolvedValue({ success: true });

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

      expect(mockApi.copyDir).toHaveBeenCalledWith("/sd/card/a5", "/target/A5");
      expect(mockApi.copyDir).toHaveBeenCalledWith("/sd/card/B1", "/target/B1");
      expect(mockApi.copyDir).toHaveBeenCalledTimes(2);
      expect(mockReportStepProgress).toHaveBeenCalledWith({
        items: ["A5", "B1"],
        onStep: expect.any(Function),
        phase: "Copying kits...",
      });
    });

    it("should handle validation errors", async () => {
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
        listed(["file.txt"]),
      ); // No kit folders

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

    it("should handle a missing Electron API", async () => {
      const apiWithoutBridge = missingBridgeApi();

      const { result } = renderHook(() =>
        useLocalStoreWizardFileOps({
          api: apiWithoutBridge,
          reportProgress: mockReportProgress,
          reportStepProgress: mockReportStepProgress,
          setError: mockSetError,
          setWizardState: mockSetWizardState,
        }),
      );

      await expect(
        result.current.validateAndCopySdCardKits("/sd/card", "/target"),
      ).rejects.toThrow("Cannot access filesystem.");
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
      vi.mocked(mockApi.downloadAndExtractArchive).mockResolvedValue({
        success: true,
      });

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
      vi.mocked(mockApi.downloadAndExtractArchive).mockImplementation(
        async (_target, onProgress, onError) => {
          onProgress?.({ percent: 50, phase: "Downloading" });
          onProgress?.({ percent: 100, phase: "Downloading" });
          onError?.(new Error("network blip"));
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
      vi.mocked(mockApi.downloadAndExtractArchive).mockResolvedValue({
        error: reason,
        retryable: false,
        success: false,
      });
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
      vi.mocked(mockApi.downloadAndExtractArchive).mockResolvedValue({
        error: "Disk full",
        success: false,
      });
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
        vi.mocked(mockApi.downloadAndExtractArchive).mockResolvedValue(
          networkFailure,
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
        vi.mocked(mockApi.downloadAndExtractArchive)
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
      const { result } = renderFileOps(missingBridgeApi());

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
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
        listed(["A0", "B1"]),
      ); // Kit folders

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
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(listed(["A0"]));
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
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(listed(["A0"]));
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
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
        listed(["file.txt"]),
      ); // No kit folders

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
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(
        listed(["A0", "invalid-folder", "B12", "README.txt"]),
      ); // Mixed content

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
    it("[UC-01] [UC-02] turns main's voice-full skips into one warning per voice, naming the files (#518)", async () => {
      vi.mocked(mockApi.listFilesInRoot).mockResolvedValue(listed(["S62"]));
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
          reportStepProgress: mockReportStepProgress,
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
        {
          kept: 12,
          kitName: "S62",
          skipped: 6,
          skippedFiles: Array.from(
            { length: 6 },
            (_, i) => `2 tom ${i + 13}.wav`,
          ),
          total: 18,
          voiceNumber: 2,
        },
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

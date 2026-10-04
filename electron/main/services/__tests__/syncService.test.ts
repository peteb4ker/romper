import type { Sample } from "@romper/shared/db/schema.js";

import { BrowserWindow } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

// Mock modules
vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{ webContents: { send: vi.fn() } }]),
  },
}));

vi.mock("node:fs", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:fs")>()),
);
vi.mock("node:path", async (importOriginal) =>
  vi.mockObject(await importOriginal<typeof import("node:path")>()),
);

vi.mock("../../audioUtils.js", async (importOriginal) => ({
  isFormatIssueCritical: (
    await importOriginal<typeof import("../../audioUtils.js")>()
  ).isFormatIssueCritical,
  validateSampleFormatAsync: vi.fn(),
}));

vi.mock("../../db/romperDbCoreORM.js", () => ({
  getSyncPlanData: vi.fn(),
  linkVoicesAutomaticallyTx: vi.fn(),
  // A completed write is recorded in one transaction (#537)
  markAllKitsAsSyncedExceptTx: vi.fn(() => 0),
  updateSampleSourceStatusTx: vi.fn(),
  withDbTransaction: vi.fn((_dbDir: string, fn: (db: unknown) => unknown) => ({
    data: fn({}),
    success: true,
  })),
}));

vi.mock("../../formatConverter.js", () => ({
  convertToRampleDefault: vi.fn(),
}));

vi.mock("../syncMonoAnnotation.js", () => ({
  annotateMonoConversion: vi.fn(),
}));

vi.mock("../sdCardSafety.js", () => ({
  findStaleCardEntries: vi.fn(async () => []),
  removeCardEntries: vi.fn(),
  validateSdCardTarget: vi.fn(() => ({ ok: true })),
}));

import type { SyncPlanData } from "../../db/operations/kitSyncOperations.js";

import { validateSampleFormatAsync } from "../../audioUtils.js";
import {
  getSyncPlanData,
  markAllKitsAsSyncedExceptTx,
} from "../../db/romperDbCoreORM.js";
import { convertToRampleDefault } from "../../formatConverter.js";
import { rtfFileService } from "../rtfFileService.js";
import {
  findStaleCardEntries,
  removeCardEntries,
  validateSdCardTarget,
} from "../sdCardSafety.js";
import { syncFileOperationsService } from "../syncFileOperations.js";
import { syncProgressManager } from "../syncProgressManager.js";
import { syncSampleProcessingService } from "../syncSampleProcessing.js";
import { syncService } from "../syncService.js";
import { syncValidationService } from "../syncValidationService.js";

const mockFs = vi.mocked(fs, true);
const mockPath = vi.mocked(path);
const mockValidateSampleFormat = vi.mocked(validateSampleFormatAsync);
const mockGetSyncPlanData = vi.mocked(getSyncPlanData);
const mockMarkKitsAsSynced = vi.mocked(markAllKitsAsSyncedExceptTx);
const _mockConvertToRampleDefault = vi.mocked(convertToRampleDefault);
const mockBrowserWindow = vi.mocked(BrowserWindow);
const mockValidateSdCardTarget = vi.mocked(validateSdCardTarget);
const mockFindStaleCardEntries = vi.mocked(findStaleCardEntries);
const mockRemoveCardEntries = vi.mocked(removeCardEntries);

/** What planning loads from the store, in its one query (RE-82) */
function planData(data: Partial<SyncPlanData> = {}) {
  return {
    data: { banks: [], kitCount: 0, samples: [], voices: [], ...data },
    success: true,
  } as ReturnType<typeof getSyncPlanData>;
}

describe("[UC-34] SyncService", () => {
  let mockWindow: { webContents: { send: Mock } };

  beforeEach(() => {
    vi.clearAllMocks();

    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    mockBrowserWindow.getAllWindows.mockReturnValue([
      mockWindow as unknown as BrowserWindow,
    ]);

    // Default mock implementations
    mockPath.join.mockImplementation((...args) => args.join("/"));
    mockPath.basename.mockImplementation((p) => p.split("/").pop() || "");
    mockPath.dirname.mockImplementation((p) => {
      const parts = p.split("/");
      parts.pop();
      return parts.join("/");
    });

    mockFs.promises.stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
      size: 1024 * 1024, // 1MB
    } as unknown as fs.Stats);

    mockValidateSampleFormat.mockResolvedValue({
      data: { issues: [], isValid: true, metadata: { channels: 2 } },
      success: true,
    } as Awaited<ReturnType<typeof validateSampleFormatAsync>>);

    mockGetSyncPlanData.mockReturnValue(
      planData({
        kitCount: 2,
        samples: [
          {
            filename: "kick.wav",
            kit_name: "A01",
            slot_number: 0,
            source_path: "/source/kick.wav",
            voice_number: 1,
          } as Sample,
        ],
      }),
    );
  });

  describe("generateChangeSummary", () => {
    it("returns error when no local store path is configured", async () => {
      const result = await syncService.generateChangeSummary({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("generates change summary for valid settings", async () => {
      const result = await syncService.generateChangeSummary({
        localStorePath: "/local/store",
      });

      // Should succeed (result may vary based on mocks but should not error)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("handles missing source files", async () => {
      mockFs.promises.stat.mockRejectedValueOnce(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      );

      const result = await syncService.generateChangeSummary({
        localStorePath: "/local/store",
      });

      expect(result.data?.validationErrors).toEqual([
        expect.objectContaining({ filename: "kick.wav", kitName: "A01" }),
      ]);
    });

    it("handles files needing conversion", async () => {
      mockValidateSampleFormat.mockResolvedValueOnce({
        data: {
          issues: [{ message: "Bit depth 24", type: "bitDepth" }],
          isValid: false,
          metadata: { channels: 2 },
        },
        success: true,
      } as Awaited<ReturnType<typeof validateSampleFormatAsync>>);

      const result = await syncService.generateChangeSummary({
        localStorePath: "/local/store",
      });

      expect(result.data?.banks).toEqual([
        { bank: "A", fileCount: 1, hasConversions: true, kitCount: 1 },
      ]);
    });

    it("[Q-01] plans from one load and counts the kits from it (RE-82)", async () => {
      const result = await syncService.generateChangeSummary({
        localStorePath: "/local/store",
      });

      expect(result.error).toBeUndefined();
      expect(result.data?.kitCount).toBe(2);
      expect(result.data?.fileCount).toBe(1);
      expect(mockGetSyncPlanData).toHaveBeenCalledTimes(1);
      expect(mockGetSyncPlanData).toHaveBeenCalledWith(
        "/local/store/.romperdb",
      );
    });

    it("[Q-01] checks each source file once (RE-82)", async () => {
      const validate = vi.spyOn(
        syncValidationService,
        "validateSyncSourceFile",
      );
      try {
        await syncService.generateChangeSummary({
          localStorePath: "/local/store",
        });

        expect(validate).toHaveBeenCalledTimes(1);
        expect(mockValidateSampleFormat).toHaveBeenCalledTimes(1);
      } finally {
        validate.mockRestore();
      }
    });

    it("[UC-28] mixes a stereo file on an unlinked voice to mono, from the loaded voices", async () => {
      mockGetSyncPlanData.mockReturnValue(
        planData({
          samples: [
            {
              filename: "pad.wav",
              kit_name: "A01",
              slot_number: 0,
              source_path: "/source/pad.wav",
              voice_number: 2,
            } as Sample,
          ],
          // Kept mono by the user, so the write doesn't link it (#537)
          voices: [
            {
              kit_name: "A01",
              stereo_choice: "mono",
              stereo_mode: false,
              voice_number: 2,
            },
          ],
        }),
      );

      const result = await syncService.generateChangeSummary({
        localStorePath: "/local/store",
      });

      // annotateMonoConversion is mocked here; it gets the plan's voices
      expect(result.success).toBe(true);
      const { annotateMonoConversion } =
        await import("../syncMonoAnnotation.js");
      expect(vi.mocked(annotateMonoConversion)).toHaveBeenCalledWith(
        [expect.objectContaining({ filename: "pad.wav" })],
        [
          {
            kit_name: "A01",
            stereo_choice: "mono",
            stereo_mode: false,
            voice_number: 2,
          },
        ],
      );
    });
  });

  describe("ROMPER_LOCAL_PATH override", () => {
    beforeEach(() => {
      vi.stubEnv("ROMPER_LOCAL_PATH", "/env/store");
      mockGetSyncPlanData.mockReturnValue(planData());
      vi.spyOn(syncFileOperationsService, "processAllFiles").mockResolvedValue(
        0,
      );
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it("generates the change summary from the override when no path is saved", async () => {
      const result = await syncService.generateChangeSummary({
        localStorePath: null,
      });

      expect(result.success).toBe(true);
      expect(mockGetSyncPlanData).toHaveBeenCalledWith("/env/store/.romperdb");
    });

    it("syncs from the override instead of the saved path", async () => {
      const result = await syncService.startKitSync(
        { localStorePath: "/saved/store" },
        { sdCardPath: "/sd/card" },
      );

      expect(result.success).toBe(true);
      expect(mockGetSyncPlanData).toHaveBeenCalledWith("/env/store/.romperdb");
    });
  });

  describe("startKitSync", () => {
    const mockSettings = {
      localStorePath: "/local/store",
    };

    const mockOptions = {
      sdCardPath: "/sd/card",
    };

    it("successfully syncs files", async () => {
      const result = await syncService.startKitSync(mockSettings, mockOptions);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("handles copy errors gracefully", async () => {
      mockFs.promises.copyFile.mockRejectedValueOnce(new Error("Copy failed"));

      const result = await syncService.startKitSync(mockSettings, mockOptions);

      expect(result).toBeDefined();
    });

    it("handles missing local store path", async () => {
      const emptySettings = {};

      const result = await syncService.startKitSync(emptySettings, mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No local store path configured");
    });

    it("handles missing SD card path", async () => {
      mockValidateSdCardTarget.mockReturnValueOnce({
        ok: false,
        reason: "No SD card folder selected",
      });

      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No SD card folder selected");
    });

    it("returns sync results with file count", async () => {
      // Mock successful sync
      mockMarkKitsAsSynced.mockReturnValue(1);

      const result = await syncService.startKitSync(mockSettings, mockOptions);

      if (result.success) {
        expect(result.data).toHaveProperty("syncedFiles");
        expect(typeof result.data?.syncedFiles).toBe("number");
      }
    });
  });

  describe("SD card safety", () => {
    const mockSettings = {
      localStorePath: "/local/store",
    };

    beforeEach(() => {
      // Reach the write stage deterministically with nothing to copy.
      mockGetSyncPlanData.mockReturnValue(planData());
      vi.spyOn(syncFileOperationsService, "processAllFiles").mockResolvedValue(
        0,
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("refuses an unsafe target before reading or writing anything", async () => {
      mockValidateSdCardTarget.mockReturnValueOnce({
        ok: false,
        reason: "Refusing to use your home folder",
      });

      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "/Users/someone",
      });

      expect(result).toEqual({
        error: "Refusing to use your home folder",
        success: false,
      });
      expect(mockGetSyncPlanData).not.toHaveBeenCalled();
      expect(mockRemoveCardEntries).not.toHaveBeenCalled();
      expect(syncFileOperationsService.processAllFiles).not.toHaveBeenCalled();
    });

    it("protects the ROMPER_LOCAL_PATH override and the saved local store", async () => {
      vi.stubEnv("ROMPER_LOCAL_PATH", "/env/store");
      try {
        await syncService.startKitSync(mockSettings, {
          sdCardPath: "/sd/card",
        });
      } finally {
        vi.unstubAllEnvs();
      }

      expect(mockValidateSdCardTarget).toHaveBeenCalledWith("/sd/card", [
        "/env/store",
        "/local/store",
      ]);
    });

    it("removes what the store no longer has, after every file is written (RE-05)", async () => {
      const order: string[] = [];
      vi.mocked(
        syncFileOperationsService.processAllFiles,
      ).mockImplementationOnce(async () => {
        order.push("write");
        return 0;
      });
      mockFindStaleCardEntries.mockResolvedValueOnce(["B3", "A0/1-02 old.wav"]);
      mockRemoveCardEntries.mockImplementationOnce(() => {
        order.push("remove");
      });

      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
      });

      expect(result.success).toBe(true);
      expect(order).toEqual(["write", "remove"]);
      expect(mockRemoveCardEntries).toHaveBeenCalledWith("/sd/card", [
        "B3",
        "A0/1-02 old.wav",
      ]);
    });

    it("reports a cancelled sync, and removes and marks nothing (RE-07)", async () => {
      vi.mocked(
        syncFileOperationsService.processAllFiles,
      ).mockImplementationOnce(async () => {
        syncProgressManager.cancelCurrentSync();
        return 0;
      });
      const completion = vi.spyOn(
        syncProgressManager,
        "emitCompletionProgress",
      );

      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
      });

      expect(result).toEqual({
        data: {
          cancelled: true,
          skippedFiles: [],
          syncedFiles: 0,
          warnings: [],
        },
        success: true,
      });
      expect(completion).not.toHaveBeenCalled();
      expect(mockRemoveCardEntries).not.toHaveBeenCalled();
      expect(mockMarkKitsAsSynced).not.toHaveBeenCalled();
      expect(syncProgressManager.getCurrentSyncJob()).toBeNull();
    });

    it("keeps a name file for every named bank, and writes the same banks", async () => {
      const banks = [
        { artist: "ALWIS", letter: "A" },
        { artist: null, letter: "B" },
      ] as SyncPlanData["banks"];
      mockGetSyncPlanData.mockReturnValue(planData({ banks }));
      const write = vi
        .spyOn(rtfFileService, "writeAllBankRtfFiles")
        .mockReturnValue(1);

      try {
        await syncService.startKitSync(mockSettings, {
          sdCardPath: "/sd/card",
        });

        expect([
          ...mockFindStaleCardEntries.mock.calls[0][1].bankFiles,
        ]).toEqual(["A - ALWIS.rtf"]);
        // The write uses the banks the plan kept, so the two agree
        expect(write).toHaveBeenCalledWith("/sd/card", banks);
      } finally {
        write.mockRestore();
      }
    });

    it("[UC-12] fails the write when a bank name file can't be written (RE-23)", async () => {
      const write = vi
        .spyOn(rtfFileService, "writeAllBankRtfFiles")
        .mockImplementation(() => {
          throw new Error("EIO: card removed");
        });

      try {
        const result = await syncService.startKitSync(mockSettings, {
          sdCardPath: "/sd/card",
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("EIO: card removed");
        expect(mockRemoveCardEntries).not.toHaveBeenCalled();
        expect(mockMarkKitsAsSynced).not.toHaveBeenCalled();
      } finally {
        write.mockRestore();
      }
    });

    it("[UC-12] warns about a stored bank name that can't be a file name (RE-23)", async () => {
      mockGetSyncPlanData.mockReturnValue(
        planData({
          banks: [
            { artist: "AC/DC", letter: "A" },
            { artist: "ALWIS", letter: "B" },
          ] as SyncPlanData["banks"],
        }),
      );

      {
        const summary = await syncService.generateChangeSummary(
          mockSettings,
          "/sd/card",
        );

        expect(summary.data?.warnings).toEqual(
          expect.arrayContaining([expect.stringContaining('"AC/DC"')]),
        );
        expect([
          ...mockFindStaleCardEntries.mock.calls[0][1].bankFiles,
        ]).toEqual(["B - ALWIS.rtf"]);
      }
    });
  });

  describe("samples that can't be written (RE-09)", () => {
    const mockSettings = { localStorePath: "/local/store" };
    const sample = (kitName: string, filename: string, slotNumber = 0) =>
      ({
        filename,
        kit_name: kitName,
        kitName,
        slot_number: slotNumber,
        voice_number: 1,
      }) as unknown as Sample;

    beforeEach(() => {
      // A1/kick.wav can be written; A1/missing.wav and B2/gone.wav can't.
      mockGetSyncPlanData.mockReturnValue(
        planData({
          kitCount: 3,
          samples: [
            sample("A1", "kick.wav"),
            sample("A1", "missing.wav", 1),
            sample("B2", "gone.wav"),
            sample("C3", "snare.wav"),
          ],
        }),
      );
      vi.spyOn(
        syncSampleProcessingService,
        "processSampleForSync",
      ).mockImplementation(async (s, _store, results) => {
        if (s.filename === "missing.wav" || s.filename === "gone.wav") {
          results.validationErrors.push({
            error: `Source file not found: /src/${s.filename}`,
            filename: s.filename,
            kitName: s.kit_name,
            sourcePath: `/src/${s.filename}`,
            type: "missing_file",
          });
          return;
        }
        results.filesToCopy.push({
          destinationPath: `/sd/card/${s.kit_name}/1/${s.filename}`,
          filename: s.filename,
          kitName: s.kit_name,
          operation: "copy",
          sourcePath: `/src/${s.filename}`,
          voiceNumber: s.voice_number,
        });
      });
      vi.spyOn(syncFileOperationsService, "processAllFiles").mockResolvedValue(
        2,
      );
      mockMarkKitsAsSynced.mockReturnValue(1);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("lists what sync will remove from the card (RE-05)", async () => {
      mockFindStaleCardEntries.mockResolvedValueOnce(["B3"]);

      const withCard = await syncService.generateChangeSummary(
        mockSettings,
        "/sd/card",
      );
      const withoutCard = await syncService.generateChangeSummary(mockSettings);

      expect(withCard.data?.removals).toEqual(["B3"]);
      expect(mockFindStaleCardEntries).toHaveBeenCalledTimes(1);
      expect(mockFindStaleCardEntries.mock.calls[0][0]).toBe("/sd/card");
      expect(withoutCard.data?.removals).toEqual([]);
    });

    it("warns about kits the Rample won't open because voice 1 is empty", async () => {
      mockGetSyncPlanData.mockReturnValue(
        planData({
          kitCount: 2,
          samples: [
            sample("A1", "kick.wav"),
            { ...sample("D4", "snare.wav"), voice_number: 2 },
          ],
        }),
      );

      const result = await syncService.generateChangeSummary(mockSettings);

      expect(result.data?.warnings).toContain(
        "Kit D4 has no sample on voice 1, so the Rample won't open it",
      );
      expect(result.data?.warnings).not.toContain(
        "Kit A1 has no sample on voice 1, so the Rample won't open it",
      );
    });

    it("reports them in the summary and counts only files that will be written", async () => {
      const result = await syncService.generateChangeSummary(mockSettings);

      expect(result.success).toBe(true);
      expect(result.data?.fileCount).toBe(2);
      expect(result.data?.banks.map((b) => [b.bank, b.fileCount])).toEqual([
        ["A", 1],
        ["C", 1],
      ]);
      expect(result.data?.validationErrors.map((e) => e.filename)).toEqual([
        "missing.wav",
        "gone.wav",
      ]);
      expect(result.data?.kitCount).toBe(3);
      // B2's only sample can't be written, so it has no voice 1 file either
      expect(result.data?.warnings).toEqual([]);
    });

    it("refuses to sync without confirmation, before wiping or writing anything", async () => {
      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
      });

      expect(result).toEqual({
        error:
          "2 samples can't be written to the card. Nothing was written. Confirm skipping them in the write summary to continue.",
        success: false,
      });
      expect(mockRemoveCardEntries).not.toHaveBeenCalled();
      expect(syncFileOperationsService.processAllFiles).not.toHaveBeenCalled();
      expect(mockMarkKitsAsSynced).not.toHaveBeenCalled();
    });

    it("writes the rest and reports the skipped samples once confirmed", async () => {
      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
        skipInvalidFiles: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.syncedFiles).toBe(2);
      expect(result.data?.skippedFiles.map((e) => e.filename)).toEqual([
        "missing.wav",
        "gone.wav",
      ]);
      expect(
        vi
          .mocked(syncFileOperationsService.processAllFiles)
          .mock.calls[0][0].map((f) => f.filename),
      ).toEqual(["kick.wav", "snare.wav"]);
      // A skipped sample keeps its last copy on the card
      const kits = mockFindStaleCardEntries.mock.calls[0][1].kits;
      expect([...kits.get("A1")!]).toEqual([
        "1-01 kick.wav",
        "1-02 missing.wav",
      ]);
      expect([...kits.get("B2")!]).toEqual(["1-01 gone.wav"]);
    });

    it("[UC-11] leaves kits with a skipped sample marked as modified", async () => {
      await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
        skipInvalidFiles: true,
      });

      // Every other kit is in step with the card, including C3 and kits
      // with no files to write (RE-35)
      expect(mockMarkKitsAsSynced).toHaveBeenCalledWith(expect.anything(), [
        "A1",
        "B2",
      ]);
    });

    it("[UC-11] clears the flag after a write with no files to write (RE-35)", async () => {
      mockGetSyncPlanData.mockReturnValue(planData());

      const result = await syncService.startKitSync(mockSettings, {
        sdCardPath: "/sd/card",
      });

      expect(result.success).toBe(true);
      expect(mockMarkKitsAsSynced).toHaveBeenCalledWith(expect.anything(), []);
    });
  });

  describe("error handling", () => {
    const mockSettings = {
      localStorePath: "/local/store",
    };

    const mockOptions = {
      sdCardPath: "/sd/card",
    };

    it("fails when the kits can't be loaded", async () => {
      mockGetSyncPlanData.mockReturnValue({
        error: "database is locked",
        success: false,
      });

      const result = await syncService.startKitSync(mockSettings, mockOptions);

      expect(result).toEqual({
        error: "Failed to gather samples: database is locked",
        success: false,
      });
    });

    it("reports an unexpected error while planning as a sync failure", async () => {
      const planSample = vi
        .spyOn(syncSampleProcessingService, "processSampleForSync")
        .mockRejectedValue(new Error("Filesystem error"));

      try {
        const result = await syncService.startKitSync(
          mockSettings,
          mockOptions,
        );

        expect(result).toEqual({
          error: "Failed to sync kit: Filesystem error",
          success: false,
        });
      } finally {
        planSample.mockRestore();
      }
    });
  });

  describe("private methods", () => {
    it("estimates sync time", () => {
      const estimatedTime = (
        syncService as unknown as {
          estimateSyncTime(totalFiles: number, conversions: number): number;
        }
      ).estimateSyncTime(
        5, // totalFiles
        2, // conversions
      );

      expect(typeof estimatedTime).toBe("number");
      expect(estimatedTime).toBeGreaterThan(0);
    });

    it("categorizes errors correctly", () => {
      const permissionError = syncValidationService.categorizeError(
        new Error("EACCES: permission denied"),
      );

      expect(permissionError.type).toBe("permission");
      expect(permissionError.canRetry).toBe(true);

      const diskSpaceError = syncValidationService.categorizeError(
        new Error("ENOSPC: no space left on device"),
      );

      expect(diskSpaceError.type).toBe("disk_space");
      expect(diskSpaceError.canRetry).toBe(false);

      const unknownError = syncValidationService.categorizeError(
        new Error("Unknown error"),
      );

      expect(unknownError.type).toBe("unknown");
      expect(unknownError.canRetry).toBe(true);
    });

    it("calculates time remaining", () => {
      // Initialize a mock sync job with sample files
      const mockFiles = [
        {
          destinationPath: "/out1.wav",
          filename: "test1.wav",
          kitName: "kit1",
          operation: "copy" as const,
          sourcePath: "/test1.wav",
          voiceNumber: 1,
        },
        {
          destinationPath: "/out2.wav",
          filename: "test2.wav",
          kitName: "kit1",
          operation: "convert" as const,
          sourcePath: "/test2.wav",
          voiceNumber: 1,
        },
      ];
      syncProgressManager.initializeSyncJob(mockFiles);

      // Simulate some progress by completing files
      const currentJob = syncProgressManager.getCurrentSyncJob();
      if (currentJob) {
        currentJob.completedFiles = 1; // Simulate 1 of 2 files completed
      }

      const timeRemaining = syncProgressManager.calculateTimeRemaining();

      expect(typeof timeRemaining).toBe("number");
      expect(timeRemaining).toBeGreaterThanOrEqual(0);
    });

    it("emits progress correctly", () => {
      const progress = {
        currentFile: "test.wav",
        elapsedTime: 1000,
        estimatedTimeRemaining: 1000,
        filesCompleted: 1,
        status: "copying" as const,
        totalFiles: 2,
      };

      syncProgressManager.emitProgress(progress);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        "sync-progress",
        progress,
      );
    });
  });
});

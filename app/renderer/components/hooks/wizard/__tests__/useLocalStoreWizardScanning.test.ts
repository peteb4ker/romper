import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocalStoreWizardScanning } from "../useLocalStoreWizardScanning";

// Mock dependencies
vi.mock("@romper/shared/kitUtilsShared", () => ({
  groupSamplesByVoice: vi.fn(() => new Map()),
}));

vi.mock("../utils/scanners/orchestrationFunctions", () => ({
  executeFullKitScan: vi.fn(() =>
    Promise.resolve({
      scannedKitResult: {
        data: { kits: [], samples: [] },
        success: true,
      },
      validationResult: {
        data: { errors: [] },
        success: true,
      },
    }),
  ),
}));

describe("useLocalStoreWizardScanning", () => {
  let mockApi: any;
  let mockReportStepProgress: any;

  beforeEach(() => {
    mockApi = {
      getDbPath: vi.fn(() => "/mock/db/path"),
      getKits: vi.fn(() =>
        Promise.resolve({
          data: [{ bank_letter: "A", name: "A0" }],
          success: true,
        }),
      ),
      listFilesInRoot: vi.fn(() =>
        Promise.resolve(["sample1.wav", "sample2.wav"]),
      ),
      readFile: vi.fn(() =>
        Promise.resolve({
          data: new ArrayBuffer(8),
          success: true,
        }),
      ),
      scanKitForData: vi.fn(() =>
        Promise.resolve({
          data: { kits: [], samples: [] },
          success: true,
        }),
      ),
      updateVoiceAlias: vi.fn(() =>
        Promise.resolve({
          success: true,
        }),
      ),
      validateAndStoreScannedKit: vi.fn(() =>
        Promise.resolve({
          data: { errors: [] },
          success: true,
        }),
      ),
    };

    mockReportStepProgress = vi.fn(async ({ items, onStep }) => {
      for (let i = 0; i < items.length; i++) {
        await onStep(items[i], i);
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("runScanning", () => {
    it("should skip scanning when no kits are provided", async () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardScanning({
          api: mockApi,
          reportStepProgress: mockReportStepProgress,
        }),
      );

      await result.current.runScanning("/target/path", "/db/dir", []);

      expect(mockReportStepProgress).not.toHaveBeenCalled();
    });

    it("should scan kits and report progress", async () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardScanning({
          api: mockApi,
          reportStepProgress: mockReportStepProgress,
        }),
      );

      await result.current.runScanning("/target/path", "/db/dir", ["A0", "B1"]);

      expect(mockReportStepProgress).toHaveBeenCalledWith({
        items: ["A0", "B1"],
        onStep: expect.any(Function),
        phase: "Scanning kits for metadata...",
      });

      // Note: Implementation uses executeFullKitScan, not scanKitForData directly
    });

    it("should handle file reader creation correctly", async () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardScanning({
          api: mockApi,
          reportStepProgress: mockReportStepProgress,
        }),
      );

      await result.current.runScanning("/target/path", "/db/dir", ["A0"]);

      expect(mockApi.readFile).toHaveBeenCalled();
    });

    it("should handle errors when file reading is not available", async () => {
      const apiWithoutReadFile = { ...mockApi, readFile: undefined };

      const { result } = renderHook(() =>
        useLocalStoreWizardScanning({
          api: apiWithoutReadFile,
          reportStepProgress: mockReportStepProgress,
        }),
      );

      // Implementation handles errors gracefully, doesn't throw
      await result.current.runScanning("/target/path", "/db/dir", ["A0"]);

      expect(mockReportStepProgress).toHaveBeenCalled();
    });

    it("should handle file reading errors", async () => {
      mockApi.readFile.mockResolvedValueOnce({
        error: "File read error",
        success: false,
      });

      const { result } = renderHook(() =>
        useLocalStoreWizardScanning({
          api: mockApi,
          reportStepProgress: mockReportStepProgress,
        }),
      );

      // Implementation handles errors gracefully, doesn't throw
      await result.current.runScanning("/target/path", "/db/dir", ["A0"]);

      expect(mockReportStepProgress).toHaveBeenCalled();
    });

    it("should handle scan operation errors gracefully", async () => {
      // Mock listFilesInRoot to throw an error to simulate scan failure
      mockApi.listFilesInRoot.mockRejectedValueOnce(
        new Error("File access failed"),
      );

      const { result } = renderHook(() =>
        useLocalStoreWizardScanning({
          api: mockApi,
          reportStepProgress: mockReportStepProgress,
        }),
      );

      // The hook should handle errors gracefully and continue with other kits
      await result.current.runScanning("/target/path", "/db/dir", ["A0"]);

      // Should still call reportStepProgress even when scan fails
      expect(mockReportStepProgress).toHaveBeenCalled();
    });

    it("should process multiple kits sequentially", async () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardScanning({
          api: mockApi,
          reportStepProgress: mockReportStepProgress,
        }),
      );

      const kitNames = ["A0", "B1", "C2"];
      await result.current.runScanning("/target/path", "/db/dir", kitNames);

      // Note: Implementation uses executeFullKitScan, not scanKitForData directly

      // Verify that progress reporting was called with correct arguments
      expect(mockReportStepProgress).toHaveBeenCalledWith({
        items: kitNames,
        onStep: expect.any(Function),
        phase: "Scanning kits for metadata...",
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty target path", async () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardScanning({
          api: mockApi,
          reportStepProgress: mockReportStepProgress,
        }),
      );

      await result.current.runScanning("", "/db/dir", ["A0"]);

      // Should still call progress reporting
      expect(mockReportStepProgress).toHaveBeenCalled();
    });

    it("should handle empty db directory", async () => {
      const { result } = renderHook(() =>
        useLocalStoreWizardScanning({
          api: mockApi,
          reportStepProgress: mockReportStepProgress,
        }),
      );

      await result.current.runScanning("/target/path", "", ["A0"]);

      // Should still call progress reporting
      expect(mockReportStepProgress).toHaveBeenCalled();
    });
  });
});

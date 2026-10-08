import type { Sample } from "@romper/shared/db/schema.js";

import { beforeEach, describe, expect, test, vi } from "vitest";

import { createMockSample } from "../../../../../../tests/factories/sample.factory";
import { useSampleManagementUndoActions } from "../useSampleManagementUndoActions.js";

// The result types the action creators take (not exported by the hook)
type ReindexOperationResult = Parameters<
  UndoActions["createReindexSamplesAction"]
>[3];
type SampleOperationResult = Parameters<
  UndoActions["createSameKitMoveAction"]
>[0]["result"];
type UndoActions = ReturnType<typeof useSampleManagementUndoActions>;

// Mock window.electronAPI
const mockElectronAPI = {
  getAllSamplesForKit: vi.fn(),
};

Object.defineProperty(window, "electronAPI", {
  value: mockElectronAPI,
  writable: true,
});

// Mock React hook
vi.mock("react", () => ({
  useCallback: vi.fn((fn) => fn),
}));

describe("Type Interfaces for Sample Management", () => {
  const mockOptions = {
    kitName: "TestKit",
    skipUndoRecording: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ReindexOperationResult interface", () => {
    test("should handle successful reindex result with data", () => {
      const mockSamples: Sample[] = [
        createMockSample({
          filename: "test.wav",
          id: 1,
          kit_name: "TestKit",
          slot_number: 0,
          source_path: "/path/to/test.wav",
          voice_number: 1,
          wav_bitrate: null,
          wav_sample_rate: null,
        }),
      ];

      const reindexResult: ReindexOperationResult = {
        data: {
          affectedSamples: mockSamples,
        },
        success: true,
      };

      expect(reindexResult.success).toBe(true);
      expect(reindexResult.data?.affectedSamples).toHaveLength(1);
      expect(reindexResult.data?.affectedSamples[0].filename).toBe("test.wav");
    });

    test("should handle failed reindex result without data", () => {
      const reindexResult: ReindexOperationResult = {
        data: undefined,
        success: false,
      };

      expect(reindexResult.success).toBe(false);
      expect(reindexResult.data).toBeUndefined();
    });

    test("should handle reindex result with empty affected samples", () => {
      const reindexResult: ReindexOperationResult = {
        data: {
          affectedSamples: [],
        },
        success: true,
      };

      expect(reindexResult.success).toBe(true);
      expect(reindexResult.data?.affectedSamples).toHaveLength(0);
    });
  });

  describe("SampleOperationResult interface", () => {
    test("should handle successful sample operation with all data", () => {
      const mockMovedSample = createMockSample({
        filename: "moved.wav",
        id: 1,
        kit_name: "TestKit",
        slot_number: 0,
        source_path: "/path/to/moved.wav",
        voice_number: 1,
        wav_bitrate: null,
        wav_sample_rate: null,
      });

      const sampleResult: SampleOperationResult = {
        data: {
          affectedSamples: [mockMovedSample],
          movedSample: mockMovedSample,
        },
        success: true,
      };

      expect(sampleResult.success).toBe(true);
      expect(sampleResult.data?.movedSample.filename).toBe("moved.wav");
      expect(sampleResult.data?.affectedSamples).toHaveLength(1);
    });

    test("should handle failed sample operation", () => {
      const sampleResult: SampleOperationResult = {
        data: undefined,
        success: false,
      };

      expect(sampleResult.success).toBe(false);
      expect(sampleResult.data).toBeUndefined();
    });
  });

  describe("Integration with actual hook", () => {
    test("should return all expected action creators", () => {
      const result = useSampleManagementUndoActions(mockOptions);

      const expectedMethods: (keyof UndoActions)[] = [
        "createAddSampleAction",
        "createReindexSamplesAction",
        "createSameKitMoveAction",
        "createCrossKitMoveAction",
      ];

      expectedMethods.forEach((method) => {
        expect(result).toHaveProperty(method);
        expect(typeof result[method]).toBe("function");
      });
    });

    test("should handle skip undo recording flag", () => {
      const skipUndoOptions = {
        ...mockOptions,
        skipUndoRecording: true,
      };

      const result = useSampleManagementUndoActions(skipUndoOptions);
      expect(result).toBeDefined();
      expect(typeof result.createAddSampleAction).toBe("function");
    });
  });
});

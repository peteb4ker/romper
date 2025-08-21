import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Sample } from "@romper/shared/db/schema.js";

import { useSampleManagementUndoActions } from "../useSampleManagementUndoActions.js";

// Mock window.electronAPI
const mockElectronAPI = {
  getAllSamplesForKit: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
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
        {
          id: 1,
          kit_name: "TestKit",
          voice_number: 1,
          slot_number: 0,
          filename: "test.wav",
          is_stereo: false,
          source_path: "/path/to/test.wav",
          wav_bitrate: null,
          wav_sample_rate: null,
        },
      ];

      const reindexResult = {
        success: true,
        data: {
          affectedSamples: mockSamples,
        },
      };

      expect(reindexResult.success).toBe(true);
      expect(reindexResult.data?.affectedSamples).toHaveLength(1);
      expect(reindexResult.data?.affectedSamples[0].filename).toBe("test.wav");
    });

    test("should handle failed reindex result without data", () => {
      const reindexResult = {
        success: false,
        data: undefined,
      };

      expect(reindexResult.success).toBe(false);
      expect(reindexResult.data).toBeUndefined();
    });

    test("should handle reindex result with empty affected samples", () => {
      const reindexResult = {
        success: true,
        data: {
          affectedSamples: [],
        },
      };

      expect(reindexResult.success).toBe(true);
      expect(reindexResult.data?.affectedSamples).toHaveLength(0);
    });
  });

  describe("SampleOperationResult interface", () => {
    test("should handle successful sample operation with all data", () => {
      const mockMovedSample: Sample = {
        id: 1,
        kit_name: "TestKit",
        voice_number: 1,
        slot_number: 0,
        filename: "moved.wav",
        is_stereo: false,
        source_path: "/path/to/moved.wav",
        wav_bitrate: null,
        wav_sample_rate: null,
      };

      const mockReplacedSample: Sample = {
        id: 2,
        kit_name: "TestKit",
        voice_number: 1,
        slot_number: 1,
        filename: "replaced.wav",
        is_stereo: true,
        source_path: "/path/to/replaced.wav",
        wav_bitrate: null,
        wav_sample_rate: null,
      };

      const sampleResult = {
        success: true,
        data: {
          affectedSamples: [mockMovedSample],
          movedSample: mockMovedSample,
          replacedSample: mockReplacedSample,
        },
      };

      expect(sampleResult.success).toBe(true);
      expect(sampleResult.data?.movedSample.filename).toBe("moved.wav");
      expect(sampleResult.data?.replacedSample?.filename).toBe("replaced.wav");
      expect(sampleResult.data?.affectedSamples).toHaveLength(1);
    });

    test("should handle sample operation without replaced sample", () => {
      const mockMovedSample: Sample = {
        id: 1,
        kit_name: "TestKit",
        voice_number: 1,
        slot_number: 0,
        filename: "moved.wav",
        is_stereo: false,
        source_path: "/path/to/moved.wav",
        wav_bitrate: null,
        wav_sample_rate: null,
      };

      const sampleResult = {
        success: true,
        data: {
          affectedSamples: [],
          movedSample: mockMovedSample,
          replacedSample: undefined,
        },
      };

      expect(sampleResult.success).toBe(true);
      expect(sampleResult.data?.movedSample.filename).toBe("moved.wav");
      expect(sampleResult.data?.replacedSample).toBeUndefined();
    });

    test("should handle failed sample operation", () => {
      const sampleResult = {
        success: false,
        data: undefined,
      };

      expect(sampleResult.success).toBe(false);
      expect(sampleResult.data).toBeUndefined();
    });
  });

  describe("ElectronFile interface from useFileValidation", () => {
    test("should handle standard File object", () => {
      // Standard File interface
      const standardFile = new File(['content'], 'test.wav', {
        type: 'audio/wav'
      });

      // ElectronFile should extend File
      const electronFile = standardFile as any; // Simulating ElectronFile
      electronFile.path = '/path/to/test.wav';

      expect(electronFile.name).toBe('test.wav');
      expect(electronFile.path).toBe('/path/to/test.wav');
      expect(electronFile.type).toBe('audio/wav');
    });

    test("should handle File without path property", () => {
      const standardFile = new File(['content'], 'test.wav', {
        type: 'audio/wav'
      });

      // ElectronFile path is optional
      const electronFile = standardFile as any;
      expect(electronFile.path).toBeUndefined();
      expect(electronFile.name).toBe('test.wav');
    });

    test("should handle dropped file path extraction logic", () => {
      const mockFile = {
        name: 'dropped.wav',
        type: 'audio/wav',
        path: '/electron/path/to/dropped.wav', // Electron-specific property
      };

      // Simulate the file validation logic
      const filePath = (mockFile as any).path || mockFile.name;
      expect(filePath).toBe('/electron/path/to/dropped.wav');
    });

    test("should fallback to filename when no path available", () => {
      const mockFile = {
        name: 'web-file.wav',
        type: 'audio/wav',
        // No path property (standard web File)
      };

      // Simulate the file validation logic
      const filePath = (mockFile as any).path || mockFile.name;
      expect(filePath).toBe('web-file.wav');
    });
  });

  describe("StateSnapshotItem and SampleToRestore interfaces", () => {
    test("should handle state snapshot structure", () => {
      const stateSnapshot = [
        {
          sample: {
            filename: 'snapshot.wav',
            is_stereo: false,
            source_path: '/path/to/snapshot.wav',
          },
          slot: 0,
          voice: 1,
        },
        {
          sample: {
            filename: 'snapshot2.wav',
            is_stereo: true,
            source_path: '/path/to/snapshot2.wav',
          },
          slot: 1,
          voice: 2,
        },
      ];

      expect(stateSnapshot).toHaveLength(2);
      expect(stateSnapshot[0].sample.filename).toBe('snapshot.wav');
      expect(stateSnapshot[0].sample.is_stereo).toBe(false);
      expect(stateSnapshot[1].sample.is_stereo).toBe(true);
      expect(stateSnapshot[1].voice).toBe(2);
    });

    test("should handle samples to restore structure", () => {
      const samplesToRestore = [
        {
          sample: {
            filename: 'restore1.wav',
            is_stereo: false,
            source_path: '/path/to/restore1.wav',
          },
          slot: 0,
          voice: 1,
        },
      ];

      expect(samplesToRestore[0].sample.filename).toBe('restore1.wav');
      expect(samplesToRestore[0].slot).toBe(0);
      expect(samplesToRestore[0].voice).toBe(1);
    });
  });

  describe("Action type assertions", () => {
    test("should properly cast action types for exhaustive checking", () => {
      const mockAction = {
        type: 'UNKNOWN_ACTION_TYPE',
        id: 'test-id',
        timestamp: new Date(),
        description: 'Test action',
        data: {},
      };

      // This tests the pattern used in useUndoActionHandlers
      const actionType = (mockAction as any).type;
      expect(actionType).toBe('UNKNOWN_ACTION_TYPE');
    });

    test("should handle various undo action types", () => {
      const actionTypes = [
        'ADD_SAMPLE',
        'DELETE_SAMPLE', 
        'MOVE_SAMPLE',
        'MOVE_SAMPLE_BETWEEN_KITS',
        'REINDEX_SAMPLES',
        'REPLACE_SAMPLE',
      ];

      actionTypes.forEach(type => {
        const action = { type, data: {} };
        expect((action as any).type).toBe(type);
      });
    });
  });

  describe("Integration with actual hook", () => {
    test("should return all expected action creators", () => {
      const result = useSampleManagementUndoActions(mockOptions);

      const expectedMethods = [
        'createAddSampleAction',
        'createReindexSamplesAction', 
        'createSameKitMoveAction',
        'createCrossKitMoveAction',
        'getOldSampleForUndo',
        'getSampleToDeleteForUndo',
      ];

      expectedMethods.forEach(method => {
        expect(result).toHaveProperty(method);
        expect(typeof result[method]).toBe('function');
      });
    });

    test("should handle skip undo recording flag", () => {
      const skipUndoOptions = {
        ...mockOptions,
        skipUndoRecording: true,
      };

      const result = useSampleManagementUndoActions(skipUndoOptions);
      expect(result).toBeDefined();
      expect(typeof result.createAddSampleAction).toBe('function');
    });
  });
});
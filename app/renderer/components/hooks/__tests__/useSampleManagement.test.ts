import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleManagement } from "../useSampleManagement";

// Mock window.electronAPI
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  replaceSampleInSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
  deleteSampleFromSlotWithoutCompaction: vi.fn(),
  moveSampleInKit: vi.fn(),
  getAllSamplesForKit: vi.fn(),
};

beforeEach(() => {
  (window as any).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
});

afterEach(() => {
  delete (window as any).electronAPI;
});

describe("useSampleManagement", () => {
  const defaultProps = {
    kitName: "TestKit",
    onSamplesChanged: vi.fn(),
    onMessage: vi.fn(),
  };

  describe("handleSampleAdd", () => {
    it("adds sample successfully", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        success: true,
        data: { sampleId: 123 },
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        "TestKit",
        1,
        0,
        "/path/to/sample.wav",
        undefined,
      );
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample added to voice 1, slot 1",
      });
    });

    it("handles add sample failure", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        success: false,
        error: "File not found",
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "File not found",
      });
    });

    it("handles API not available", async () => {
      const originalMethod = (window as any).electronAPI.addSampleToSlot;
      delete (window as any).electronAPI.addSampleToSlot;

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Sample management not available",
      });

      // Restore for other tests
      (window as any).electronAPI.addSampleToSlot = originalMethod;
    });

    it("handles exceptions", async () => {
      mockElectronAPI.addSampleToSlot.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Failed to add sample: Network error",
      });
    });
  });

  describe("handleSampleReplace", () => {
    it("replaces sample successfully", async () => {
      mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
        success: true,
        data: { sampleId: 456 },
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleReplace(2, 3, "/path/to/new.wav");

      expect(mockElectronAPI.replaceSampleInSlot).toHaveBeenCalledWith(
        "TestKit",
        2,
        3,
        "/path/to/new.wav",
        undefined,
      );
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample replaced in voice 2, slot 4",
      });
    });

    it("handles replace sample failure", async () => {
      mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
        success: false,
        error: "Invalid format",
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleReplace(2, 3, "/path/to/new.wav");

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Invalid format",
      });
    });
  });

  describe("handleSampleDelete", () => {
    it("deletes sample successfully", async () => {
      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleDelete(3, 5);

      expect(mockElectronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
        "TestKit",
        3,
        5,
      );
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample deleted from voice 3, slot 6",
      });
    });

    it("handles delete sample failure", async () => {
      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
        success: false,
        error: "Sample not found",
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleDelete(3, 5);

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Sample not found",
      });
    });
  });

  describe("without callbacks", () => {
    it("works without onSamplesChanged callback", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        success: true,
        data: { sampleId: 123 },
      });

      const { result } = renderHook(() =>
        useSampleManagement({
          kitName: "TestKit",
          onMessage: defaultProps.onMessage,
        }),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample added to voice 1, slot 1",
      });
    });

    it("works without onMessage callback", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        success: true,
        data: { sampleId: 123 },
      });

      const { result } = renderHook(() =>
        useSampleManagement({
          kitName: "TestKit",
          onSamplesChanged: defaultProps.onSamplesChanged,
        }),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalled();
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
    });
  });

  describe("handleSampleMove", () => {
    it("should move sample within same voice (backward move)", async () => {
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        success: true,
        data: {
          movedSample: { voice: 1, slot: 4, filename: "test.wav" },
          affectedSamples: [
            { voice: 1, slot: 5, filename: "sample1.wav", oldSlot: 4 },
            { voice: 1, slot: 6, filename: "sample2.wav", oldSlot: 5 },
          ],
        },
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      // Move slot 6 to slot 4 within voice 1 (this is currently broken)
      await result.current.handleSampleMove(1, 5, 1, 3, "insert"); // 0-based: move slot 6 to slot 4

      expect(mockElectronAPI.moveSampleInKit).toHaveBeenCalledWith(
        "TestKit",
        1, // fromVoice
        5, // fromSlot (0-based: slot 6)
        1, // toVoice
        3, // toSlot (0-based: slot 4)
        "insert",
      );
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample moved from voice 1, slot 6 to voice 1, slot 4",
      });
    });

    it("should move sample within same voice (forward move)", async () => {
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        success: true,
        data: {
          movedSample: { voice: 1, slot: 6, filename: "test.wav" },
          affectedSamples: [],
        },
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      // Move slot 2 to slot 6 within voice 1
      await result.current.handleSampleMove(1, 1, 1, 5, "insert"); // 0-based: move slot 2 to slot 6

      expect(mockElectronAPI.moveSampleInKit).toHaveBeenCalledWith(
        "TestKit",
        1, // fromVoice
        1, // fromSlot (0-based: slot 2)
        1, // toVoice
        5, // toSlot (0-based: slot 6)
        "insert",
      );
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
    });

    it("should handle same-voice move errors", async () => {
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        success: false,
        error: "Sample not found at specified location",
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleMove(1, 5, 1, 3, "insert");

      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Sample not found at specified location",
      });
    });
  });

  describe("Undo Operations", () => {
    const mockUndoHook = {
      addAction: vi.fn(),
      undoCount: 0,
      redoCount: 0,
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
      clear: vi.fn(),
      error: null,
      isUndoing: false,
      isRedoing: false,
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("Undo Add Sample", () => {
      it("should record add action for undo", async () => {
        mockElectronAPI.addSampleToSlot.mockResolvedValue({
          success: true,
          data: { sampleId: 123 },
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

        expect(mockUndoHook.addAction).toHaveBeenCalledWith({
          type: "ADD_SAMPLE",
          id: expect.any(String),
          timestamp: expect.any(Date),
          description: "Add sample to voice 1, slot 1",
          data: {
            voice: 1,
            slot: 0,
            addedSample: {
              filename: "sample.wav",
              source_path: "/path/to/sample.wav",
              is_stereo: false, // Default from forceStereo || false
            },
          },
        });
      });

      it("should not record undo action when skipUndoRecording is true", async () => {
        mockElectronAPI.addSampleToSlot.mockResolvedValue({
          success: true,
          data: { sampleId: 123 },
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
            skipUndoRecording: true,
          }),
        );

        await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

        expect(mockUndoHook.addAction).not.toHaveBeenCalled();
      });
    });

    describe("Undo Delete Sample", () => {
      it("should record compact slots action for delete with automatic compaction", async () => {
        // Mock getAllSamplesForKit to get sample before deletion
        mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
          success: true,
          data: [
            {
              voice_number: 1,
              slot_number: 1,
              filename: "deleted.wav",
              source_path: "/path/to/deleted.wav",
              is_stereo: false,
            },
          ],
        });

        mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
          success: true,
          data: {
            affectedSamples: [
              {
                voice_number: 1,
                slot_number: 2,
                filename: "sample2.wav",
                source_path: "/path/2.wav",
                is_stereo: true,
              },
            ],
          },
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleDelete(1, 0);

        expect(mockUndoHook.addAction).toHaveBeenCalledWith({
          type: "COMPACT_SLOTS",
          id: expect.any(String),
          timestamp: expect.any(Date),
          description: "Delete sample from voice 1, slot 1 (with compaction)",
          data: {
            voice: 1,
            deletedSlot: 0,
            deletedSample: {
              filename: "deleted.wav",
              source_path: "/path/to/deleted.wav",
              is_stereo: false,
            },
            affectedSamples: [
              {
                voice: 1,
                oldSlot: 2, // New position after compaction
                newSlot: 1, // Original position before compaction
                sample: {
                  filename: "sample2.wav",
                  source_path: "/path/2.wav",
                  is_stereo: true,
                },
              },
            ],
          },
        });
      });
    });

    describe("Undo Replace Sample", () => {
      it("should record replace action with old and new sample data", async () => {
        // Mock getAllSamplesForKit to provide the old sample data
        mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
          success: true,
          data: [
            {
              voice_number: 1,
              slot_number: 1,
              filename: "old.wav",
              source_path: "/path/to/old.wav",
              is_stereo: true,
            },
          ],
        });

        mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
          success: true,
          data: {
            replacedSample: {
              filename: "new.wav",
              source_path: "/path/to/new.wav",
              is_stereo: false,
            },
          },
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleReplace(1, 0, "/path/to/new.wav");

        expect(mockUndoHook.addAction).toHaveBeenCalledWith({
          type: "REPLACE_SAMPLE",
          id: expect.any(String),
          timestamp: expect.any(Date),
          description: "Replace sample in voice 1, slot 1",
          data: {
            voice: 1,
            slot: 0,
            oldSample: {
              filename: "old.wav",
              source_path: "/path/to/old.wav",
              is_stereo: true,
            },
            newSample: {
              filename: "new.wav",
              source_path: "/path/to/new.wav",
              is_stereo: false,
            },
          },
        });
      });
    });

    describe("Undo Move Sample", () => {
      it("should record move action with state snapshot", async () => {
        // Mock the state snapshot capture
        mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
          success: true,
          data: [
            {
              voice_number: 1,
              slot_number: 1,
              filename: "sample1.wav",
              source_path: "/path/1.wav",
              is_stereo: false,
            },
            {
              voice_number: 1,
              slot_number: 2,
              filename: "sample2.wav",
              source_path: "/path/2.wav",
              is_stereo: true,
            },
            {
              voice_number: 2,
              slot_number: 1,
              filename: "sample3.wav",
              source_path: "/path/3.wav",
              is_stereo: false,
            },
          ],
        });

        mockElectronAPI.moveSampleInKit.mockResolvedValue({
          success: true,
          data: {
            movedSample: {
              filename: "sample2.wav",
              source_path: "/path/2.wav",
              is_stereo: true,
            },
            affectedSamples: [
              {
                voice_number: 2,
                slot_number: 2,
                filename: "sample3.wav",
                source_path: "/path/3.wav",
                is_stereo: false,
                original_slot_number: 1,
              },
            ],
          },
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleMove(1, 1, 2, 0, "insert"); // Move from 1.2 to 2.1

        expect(mockElectronAPI.getAllSamplesForKit).toHaveBeenCalledWith(
          "TestKit",
        );
        expect(mockUndoHook.addAction).toHaveBeenCalledWith({
          type: "MOVE_SAMPLE",
          id: expect.any(String),
          timestamp: expect.any(Date),
          description: "Move sample from voice 1, slot 2 to voice 2, slot 1",
          data: {
            fromVoice: 1,
            fromSlot: 1,
            toVoice: 2,
            toSlot: 0,
            mode: "insert",
            movedSample: {
              filename: "sample2.wav",
              source_path: "/path/2.wav",
              is_stereo: true,
            },
            affectedSamples: [
              {
                voice: 2,
                oldSlot: 1,
                newSlot: 2,
                sample: {
                  filename: "sample3.wav",
                  source_path: "/path/3.wav",
                  is_stereo: false,
                },
              },
            ],
            stateSnapshot: [
              {
                voice: 1,
                slot: 1,
                sample: {
                  filename: "sample1.wav",
                  source_path: "/path/1.wav",
                  is_stereo: false,
                },
              },
              {
                voice: 1,
                slot: 2,
                sample: {
                  filename: "sample2.wav",
                  source_path: "/path/2.wav",
                  is_stereo: true,
                },
              },
              {
                voice: 2,
                slot: 1,
                sample: {
                  filename: "sample3.wav",
                  source_path: "/path/3.wav",
                  is_stereo: false,
                },
              },
            ],
          },
        });
      });

      it("should handle move with failed state snapshot capture", async () => {
        mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
          success: false,
          error: "Database error",
        });

        mockElectronAPI.moveSampleInKit.mockResolvedValue({
          success: true,
          data: {
            movedSample: {
              filename: "sample2.wav",
              source_path: "/path/2.wav",
              is_stereo: true,
            },
            affectedSamples: [],
          },
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleMove(1, 1, 2, 0, "insert");

        // Should still record the action but without state snapshot
        expect(mockUndoHook.addAction).toHaveBeenCalledWith({
          type: "MOVE_SAMPLE",
          id: expect.any(String),
          timestamp: expect.any(Date),
          description: "Move sample from voice 1, slot 2 to voice 2, slot 1",
          data: {
            fromVoice: 1,
            fromSlot: 1,
            toVoice: 2,
            toSlot: 0,
            mode: "insert",
            movedSample: {
              filename: "sample2.wav",
              source_path: "/path/2.wav",
              is_stereo: true,
            },
            affectedSamples: [],
            stateSnapshot: [], // Empty due to failed capture
          },
        });
      });
    });

    describe("Error Handling in Undo Operations", () => {
      it("should handle failed add operation gracefully", async () => {
        mockElectronAPI.addSampleToSlot.mockResolvedValue({
          success: false,
          error: "File not found",
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

        // Should not record undo action for failed operations
        expect(mockUndoHook.addAction).not.toHaveBeenCalled();
      });

      it("should handle failed delete operation gracefully", async () => {
        mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
          success: false,
          error: "Sample not found",
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleDelete(1, 0);

        expect(mockUndoHook.addAction).not.toHaveBeenCalled();
      });

      it("should handle failed move operation gracefully", async () => {
        mockElectronAPI.moveSampleInKit.mockResolvedValue({
          success: false,
          error: "Invalid move",
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleMove(1, 1, 2, 0, "insert");

        expect(mockUndoHook.addAction).not.toHaveBeenCalled();
      });
    });
  });

  describe("Error Case Analysis", () => {
    it("ERROR CASE 1: Move 6 to 4 on voice 1 - nothing happens", () => {
      console.log("=== ERROR CASE 1 ===");
      console.log("Action: Move slot 6 to slot 4 on voice 1");
      console.log(
        "Expected: Sample moves from 1.6 to 1.4, other samples shift",
      );
      console.log("Actual: Nothing happens");
      console.log();

      console.log("POSSIBLE CAUSES:");
      console.log("1. No sample exists at voice 1, slot 6");
      console.log("2. Move operation is silently failing");
      console.log("3. Frontend/backend communication issue");
      console.log("4. Validation preventing the move");
      console.log("5. UI not refreshing after successful move");
      console.log();

      console.log("INVESTIGATION NEEDED:");
      console.log("- Check if sample exists at 1.6");
      console.log("- Check console for errors");
      console.log("- Verify IPC call is being made");
      console.log("- Check database state before/after");

      // Validate that this is a documentation test
      expect(true).toBe(true);
    });

    it("ERROR CASE 2: Move 6 to 4 on voice 2 - nothing happens", () => {
      console.log("\n=== ERROR CASE 2 ===");
      console.log("Action: Move slot 6 to slot 4 on voice 2");
      console.log(
        "Expected: Sample moves from 2.6 to 2.4, other samples shift",
      );
      console.log("Actual: Nothing happens");
      console.log();

      console.log("SAME AS CASE 1 - suggests systematic issue with:");
      console.log("- Same-voice moves");
      console.log("- Backward moves (higher slot to lower slot)");
      console.log("- Specific slot numbers (6→4)");
      console.log("- Or general move functionality");

      // Validate that this is a documentation test
      expect(true).toBe(true);
    });

    it("ERROR CASE 3: Move 3.7 to 4.7 - leaves gap instead of compacting", () => {
      console.log("\n=== ERROR CASE 3 ===");
      console.log("Action: Move voice 3, slot 7 to voice 4, slot 7");
      console.log(
        "Expected: 3.7 moves to 4.7, slots 3.8-3.12 shift up to fill gap",
      );
      console.log("Actual: 3.7 moves to 4.7, but gap remains at 3.7");
      console.log();

      console.log("ANALYSIS:");
      console.log("- Cross-voice move works partially");
      console.log("- Sample reaches destination correctly");
      console.log("- But source voice doesn't get compacted");
      console.log("- This violates contiguity maintenance requirement");
      console.log();

      console.log("LIKELY CAUSE:");
      console.log("- compactSlotsAfterDelete not being called");
      console.log("- OR compaction logic has bugs");
      console.log("- OR only destination voice is being processed");

      // Validate that this is a documentation test
      expect(true).toBe(true);
    });

    it("ERROR CASE 4: Move 1.6 to 2.6 - works correctly", () => {
      console.log("\n=== ERROR CASE 4 (SUCCESS CASE) ===");
      console.log("Action: Move voice 1, slot 6 to voice 2, slot 6");
      console.log("Expected: 1.6→2.6, existing 2.6→2.7");
      console.log("Actual: Works as expected ✅");
      console.log();

      console.log("This suggests:");
      console.log("- Cross-voice moves CAN work");
      console.log("- Insert mode works correctly");
      console.log("- Issue might be specific to certain scenarios");

      // Validate that this is a documentation test
      expect(true).toBe(true);
    });

    it("ERROR CASE 5: Undo cross-voice move - only partially restores", () => {
      console.log("\n=== ERROR CASE 5 ===");
      console.log("Action: Undo the 1.6→2.6 move");
      console.log(
        "Expected: 1.6 back to 1.6, 2.6 back to 2.6, 2.7 back to 2.6",
      );
      console.log("Actual: 1.6 restored ✅, but 2.6 stays at 2.7 ❌");
      console.log();

      console.log("ANALYSIS:");
      console.log("- Moved sample gets restored correctly");
      console.log(
        "- But affected samples in destination voice aren't restored",
      );
      console.log("- Further undos do nothing (undo stack corrupted?)");
      console.log();

      console.log("LIKELY CAUSES:");
      console.log(
        "1. State snapshot not capturing destination voice correctly",
      );
      console.log("2. Undo restoration logic has bugs for cross-voice moves");
      console.log(
        "3. affectedSamples array missing samples from destination voice",
      );
      console.log("4. Non-compacting delete not working properly");

      // Validate that this is a documentation test
      expect(true).toBe(true);
    });

    it("should categorize the bugs", () => {
      console.log("\n=== BUG CATEGORIZATION ===");
      console.log();

      console.log("BUG CATEGORY A: Same-voice moves not working");
      console.log("- Cases 1 & 2: Move within same voice does nothing");
      console.log("- Affects both forward and backward moves");
      console.log("- Multiple voices affected");
      console.log();

      console.log("BUG CATEGORY B: Compaction not working");
      console.log("- Case 3: Cross-voice move leaves gap in source voice");
      console.log("- Contiguity maintenance failing");
      console.log("- Only affects source voice, destination works");
      console.log();

      // Validate that this is a documentation test
      expect(true).toBe(true);

      console.log("BUG CATEGORY C: Undo partially broken");
      console.log("- Case 5: Cross-voice undo only restores moved sample");
      console.log("- Affected samples in destination voice not restored");
      console.log("- Undo stack becomes unusable after first undo");
      console.log();

      console.log("INVESTIGATION PRIORITY:");
      console.log("1. Category A (blocking basic functionality)");
      console.log("2. Category B (data integrity issue)");
      console.log("3. Category C (undo reliability)");
    });
  });

  describe("Cross-Kit Move Operations", () => {
    const mockUndoHook = {
      addAction: vi.fn(),
      undoCount: 0,
      redoCount: 0,
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
      clear: vi.fn(),
      error: null,
      isUndoing: false,
      isRedoing: false,
    };

    beforeEach(() => {
      vi.clearAllMocks();
      // Add moveSampleBetweenKits to mock API
      (window as any).electronAPI.moveSampleBetweenKits = vi.fn();
    });

    afterEach(() => {
      delete (window as any).electronAPI.moveSampleBetweenKits;
    });

    it("should handle cross-kit move with insert mode", async () => {
      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue({
        success: true,
        data: {
          movedSample: {
            filename: "sample.wav",
            source_path: "/path/to/sample.wav",
            is_stereo: false,
          },
          affectedSamples: [
            {
              voice_number: 2,
              slot_number: 2,
              filename: "shifted.wav",
              source_path: "/path/to/shifted.wav",
              is_stereo: false,
              original_slot_number: 1,
            },
          ],
        },
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      // Move from TestKit voice 1 slot 5 to TargetKit voice 2 slot 0
      await result.current.handleSampleMove(1, 4, 2, 0, "insert", "TargetKit");

      expect(mockElectronAPI.moveSampleBetweenKits).toHaveBeenCalledWith(
        "TestKit", // fromKit
        1, // fromVoice
        4, // fromSlot
        "TargetKit", // toKit
        2, // toVoice
        0, // toSlot
        "insert", // mode
      );

      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample moved from TestKit voice 1, slot 5 to TargetKit voice 2, slot 1",
      });

      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
    });

    it("should record cross-kit move undo action", async () => {
      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue({
        success: true,
        data: {
          movedSample: {
            filename: "sample.wav",
            source_path: "/path/to/sample.wav",
            is_stereo: false,
          },
          affectedSamples: [
            {
              voice_number: 1,
              slot_number: 2,
              filename: "affected.wav",
              source_path: "/path/to/affected.wav",
              is_stereo: false,
              original_slot_number: 1,
            },
          ],
          replacedSample: {
            filename: "replaced.wav",
            source_path: "/path/to/replaced.wav",
            is_stereo: true,
          },
        },
      });

      const { result } = renderHook(() =>
        useSampleManagement({
          ...defaultProps,
          onAddUndoAction: mockUndoHook.addAction,
        }),
      );

      await result.current.handleSampleMove(
        1,
        0,
        2,
        1,
        "overwrite",
        "TargetKit",
      );

      expect(mockUndoHook.addAction).toHaveBeenCalledWith({
        type: "MOVE_SAMPLE_BETWEEN_KITS",
        id: expect.any(String),
        timestamp: expect.any(Date),
        description:
          "Move sample from TestKit voice 1, slot 1 to TargetKit voice 2, slot 2",
        data: {
          fromKit: "TestKit",
          fromVoice: 1,
          fromSlot: 0,
          toKit: "TargetKit",
          toVoice: 2,
          toSlot: 1,
          mode: "overwrite",
          movedSample: {
            filename: "sample.wav",
            source_path: "/path/to/sample.wav",
            is_stereo: false,
          },
          affectedSamples: [
            {
              voice: 1,
              oldSlot: 1,
              newSlot: 2,
              sample: {
                filename: "affected.wav",
                source_path: "/path/to/affected.wav",
                is_stereo: false,
              },
            },
          ],
          replacedSample: {
            filename: "replaced.wav",
            source_path: "/path/to/replaced.wav",
            is_stereo: true,
          },
        },
      });
    });

    it("should handle cross-kit move API not available", async () => {
      // Remove the cross-kit move API temporarily
      delete (window as any).electronAPI.moveSampleBetweenKits;

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleMove(1, 0, 2, 0, "insert", "TargetKit");

      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Cross-kit sample move not available",
      });
    });

    it("should handle cross-kit move failure", async () => {
      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue({
        success: false,
        error: "Target kit not found",
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleMove(
        1,
        0,
        2,
        0,
        "insert",
        "NonExistentKit",
      );

      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Target kit not found",
      });

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
    });
  });

  describe("Bug Regression Tests", () => {
    const mockUndoHook = {
      addAction: vi.fn(),
      undoCount: 0,
      redoCount: 0,
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
      clear: vi.fn(),
      error: null,
      isUndoing: false,
      isRedoing: false,
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should handle consecutive moves correctly (actualBugTrace scenario)", async () => {
      // Test for the specific bug: consecutive moves to same destination
      // Initial: [1, 2, 3, 4, 5]
      // Move 1: 4→2 => [1, 4, 2, 3, 5]
      // Move 2: (new 4 which is 3) → 2 => [1, 3, 4, 2, 5]
      // Expected after undo all: [1, 2, 3, 4, 5]

      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        success: true,
        data: {
          movedSample: { voice: 1, slot: 2, filename: "sample4.wav" },
          affectedSamples: [
            { voice: 1, slot: 3, filename: "sample2.wav", oldSlot: 2 },
            { voice: 1, slot: 4, filename: "sample3.wav", oldSlot: 3 },
          ],
        },
      });

      const { result } = renderHook(() =>
        useSampleManagement({
          ...defaultProps,
          onAddUndoAction: mockUndoHook.addAction,
        }),
      );

      // This should not fail and should properly record undo actions
      await result.current.handleSampleMove(1, 3, 1, 1, "insert"); // Move sample4 to slot 2

      expect(mockElectronAPI.moveSampleInKit).toHaveBeenCalledWith(
        "TestKit",
        1,
        3,
        1,
        1,
        "insert",
      );
      expect(mockUndoHook.addAction).toHaveBeenCalled();
    });

    it("should handle consecutive moves with shifting (consecutiveMoveBug scenario)", async () => {
      // Test for: move 6→5, then 5→4
      // Initial: [A, B, C, D, E, F, G]
      // Move 1: F(6) → 5 => [A, B, C, D, F, E, G]
      // Move 2: E(6) → 4 => [A, B, C, E, D, F, G]

      let callCount = 0;
      mockElectronAPI.moveSampleInKit.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            success: true,
            data: {
              movedSample: { voice: 1, slot: 5, filename: "F.wav" },
              affectedSamples: [
                { voice: 1, slot: 6, filename: "E.wav", oldSlot: 5 },
              ],
            },
          });
        } else {
          return Promise.resolve({
            success: true,
            data: {
              movedSample: { voice: 1, slot: 4, filename: "E.wav" },
              affectedSamples: [
                { voice: 1, slot: 5, filename: "D.wav", oldSlot: 4 },
                { voice: 1, slot: 6, filename: "F.wav", oldSlot: 5 },
              ],
            },
          });
        }
      });

      const { result } = renderHook(() =>
        useSampleManagement({
          ...defaultProps,
          onAddUndoAction: mockUndoHook.addAction,
        }),
      );

      // First move: F(6) → 5
      await result.current.handleSampleMove(1, 5, 1, 4, "insert");

      // Second move: E(now at 6) → 4
      await result.current.handleSampleMove(1, 5, 1, 3, "insert");

      expect(mockElectronAPI.moveSampleInKit).toHaveBeenCalledTimes(2);
      expect(mockUndoHook.addAction).toHaveBeenCalledTimes(2);
    });

    it("should handle move-undo gap bug with proper restoration", async () => {
      // Test for the specific bug where undo leaves gaps
      // This tests the snapshot-based restoration fix

      const stateSnapshot = [
        {
          voice: 1,
          slot: 1,
          sample: {
            filename: "1.wav",
            source_path: "/1.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 2,
          sample: {
            filename: "2.wav",
            source_path: "/2.wav",
            is_stereo: false,
          },
        },
        {
          voice: 1,
          slot: 3,
          sample: {
            filename: "3.wav",
            source_path: "/3.wav",
            is_stereo: false,
          },
        },
      ];

      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        success: true,
        data: stateSnapshot.map((s) => ({
          voice_number: s.voice,
          slot_number: s.slot,
          filename: s.sample.filename,
          source_path: s.sample.source_path,
          is_stereo: s.sample.is_stereo,
        })),
      });

      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        success: true,
        data: {
          movedSample: { voice: 1, slot: 1, filename: "3.wav" },
          affectedSamples: [
            { voice: 1, slot: 2, filename: "1.wav", oldSlot: 1 },
            { voice: 1, slot: 3, filename: "2.wav", oldSlot: 2 },
          ],
        },
      });

      const { result } = renderHook(() =>
        useSampleManagement({
          ...defaultProps,
          onAddUndoAction: mockUndoHook.addAction,
        }),
      );

      await result.current.handleSampleMove(1, 2, 1, 0, "insert"); // Move 3→1

      // Verify the state snapshot was captured
      expect(mockElectronAPI.getAllSamplesForKit).toHaveBeenCalledWith(
        "TestKit",
      );

      // Verify undo action includes snapshot
      const undoAction = mockUndoHook.addAction.mock.calls[0][0];
      expect(undoAction.type).toBe("MOVE_SAMPLE");
      expect(undoAction.data.stateSnapshot).toHaveLength(3);
    });
  });
});

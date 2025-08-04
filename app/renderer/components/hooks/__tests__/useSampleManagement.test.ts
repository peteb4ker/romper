import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleManagement } from "../useSampleManagement";

// Mock window.electronAPI
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
  deleteSampleFromSlotWithoutCompaction: vi.fn(),
  getAllSamplesForKit: vi.fn(),
  moveSampleInKit: vi.fn(),
  replaceSampleInSlot: vi.fn(),
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
    onMessage: vi.fn(),
    onSamplesChanged: vi.fn(),
  };

  describe("handleSampleAdd", () => {
    it("adds sample successfully", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        data: { sampleId: 123 },
        success: true,
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
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Sample added to voice 1, slot 1",
        "success",
      );
    });

    it("handles add sample failure", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        error: "File not found",
        success: false,
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "File not found",
        "error",
      );
    });

    it("handles API not available", async () => {
      const originalMethod = (window as any).electronAPI.addSampleToSlot;
      delete (window as any).electronAPI.addSampleToSlot;

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Sample management not available",
        "error",
      );

      // Restore for other tests
      (window as any).electronAPI.addSampleToSlot = originalMethod;
    });

    it("handles exceptions", async () => {
      mockElectronAPI.addSampleToSlot.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Failed to add sample: Network error",
        "error",
      );
    });
  });

  describe("handleSampleReplace", () => {
    it("replaces sample successfully", async () => {
      mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
        data: { sampleId: 456 },
        success: true,
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
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Sample replaced in voice 2, slot 4",
        "success",
      );
    });

    it("handles replace sample failure", async () => {
      mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
        error: "Invalid format",
        success: false,
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleReplace(2, 3, "/path/to/new.wav");

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Invalid format",
        "error",
      );
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
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Sample deleted from voice 3, slot 6",
        "success",
      );
    });

    it("handles delete sample failure", async () => {
      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
        error: "Sample not found",
        success: false,
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleDelete(3, 5);

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Sample not found",
        "error",
      );
    });
  });

  describe("without callbacks", () => {
    it("works without onSamplesChanged callback", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        data: { sampleId: 123 },
        success: true,
      });

      const { result } = renderHook(() =>
        useSampleManagement({
          kitName: "TestKit",
          onMessage: defaultProps.onMessage,
        }),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Sample added to voice 1, slot 1",
        "success",
      );
    });

    it("works without onMessage callback", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        data: { sampleId: 123 },
        success: true,
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
        data: {
          affectedSamples: [
            { filename: "sample1.wav", oldSlot: 4, slot: 5, voice: 1 },
            { filename: "sample2.wav", oldSlot: 5, slot: 6, voice: 1 },
          ],
          movedSample: { filename: "test.wav", slot: 4, voice: 1 },
        },
        success: true,
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
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Sample moved from voice 1, slot 6 to voice 1, slot 4",
        "success",
      );
    });

    it("should move sample within same voice (forward move)", async () => {
      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: {
          affectedSamples: [],
          movedSample: { filename: "test.wav", slot: 6, voice: 1 },
        },
        success: true,
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
        error: "Sample not found at specified location",
        success: false,
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleMove(1, 5, 1, 3, "insert");

      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Sample not found at specified location",
        "error",
      );
    });
  });

  describe("Undo Operations", () => {
    const mockUndoHook = {
      addAction: vi.fn(),
      canRedo: false,
      canUndo: false,
      clear: vi.fn(),
      error: null,
      isRedoing: false,
      isUndoing: false,
      redo: vi.fn(),
      redoCount: 0,
      undo: vi.fn(),
      undoCount: 0,
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("Undo Add Sample", () => {
      it("should record add action for undo", async () => {
        mockElectronAPI.addSampleToSlot.mockResolvedValue({
          data: { sampleId: 123 },
          success: true,
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

        expect(mockUndoHook.addAction).toHaveBeenCalledWith({
          data: {
            addedSample: {
              filename: "sample.wav",
              is_stereo: false, // Default from forceStereo || false
              source_path: "/path/to/sample.wav",
            },
            slot: 0,
            voice: 1,
          },
          description: "Add sample to voice 1, slot 1",
          id: expect.any(String),
          timestamp: expect.any(Date),
          type: "ADD_SAMPLE",
        });
      });

      it("should not record undo action when skipUndoRecording is true", async () => {
        mockElectronAPI.addSampleToSlot.mockResolvedValue({
          data: { sampleId: 123 },
          success: true,
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
          data: [
            {
              filename: "deleted.wav",
              is_stereo: false,
              slot_number: 1,
              source_path: "/path/to/deleted.wav",
              voice_number: 1,
            },
          ],
          success: true,
        });

        mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
          data: {
            affectedSamples: [
              {
                filename: "sample2.wav",
                is_stereo: true,
                slot_number: 2,
                source_path: "/path/2.wav",
                voice_number: 1,
              },
            ],
          },
          success: true,
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleDelete(1, 0);

        expect(mockUndoHook.addAction).toHaveBeenCalledWith({
          data: {
            affectedSamples: [
              {
                newSlot: 1, // Original position before compaction
                oldSlot: 2, // New position after compaction
                sample: {
                  filename: "sample2.wav",
                  is_stereo: true,
                  source_path: "/path/2.wav",
                },
                voice: 1,
              },
            ],
            deletedSample: {
              filename: "deleted.wav",
              is_stereo: false,
              source_path: "/path/to/deleted.wav",
            },
            deletedSlot: 0,
            voice: 1,
          },
          description: "Delete sample from voice 1, slot 1 (with compaction)",
          id: expect.any(String),
          timestamp: expect.any(Date),
          type: "COMPACT_SLOTS",
        });
      });
    });

    describe("Undo Replace Sample", () => {
      it("should record replace action with old and new sample data", async () => {
        // Mock getAllSamplesForKit to provide the old sample data
        mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
          data: [
            {
              filename: "old.wav",
              is_stereo: true,
              slot_number: 1,
              source_path: "/path/to/old.wav",
              voice_number: 1,
            },
          ],
          success: true,
        });

        mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
          data: {
            replacedSample: {
              filename: "new.wav",
              is_stereo: false,
              source_path: "/path/to/new.wav",
            },
          },
          success: true,
        });

        const { result } = renderHook(() =>
          useSampleManagement({
            ...defaultProps,
            onAddUndoAction: mockUndoHook.addAction,
          }),
        );

        await result.current.handleSampleReplace(1, 0, "/path/to/new.wav");

        expect(mockUndoHook.addAction).toHaveBeenCalledWith({
          data: {
            newSample: {
              filename: "new.wav",
              is_stereo: false,
              source_path: "/path/to/new.wav",
            },
            oldSample: {
              filename: "old.wav",
              is_stereo: true,
              source_path: "/path/to/old.wav",
            },
            slot: 0,
            voice: 1,
          },
          description: "Replace sample in voice 1, slot 1",
          id: expect.any(String),
          timestamp: expect.any(Date),
          type: "REPLACE_SAMPLE",
        });
      });
    });

    describe("Undo Move Sample", () => {
      it("should record move action with state snapshot", async () => {
        // Mock the state snapshot capture
        mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
          data: [
            {
              filename: "sample1.wav",
              is_stereo: false,
              slot_number: 1,
              source_path: "/path/1.wav",
              voice_number: 1,
            },
            {
              filename: "sample2.wav",
              is_stereo: true,
              slot_number: 2,
              source_path: "/path/2.wav",
              voice_number: 1,
            },
            {
              filename: "sample3.wav",
              is_stereo: false,
              slot_number: 1,
              source_path: "/path/3.wav",
              voice_number: 2,
            },
          ],
          success: true,
        });

        mockElectronAPI.moveSampleInKit.mockResolvedValue({
          data: {
            affectedSamples: [
              {
                filename: "sample3.wav",
                is_stereo: false,
                original_slot_number: 1,
                slot_number: 2,
                source_path: "/path/3.wav",
                voice_number: 2,
              },
            ],
            movedSample: {
              filename: "sample2.wav",
              is_stereo: true,
              source_path: "/path/2.wav",
            },
          },
          success: true,
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
          data: {
            affectedSamples: [
              {
                newSlot: 2,
                oldSlot: 1,
                sample: {
                  filename: "sample3.wav",
                  is_stereo: false,
                  source_path: "/path/3.wav",
                },
                voice: 2,
              },
            ],
            fromSlot: 1,
            fromVoice: 1,
            mode: "insert",
            movedSample: {
              filename: "sample2.wav",
              is_stereo: true,
              source_path: "/path/2.wav",
            },
            stateSnapshot: [
              {
                sample: {
                  filename: "sample1.wav",
                  is_stereo: false,
                  source_path: "/path/1.wav",
                },
                slot: 1,
                voice: 1,
              },
              {
                sample: {
                  filename: "sample2.wav",
                  is_stereo: true,
                  source_path: "/path/2.wav",
                },
                slot: 2,
                voice: 1,
              },
              {
                sample: {
                  filename: "sample3.wav",
                  is_stereo: false,
                  source_path: "/path/3.wav",
                },
                slot: 1,
                voice: 2,
              },
            ],
            toSlot: 0,
            toVoice: 2,
          },
          description: "Move sample from voice 1, slot 2 to voice 2, slot 1",
          id: expect.any(String),
          timestamp: expect.any(Date),
          type: "MOVE_SAMPLE",
        });
      });

      it("should handle move with failed state snapshot capture", async () => {
        mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
          error: "Database error",
          success: false,
        });

        mockElectronAPI.moveSampleInKit.mockResolvedValue({
          data: {
            affectedSamples: [],
            movedSample: {
              filename: "sample2.wav",
              is_stereo: true,
              source_path: "/path/2.wav",
            },
          },
          success: true,
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
          data: {
            affectedSamples: [],
            fromSlot: 1,
            fromVoice: 1,
            mode: "insert",
            movedSample: {
              filename: "sample2.wav",
              is_stereo: true,
              source_path: "/path/2.wav",
            },
            stateSnapshot: [], // Empty due to failed capture
            toSlot: 0,
            toVoice: 2,
          },
          description: "Move sample from voice 1, slot 2 to voice 2, slot 1",
          id: expect.any(String),
          timestamp: expect.any(Date),
          type: "MOVE_SAMPLE",
        });
      });
    });

    describe("Error Handling in Undo Operations", () => {
      it("should handle failed add operation gracefully", async () => {
        mockElectronAPI.addSampleToSlot.mockResolvedValue({
          error: "File not found",
          success: false,
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
          error: "Sample not found",
          success: false,
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
          error: "Invalid move",
          success: false,
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
      canRedo: false,
      canUndo: false,
      clear: vi.fn(),
      error: null,
      isRedoing: false,
      isUndoing: false,
      redo: vi.fn(),
      redoCount: 0,
      undo: vi.fn(),
      undoCount: 0,
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
        data: {
          affectedSamples: [
            {
              filename: "shifted.wav",
              is_stereo: false,
              original_slot_number: 1,
              slot_number: 2,
              source_path: "/path/to/shifted.wav",
              voice_number: 2,
            },
          ],
          movedSample: {
            filename: "sample.wav",
            is_stereo: false,
            source_path: "/path/to/sample.wav",
          },
        },
        success: true,
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

      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Sample moved from TestKit voice 1, slot 5 to TargetKit voice 2, slot 1",
        "success",
      );

      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
    });

    it("should record cross-kit move undo action", async () => {
      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue({
        data: {
          affectedSamples: [
            {
              filename: "affected.wav",
              is_stereo: false,
              original_slot_number: 1,
              slot_number: 2,
              source_path: "/path/to/affected.wav",
              voice_number: 1,
            },
          ],
          movedSample: {
            filename: "sample.wav",
            is_stereo: false,
            source_path: "/path/to/sample.wav",
          },
          replacedSample: {
            filename: "replaced.wav",
            is_stereo: true,
            source_path: "/path/to/replaced.wav",
          },
        },
        success: true,
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
        data: {
          affectedSamples: [
            {
              newSlot: 2,
              oldSlot: 1,
              sample: {
                filename: "affected.wav",
                is_stereo: false,
                source_path: "/path/to/affected.wav",
              },
              voice: 1,
            },
          ],
          fromKit: "TestKit",
          fromSlot: 0,
          fromVoice: 1,
          mode: "overwrite",
          movedSample: {
            filename: "sample.wav",
            is_stereo: false,
            source_path: "/path/to/sample.wav",
          },
          replacedSample: {
            filename: "replaced.wav",
            is_stereo: true,
            source_path: "/path/to/replaced.wav",
          },
          toKit: "TargetKit",
          toSlot: 1,
          toVoice: 2,
        },
        description:
          "Move sample from TestKit voice 1, slot 1 to TargetKit voice 2, slot 2",
        id: expect.any(String),
        timestamp: expect.any(Date),
        type: "MOVE_SAMPLE_BETWEEN_KITS",
      });
    });

    it("should handle cross-kit move API not available", async () => {
      // Remove the cross-kit move API temporarily
      delete (window as any).electronAPI.moveSampleBetweenKits;

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleMove(1, 0, 2, 0, "insert", "TargetKit");

      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Cross-kit sample move not available",
        "error",
      );
    });

    it("should handle cross-kit move failure", async () => {
      mockElectronAPI.moveSampleBetweenKits.mockResolvedValue({
        error: "Target kit not found",
        success: false,
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

      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Target kit not found",
        "error",
      );

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
    });
  });

  describe("Bug Regression Tests", () => {
    const mockUndoHook = {
      addAction: vi.fn(),
      canRedo: false,
      canUndo: false,
      clear: vi.fn(),
      error: null,
      isRedoing: false,
      isUndoing: false,
      redo: vi.fn(),
      redoCount: 0,
      undo: vi.fn(),
      undoCount: 0,
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
        data: {
          affectedSamples: [
            { filename: "sample2.wav", oldSlot: 2, slot: 3, voice: 1 },
            { filename: "sample3.wav", oldSlot: 3, slot: 4, voice: 1 },
          ],
          movedSample: { filename: "sample4.wav", slot: 2, voice: 1 },
        },
        success: true,
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
            data: {
              affectedSamples: [
                { filename: "E.wav", oldSlot: 5, slot: 6, voice: 1 },
              ],
              movedSample: { filename: "F.wav", slot: 5, voice: 1 },
            },
            success: true,
          });
        } else {
          return Promise.resolve({
            data: {
              affectedSamples: [
                { filename: "D.wav", oldSlot: 4, slot: 5, voice: 1 },
                { filename: "F.wav", oldSlot: 5, slot: 6, voice: 1 },
              ],
              movedSample: { filename: "E.wav", slot: 4, voice: 1 },
            },
            success: true,
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
          sample: {
            filename: "1.wav",
            is_stereo: false,
            source_path: "/1.wav",
          },
          slot: 1,
          voice: 1,
        },
        {
          sample: {
            filename: "2.wav",
            is_stereo: false,
            source_path: "/2.wav",
          },
          slot: 2,
          voice: 1,
        },
        {
          sample: {
            filename: "3.wav",
            is_stereo: false,
            source_path: "/3.wav",
          },
          slot: 3,
          voice: 1,
        },
      ];

      mockElectronAPI.getAllSamplesForKit.mockResolvedValue({
        data: stateSnapshot.map((s) => ({
          filename: s.sample.filename,
          is_stereo: s.sample.is_stereo,
          slot_number: s.slot,
          source_path: s.sample.source_path,
          voice_number: s.voice,
        })),
        success: true,
      });

      mockElectronAPI.moveSampleInKit.mockResolvedValue({
        data: {
          affectedSamples: [
            { filename: "1.wav", oldSlot: 1, slot: 2, voice: 1 },
            { filename: "2.wav", oldSlot: 2, slot: 3, voice: 1 },
          ],
          movedSample: { filename: "3.wav", slot: 1, voice: 1 },
        },
        success: true,
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

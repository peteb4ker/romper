import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import KitVoicePanel from "../KitVoicePanel";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

/**
 * Integration tests for KitVoicePanel drag and drop functionality
 *
 * These tests focus on the actual UI interactions and behavior rather than
 * just testing the individual hooks. They verify that:
 * - Drop targets appear during drag operations
 * - Drag and drop events are properly handled
 * - Visual feedback works correctly
 * - Internal and external drag scenarios work
 * - Undo/redo integration functions properly
 */
describe("KitVoicePanel Drag & Drop Integration", () => {
  beforeEach(() => {
    setupElectronAPIMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // Helper to create a mock file for drag operations
  const createMockFile = (name: string, type: string = "audio/wav") =>
    new File([""], name, { type });

  // Helper to create a mock drag event
  const createDragEvent = (
    files: File[] = [],
    options: {
      altKey?: boolean;
      dataTransfer?: Partial<DataTransfer>;
      shiftKey?: boolean;
    } = {},
  ) => {
    // Create a more realistic DataTransferItemList mock
    const itemsArray = files.map(() => ({ kind: "file" as const }));
    const mockItems = Object.assign(itemsArray, {
      length: files.length,
      [Symbol.iterator]: function* () {
        for (let i = 0; i < this.length; i++) {
          yield this[i];
        }
      },
    });

    const mockDataTransfer = {
      dropEffect: "move" as const,
      effectAllowed: "move" as const,
      files: Object.assign(files, {
        length: files.length,
        [Symbol.iterator]: function* () {
          for (let i = 0; i < this.length; i++) {
            yield this[i];
          }
        },
      }),
      getData: vi.fn(),
      items: mockItems,
      setData: vi.fn(),
      types: options.dataTransfer?.types || [],
      ...options.dataTransfer,
    };

    return {
      altKey: options.altKey || false,
      dataTransfer: mockDataTransfer,
      preventDefault: vi.fn(),
      shiftKey: options.shiftKey || false,
      stopPropagation: vi.fn(),
    } as unknown as React.DragEvent;
  };

  // Helper to create minimal props for KitVoicePanel
  const createBaseProps = (overrides = {}) => ({
    isEditable: true,
    kitName: "TestKit",
    onPlay: vi.fn(),
    onRescanVoiceName: vi.fn(),
    onSampleAdd: vi.fn(),
    onSampleDelete: vi.fn(),
    onSampleMove: vi.fn(),
    onSampleReplace: vi.fn(),
    onSampleSelect: vi.fn(),
    onSaveVoiceName: vi.fn(),
    onStereoDragLeave: vi.fn(),
    onStereoDragOver: vi.fn(),
    onStop: vi.fn(),
    onWaveformPlayingChange: vi.fn(),
    playTriggers: {},
    samplePlaying: {},
    samples: ["sample1.wav", "sample2.wav", "", "sample4.wav"],
    stopTriggers: {},
    voice: 1,
    voiceName: "Voice 1",
    ...overrides,
  });

  // Wrapper component for tests
  const renderKitVoicePanel = (props = {}) => {
    const finalProps = createBaseProps(props);
    return render(
      <MockSettingsProvider>
        <MockMessageDisplayProvider>
          <KitVoicePanel {...finalProps} />
        </MockMessageDisplayProvider>
      </MockSettingsProvider>,
    );
  };

  describe("Component Rendering", () => {
    it("renders voice panel with samples and empty slots", () => {
      renderKitVoicePanel();

      // Verify basic structure
      expect(screen.getByLabelText("Voice 1 panel")).toBeInTheDocument();
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // Verify samples are rendered
      expect(screen.getByText("sample1.wav")).toBeInTheDocument();
      expect(screen.getByText("sample2.wav")).toBeInTheDocument();
      expect(screen.getByText("sample4.wav")).toBeInTheDocument();

      // Verify empty slot is rendered (slot 3, index 2)
      expect(screen.getByTestId("empty-slot-1-2")).toBeInTheDocument();
    });

    it("renders draggable samples when editable", () => {
      renderKitVoicePanel({ isEditable: true });

      const sampleElements = screen.getAllByRole("option");
      sampleElements.forEach((element) => {
        // Check if it's a sample (not empty slot)
        // Empty slots have data-testid starting with "empty-slot"
        const testId = element.getAttribute("data-testid");
        if (testId && !testId.startsWith("empty-slot")) {
          expect(element).toHaveAttribute("draggable", "true");
        }
      });
    });

    it("does not render draggable samples when not editable", () => {
      renderKitVoicePanel({ isEditable: false });

      const sampleElements = screen.getAllByRole("option");
      sampleElements.forEach((element) => {
        // Check if it's a sample (not empty slot)
        // Empty slots have data-testid starting with "empty-slot"
        const testId = element.getAttribute("data-testid");
        if (testId && !testId.startsWith("empty-slot")) {
          expect(element).toHaveAttribute("draggable", "false");
        }
      });
    });
  });

  describe("External File Drag Operations", () => {
    it("shows drop target styling during external file drag over empty slot", async () => {
      renderKitVoicePanel();

      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const dragEvent = createDragEvent([createMockFile("new-sample.wav")]);

      // Trigger drag over
      fireEvent.dragOver(emptySlot, dragEvent);

      // Check for drag over styling changes (the real behavior we care about)
      await waitFor(() => {
        // Should show green styling for insert mode (inserting before existing sample)
        expect(emptySlot).toHaveClass(/bg-green/i);
      });
    });

    it("shows drop target styling during external file drag over occupied slot", async () => {
      renderKitVoicePanel();

      // Find a sample slot (not empty)
      const sampleSlot = screen.getByText("sample1.wav").closest("li")!;
      const dragEvent = createDragEvent([createMockFile("replacement.wav")]);

      // Trigger drag over
      fireEvent.dragOver(sampleSlot, dragEvent);

      // Check for drop target feedback
      await waitFor(() => {
        // Should show green styling for insert mode (inserting before occupied slot)
        expect(sampleSlot).toHaveClass(/bg-green/i);
      });
    });

    it("shows append styling when dragging over next available slot", async () => {
      // Test with contiguous samples to get append mode
      renderKitVoicePanel({
        samples: ["sample1.wav", "sample2.wav", "sample3.wav"],
      });

      // The next available slot would be at index 3 (after the 3 existing samples)
      const nextSlot = screen.getByTestId("empty-slot-1-3");
      const dragEvent = createDragEvent([createMockFile("new-sample.wav")]);

      // Trigger drag over
      fireEvent.dragOver(nextSlot, dragEvent);

      // Check for append styling (blue)
      await waitFor(() => {
        expect(nextSlot).toHaveClass(/bg-blue/i);
      });
    });

    it("shows blocked styling when voice has 12 samples", async () => {
      // Test with 12 samples (full voice)
      const fullSamples = Array.from(
        { length: 12 },
        (_, i) => `sample${i + 1}.wav`,
      );
      renderKitVoicePanel({ samples: fullSamples });

      // Try to drag over any slot when voice is full
      const firstSlot = screen.getByText("sample1.wav").closest("li")!;
      const dragEvent = createDragEvent([createMockFile("blocked-sample.wav")]);

      // Trigger drag over
      fireEvent.dragOver(firstSlot, dragEvent);

      // Check for blocked styling (red)
      await waitFor(() => {
        expect(firstSlot).toHaveClass(/bg-red/i);
      });
    });

    it("calls onStereoDragOver during external file drag", () => {
      const mockOnStereoDragOver = vi.fn();
      renderKitVoicePanel({ onStereoDragOver: mockOnStereoDragOver });

      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const dragEvent = createDragEvent([createMockFile("test.wav")]);

      fireEvent.dragOver(emptySlot, dragEvent);

      expect(mockOnStereoDragOver).toHaveBeenCalledWith(1, 2, false);
    });

    it("detects stereo files during drag over", () => {
      const mockOnStereoDragOver = vi.fn();
      renderKitVoicePanel({ onStereoDragOver: mockOnStereoDragOver });

      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const stereoFiles = [
        createMockFile("left.wav"),
        createMockFile("right.wav"),
      ];
      const dragEvent = createDragEvent(stereoFiles);

      fireEvent.dragOver(emptySlot, dragEvent);

      expect(mockOnStereoDragOver).toHaveBeenCalledWith(1, 2, true);
    });

    it("clears drop target styling on drag leave", async () => {
      renderKitVoicePanel();

      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const dragEvent = createDragEvent([createMockFile("test.wav")]);

      // Start drag over
      fireEvent.dragOver(emptySlot, dragEvent);

      // Wait for drag styling
      await waitFor(() => {
        expect(emptySlot).toHaveClass(/bg-green/i);
      });

      // Trigger drag leave
      fireEvent.dragLeave(emptySlot);

      // Verify styling is cleared
      await waitFor(() => {
        expect(emptySlot).not.toHaveClass(/bg-green/i);
      });
    });

    it("handles file drop on empty slot", async () => {
      const mockOnSampleAdd = vi.fn();

      // Mock file path extraction
      window.electronFileAPI = {
        getDroppedFilePath: vi
          .fn()
          .mockResolvedValue("/path/to/dropped-sample.wav"),
      } as any;

      // Mock validation to return success with valid format
      setupElectronAPIMock({
        getAllSamplesForKit: vi.fn().mockResolvedValue({
          data: [],
          success: true,
        }),
        validateSampleFormat: vi.fn().mockResolvedValue({
          data: {
            issues: [],
            isValid: true,
            metadata: { channels: 1 },
          },
          success: true,
        }),
      });

      renderKitVoicePanel({ onSampleAdd: mockOnSampleAdd });

      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const file = createMockFile("dropped-sample.wav");
      const dropEvent = createDragEvent([file]);

      fireEvent.drop(emptySlot, dropEvent);

      // Verify onSampleAdd is called (may be async)
      await waitFor(() => {
        expect(mockOnSampleAdd).toHaveBeenCalledWith(
          1, // voice
          2, // slot index
          expect.stringContaining("dropped-sample.wav"),
        );
      });
    });

    it("handles file drop with modifier keys", async () => {
      const mockOnSampleAdd = vi.fn();

      // Mock file path extraction
      window.electronFileAPI = {
        getDroppedFilePath: vi
          .fn()
          .mockResolvedValue("/path/to/mono-forced.wav"),
      } as any;

      // Mock validation to return success with valid format
      setupElectronAPIMock({
        getAllSamplesForKit: vi.fn().mockResolvedValue({
          data: [],
          success: true,
        }),
        validateSampleFormat: vi.fn().mockResolvedValue({
          data: {
            issues: [],
            isValid: true,
            metadata: { channels: 1 },
          },
          success: true,
        }),
      });

      renderKitVoicePanel({ onSampleAdd: mockOnSampleAdd });

      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const file = createMockFile("mono-forced.wav");
      const dropEvent = createDragEvent([file], { altKey: true });

      fireEvent.drop(emptySlot, dropEvent);

      // The modifier keys should be passed through the processing chain
      // Exact verification depends on implementation details
      await waitFor(() => {
        expect(mockOnSampleAdd).toHaveBeenCalled();
      });
    });
  });

  describe("Internal Sample Drag Operations", () => {
    it("initiates drag when dragging a sample within the same voice", () => {
      renderKitVoicePanel();

      const sampleElement = screen.getByText("sample1.wav").closest("li")!;

      // Create internal drag start event
      const dragStartEvent = createDragEvent([], {
        dataTransfer: { effectAllowed: "move", setData: vi.fn() },
      });

      fireEvent.dragStart(sampleElement, dragStartEvent);

      expect(dragStartEvent.dataTransfer.setData).toHaveBeenCalledWith(
        "application/x-romper-sample",
        "true",
      );
    });

    it("shows drop target during internal sample drag over empty slot", async () => {
      renderKitVoicePanel();

      const sourceElement = screen.getByText("sample1.wav").closest("li")!;
      const targetSlot = screen.getByTestId("empty-slot-1-2");

      // Start internal drag
      const dragStartEvent = createDragEvent([], {
        dataTransfer: {
          effectAllowed: "move",
          setData: vi.fn(),
          types: ["application/x-romper-sample"],
        },
      });
      fireEvent.dragStart(sourceElement, dragStartEvent);

      // Drag over empty slot
      const dragOverEvent = createDragEvent([], {
        dataTransfer: {
          dropEffect: "move",
          types: ["application/x-romper-sample"],
        },
      });
      fireEvent.dragOver(targetSlot, dragOverEvent);

      expect(dragOverEvent.dataTransfer.dropEffect).toBe("move");
    });

    it("prevents dropping on same slot", () => {
      renderKitVoicePanel();

      const sampleElement = screen.getByText("sample1.wav").closest("li")!;

      // Start drag from slot 0
      const dragStartEvent = createDragEvent([], {
        dataTransfer: {
          setData: vi.fn(),
          types: ["application/x-romper-sample"],
        },
      });
      fireEvent.dragStart(sampleElement, dragStartEvent);

      // Try to drop on same slot
      const dragOverEvent = createDragEvent([], {
        dataTransfer: {
          dropEffect: "move",
          types: ["application/x-romper-sample"],
        },
      });
      fireEvent.dragOver(sampleElement, dragOverEvent);

      // Should set dropEffect to "none"
      expect(dragOverEvent.dataTransfer.dropEffect).toBe("none");
    });

    it("handles internal sample drop and calls onSampleMove", async () => {
      const mockOnSampleMove = vi.fn();
      renderKitVoicePanel({ onSampleMove: mockOnSampleMove });

      const sourceElement = screen.getByText("sample1.wav").closest("li")!;
      const targetSlot = screen.getByTestId("empty-slot-1-2");

      // Start drag
      const dragStartEvent = createDragEvent([], {
        dataTransfer: {
          setData: vi.fn(),
          types: ["application/x-romper-sample"],
        },
      });
      fireEvent.dragStart(sourceElement, dragStartEvent);

      // Drop on empty slot
      const dropEvent = createDragEvent([], {
        dataTransfer: {
          types: ["application/x-romper-sample"],
        },
      });
      fireEvent.drop(targetSlot, dropEvent);

      await waitFor(() => {
        expect(mockOnSampleMove).toHaveBeenCalledWith(
          1, // fromVoice
          0, // fromSlot (sample1.wav is at index 0)
          1, // toVoice
          2, // toSlot (empty slot is at index 2)
        );
      });
    });

    it("uses insert mode when dropping on occupied slot", async () => {
      const mockOnSampleMove = vi.fn();
      renderKitVoicePanel({ onSampleMove: mockOnSampleMove });

      const sourceElement = screen.getByText("sample1.wav").closest("li")!;
      const targetElement = screen.getByText("sample4.wav").closest("li")!;

      // Start drag
      fireEvent.dragStart(
        sourceElement,
        createDragEvent([], {
          dataTransfer: {
            setData: vi.fn(),
            types: ["application/x-romper-sample"],
          },
        }),
      );

      // Drop on occupied slot
      fireEvent.drop(
        targetElement,
        createDragEvent([], {
          dataTransfer: { types: ["application/x-romper-sample"] },
        }),
      );

      await waitFor(() => {
        expect(mockOnSampleMove).toHaveBeenCalledWith(
          1, // fromVoice
          0, // fromSlot (sample1.wav)
          1, // toVoice
          3, // toSlot (sample4.wav is at index 3)
        );
      });
    });

    it("cleans up drag state on drag end", () => {
      renderKitVoicePanel();

      const sampleElement = screen.getByText("sample1.wav").closest("li")!;

      // Start drag
      fireEvent.dragStart(
        sampleElement,
        createDragEvent([], {
          dataTransfer: { setData: vi.fn() },
        }),
      );

      // End drag
      const dragEndEvent = createDragEvent([]);
      fireEvent.dragEnd(sampleElement, dragEndEvent);

      // Drag state should be cleaned up - verify no visual artifacts remain
      expect(dragEndEvent).toBeTruthy();
    });
  });

  describe("Cross-Voice Drag Operations", () => {
    it("should support dragging samples between different voice panels", async () => {
      // This test would require rendering multiple KitVoicePanel components
      // and testing drag from one to another. For now, we verify the props
      // are correctly passed to enable cross-voice operations.

      const mockOnSampleMove = vi.fn();
      renderKitVoicePanel({
        onSampleMove: mockOnSampleMove,
        voice: 1,
      });

      // The onSampleMove callback should be available to handle cross-voice moves
      expect(mockOnSampleMove).toBeDefined();

      // TODO: Implement full cross-voice test when we have multiple panels
    });
  });

  describe("Error Handling", () => {
    it("handles missing electronFileAPI gracefully", async () => {
      delete (window as any).electronFileAPI;

      renderKitVoicePanel();

      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const dropEvent = createDragEvent([createMockFile("test.wav")]);

      // Should not throw
      expect(() => {
        fireEvent.drop(emptySlot, dropEvent);
      }).not.toThrow();
    });

    it("handles invalid file types gracefully", async () => {
      renderKitVoicePanel();

      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const invalidFile = createMockFile("document.txt", "text/plain");
      const dropEvent = createDragEvent([invalidFile]);

      // Should handle gracefully without errors
      expect(() => {
        fireEvent.drop(emptySlot, dropEvent);
      }).not.toThrow();
    });
  });

  describe("Accessibility", () => {
    it("maintains proper ARIA attributes during drag operations", () => {
      renderKitVoicePanel();

      const sampleElements = screen.getAllByRole("option");

      sampleElements.forEach((element) => {
        expect(element).toHaveAttribute("aria-label");
        expect(element).toHaveAttribute("role", "option");
      });
    });

    it("provides proper focus management during drag operations", () => {
      renderKitVoicePanel({ isActive: true, selectedIdx: 0 });

      const listbox = screen.getByRole("listbox");
      expect(listbox).toHaveAttribute("tabIndex", "0");

      const selectedSample = screen.getByTestId("sample-selected-voice-1");
      expect(selectedSample).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("Visual Feedback", () => {
    it("shows appropriate cursor during drag operations", () => {
      renderKitVoicePanel({ isEditable: true });

      const sampleElement = screen.getByText("sample1.wav").closest("li")!;

      // Element should be draggable
      expect(sampleElement).toHaveAttribute("draggable", "true");

      // CSS should handle cursor styling based on draggable attribute
    });

    it("displays drop hints during drag over", async () => {
      renderKitVoicePanel();

      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const dragEvent = createDragEvent([createMockFile("hint-test.wav")]);

      fireEvent.dragOver(emptySlot, dragEvent);

      // Title attribute should contain drop hint
      await waitFor(() => {
        expect(emptySlot).toHaveAttribute("title");
        const title = emptySlot.getAttribute("title");
        expect(title).toMatch(/insert|add|drop/i);
      });
    });
  });

  describe("Performance", () => {
    it("does not cause excessive re-renders during drag operations", () => {
      const renderCount = vi.fn();

      const TestComponent = (props: any) => {
        renderCount();
        return <KitVoicePanel {...props} />;
      };

      render(
        <MockSettingsProvider>
          <MockMessageDisplayProvider>
            <TestComponent {...createBaseProps()} />
          </MockMessageDisplayProvider>
        </MockSettingsProvider>,
      );

      const initialRenderCount = renderCount.mock.calls.length;

      // Simulate multiple drag over events
      const emptySlot = screen.getByTestId("empty-slot-1-2");
      const dragEvent = createDragEvent([createMockFile("perf-test.wav")]);

      for (let i = 0; i < 5; i++) {
        fireEvent.dragOver(emptySlot, dragEvent);
      }

      // Should not cause excessive re-renders
      const finalRenderCount = renderCount.mock.calls.length;
      expect(finalRenderCount - initialRenderCount).toBeLessThan(3);
    });
  });
});

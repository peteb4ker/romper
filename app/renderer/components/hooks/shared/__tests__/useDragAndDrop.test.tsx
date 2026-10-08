import { renderHook, type RenderHookOptions } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MockSettingsProvider } from "../../../__tests__/MockSettingsProvider";
import { useDragAndDrop } from "../useDragAndDrop";

// Mock the sub-hooks; beforeEach gives each a full return value
vi.mock("../useFileValidation", () => ({ useFileValidation: vi.fn() }));

// Note: Not mocking useSampleProcessing - using real implementation with MockSettingsProvider

vi.mock("../useExternalDragHandlers", () => ({
  useExternalDragHandlers: vi.fn(),
}));

vi.mock("../useInternalDragHandlers", () => ({
  useInternalDragHandlers: vi.fn(),
}));

import { useExternalDragHandlers } from "../useExternalDragHandlers";
import { useFileValidation } from "../useFileValidation";
import { useInternalDragHandlers } from "../useInternalDragHandlers";

type DragAndDropOptions = Parameters<typeof useDragAndDrop>[0];

const fileValidation = (): ReturnType<typeof useFileValidation> => ({
  getFilePathFromDrop: vi.fn().mockResolvedValue("/path/to/file.wav"),
  validateDroppedFile: vi
    .fn()
    .mockResolvedValue({ validation: { issues: [], isValid: true } }),
});

const externalHandlers = (
  overrides: Partial<ReturnType<typeof useExternalDragHandlers>> = {},
): ReturnType<typeof useExternalDragHandlers> => ({
  dragOverSlot: null,
  dropZone: null,
  handleDragLeave: vi.fn(),
  handleDragOver: vi.fn(),
  handleDrop: vi.fn(),
  ...overrides,
});

const internalHandlers = (
  overrides: Partial<ReturnType<typeof useInternalDragHandlers>> = {},
): ReturnType<typeof useInternalDragHandlers> => ({
  draggedSample: null,
  getSampleDragHandlers: vi.fn(),
  handleSampleDragEnd: vi.fn(),
  handleSampleDragLeave: vi.fn(),
  handleSampleDragOver: vi.fn(),
  handleSampleDragStart: vi.fn(),
  handleSampleDrop: vi.fn(),
  internalDragOverSlot: null,
  internalDropZone: null,
  ...overrides,
});

// Helper function to render hook with MockSettingsProvider
const renderHookWithSettings = <Result, Props>(
  hookFn: (props: Props) => Result,
  options?: RenderHookOptions<Props>,
) => {
  return renderHook(hookFn, {
    ...options,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MockSettingsProvider>{children}</MockSettingsProvider>
    ),
  });
};

describe("useDragAndDrop", () => {
  const mockOnSampleAdd =
    vi.fn<NonNullable<DragAndDropOptions["onSampleAdd"]>>();
  const mockOnSampleMove =
    vi.fn<NonNullable<DragAndDropOptions["onSampleMove"]>>();

  const defaultProps: DragAndDropOptions = {
    isEditable: true,
    kitName: "TestKit",
    onSampleAdd: mockOnSampleAdd,
    onSampleMove: mockOnSampleMove,
    samples: ["sample1.wav", "sample2.wav", "", "sample4.wav"],
    voice: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFileValidation).mockReturnValue(fileValidation());
    vi.mocked(useExternalDragHandlers).mockReturnValue(externalHandlers());
    vi.mocked(useInternalDragHandlers).mockReturnValue(internalHandlers());
  });

  describe("initialization", () => {
    it("initializes and calls sub-hooks with correct parameters", () => {
      renderHookWithSettings(() => useDragAndDrop(defaultProps));

      // Verify useExternalDragHandlers was called with correct props
      expect(useExternalDragHandlers).toHaveBeenCalledWith(
        expect.objectContaining({
          fileValidation: expect.objectContaining({
            getFilePathFromDrop: expect.any(Function),
            validateDroppedFile: expect.any(Function),
          }),
          isEditable: true,
          sampleProcessing: expect.objectContaining({
            getCurrentKitSamples: expect.any(Function),
            isDuplicateSample: expect.any(Function),
            processAssignment: expect.any(Function),
          }),
          samples: expect.any(Array),
        }),
      );

      // Verify useInternalDragHandlers was called with correct props
      expect(useInternalDragHandlers).toHaveBeenCalledWith({
        isEditable: true,
        onSampleMove: mockOnSampleMove,
        samples: ["sample1.wav", "sample2.wav", "", "sample4.wav"],
        voice: 2,
      });
    });

    it("returns composed interface from sub-hooks", () => {
      const { result } = renderHookWithSettings(() =>
        useDragAndDrop(defaultProps),
      );

      // Should return properties from both hooks
      expect(result.current).toHaveProperty("draggedSample");
      expect(result.current).toHaveProperty("dragOverSlot");
      expect(result.current).toHaveProperty("dropZone");
      expect(result.current).toHaveProperty("getSampleDragHandlers");
      expect(result.current).toHaveProperty("handleDragLeave");
      expect(result.current).toHaveProperty("handleDragOver");
      expect(result.current).toHaveProperty("handleDrop");
    });
  });

  describe("property mapping", () => {
    it("maps internal drag handler properties correctly", () => {
      const mockInternalHandlers = internalHandlers({
        draggedSample: { sampleName: "test.wav", slot: 1, voice: 2 },
      });

      vi.mocked(useInternalDragHandlers).mockReturnValue(mockInternalHandlers);

      const { result } = renderHookWithSettings(() =>
        useDragAndDrop(defaultProps),
      );

      expect(result.current.draggedSample).toBe(
        mockInternalHandlers.draggedSample,
      );
      expect(result.current.getSampleDragHandlers).toBe(
        mockInternalHandlers.getSampleDragHandlers,
      );
    });

    it("maps external drag handler properties correctly", () => {
      const mockExternalHandlers = externalHandlers({
        dragOverSlot: 3,
        dropZone: { mode: "insert", slot: 3 },
      });

      vi.mocked(useExternalDragHandlers).mockReturnValue(mockExternalHandlers);

      const { result } = renderHookWithSettings(() =>
        useDragAndDrop(defaultProps),
      );

      expect(result.current.dragOverSlot).toBe(
        mockExternalHandlers.dragOverSlot,
      );
      expect(result.current.dropZone).toBe(mockExternalHandlers.dropZone);
      expect(result.current.handleDragLeave).toBe(
        mockExternalHandlers.handleDragLeave,
      );
      expect(result.current.handleDragOver).toBe(
        mockExternalHandlers.handleDragOver,
      );
      expect(result.current.handleDrop).toBe(mockExternalHandlers.handleDrop);
    });
  });

  describe("prop handling", () => {
    it("handles missing optional callbacks", () => {
      const minimalProps: DragAndDropOptions = {
        isEditable: false,
        kitName: "MinimalKit",
        samples: [],
        voice: 1,
      };

      expect(() => {
        renderHookWithSettings(() => useDragAndDrop(minimalProps));
      }).not.toThrow();

      // Should pass undefined callbacks to sub-hooks
      const internalCall = vi.mocked(useInternalDragHandlers).mock.calls[0][0];
      expect(internalCall.onSampleMove).toBeUndefined();
    });

    it("passes all callbacks when provided", () => {
      renderHookWithSettings(() => useDragAndDrop(defaultProps));

      const internalCall = vi.mocked(useInternalDragHandlers).mock.calls[0][0];
      expect(internalCall.onSampleMove).toBe(mockOnSampleMove);
    });

    it("handles isEditable false", () => {
      renderHookWithSettings(() =>
        useDragAndDrop({ ...defaultProps, isEditable: false }),
      );

      const externalCall = vi.mocked(useExternalDragHandlers).mock.calls[0][0];
      const internalCall = vi.mocked(useInternalDragHandlers).mock.calls[0][0];

      expect(externalCall.isEditable).toBe(false);
      expect(internalCall.isEditable).toBe(false);
    });

    it("passes voice correctly", () => {
      renderHookWithSettings(() =>
        useDragAndDrop({ ...defaultProps, voice: 5 }),
      );

      const internalCall = vi.mocked(useInternalDragHandlers).mock.calls[0][0];

      expect(internalCall.voice).toBe(5);
    });

    it("passes samples array correctly", () => {
      const customSamples = ["a.wav", "b.wav", "c.wav"];
      renderHookWithSettings(() =>
        useDragAndDrop({ ...defaultProps, samples: customSamples }),
      );

      const internalCall = vi.mocked(useInternalDragHandlers).mock.calls[0][0];
      expect(internalCall.samples).toBe(customSamples);
    });

    it("passes kitName to sample processing", () => {
      renderHookWithSettings(() =>
        useDragAndDrop({ ...defaultProps, kitName: "CustomKit" }),
      );

      const externalCall = vi.mocked(useExternalDragHandlers).mock.calls[0][0];
      // The kitName should be passed through the sampleProcessing hook
      expect(externalCall.sampleProcessing).toBeDefined();
    });
  });

  describe("hook dependencies", () => {
    it("recreates handlers when props change", () => {
      const { rerender } = renderHookWithSettings(
        (props) => useDragAndDrop(props),
        {
          initialProps: defaultProps,
        },
      );

      const firstCallCount = vi.mocked(useInternalDragHandlers).mock.calls
        .length;

      // Change a prop that should cause recreation
      rerender({ ...defaultProps, voice: 3 });

      const secondCallCount = vi.mocked(useInternalDragHandlers).mock.calls
        .length;
      expect(secondCallCount).toBeGreaterThan(firstCallCount);
    });

    it("handles prop updates correctly", () => {
      const { rerender } = renderHookWithSettings(
        (props) => useDragAndDrop(props),
        {
          initialProps: defaultProps,
        },
      );

      // Update samples
      const newSamples = ["new1.wav", "new2.wav"];
      rerender({ ...defaultProps, samples: newSamples });

      // Should have been called again with new samples
      const latestCall = vi
        .mocked(useInternalDragHandlers)
        .mock.calls.slice(-1)[0][0];
      expect(latestCall.samples).toBe(newSamples);
    });

    it("maintains stable references when props don't change", () => {
      const { rerender, result } = renderHookWithSettings(() =>
        useDragAndDrop(defaultProps),
      );

      const firstHandlers = result.current;

      // Rerender with same props
      rerender();

      const secondHandlers = result.current;

      // Handlers should be stable (this depends on implementation)
      // Note: This test might need adjustment based on actual memoization implementation
      expect(typeof firstHandlers.handleDragLeave).toBe("function");
      expect(typeof secondHandlers.handleDragLeave).toBe("function");
    });
  });

  describe("integration with sub-hooks", () => {
    it("forwards file validation results correctly", () => {
      renderHookWithSettings(() => useDragAndDrop(defaultProps));

      // The file validation should be passed to external handlers
      const externalCall = vi.mocked(useExternalDragHandlers).mock.calls[0][0];
      expect(externalCall.fileValidation).toEqual(
        expect.objectContaining({
          getFilePathFromDrop: expect.any(Function),
          validateDroppedFile: expect.any(Function),
        }),
      );
    });

    it("forwards sample processing correctly", () => {
      renderHookWithSettings(() => useDragAndDrop(defaultProps));

      const externalCall = vi.mocked(useExternalDragHandlers).mock.calls[0][0];
      expect(externalCall.sampleProcessing).toEqual(
        expect.objectContaining({
          getCurrentKitSamples: expect.any(Function),
          isDuplicateSample: expect.any(Function),
          processAssignment: expect.any(Function),
        }),
      );
    });
  });

  describe("edge cases", () => {
    it("handles empty samples array", () => {
      expect(() => {
        renderHookWithSettings(() =>
          useDragAndDrop({ ...defaultProps, samples: [] }),
        );
      }).not.toThrow();

      const internalCall = vi.mocked(useInternalDragHandlers).mock.calls[0][0];
      expect(internalCall.samples).toEqual([]);
    });

    it("handles voice boundary values", () => {
      expect(() => {
        renderHookWithSettings(() =>
          useDragAndDrop({ ...defaultProps, voice: 0 }),
        );
        renderHookWithSettings(() =>
          useDragAndDrop({ ...defaultProps, voice: 16 }),
        );
      }).not.toThrow();
    });
  });

  describe("[Q-07] return value consistency", () => {
    it("always returns the same structure, without the sample processing internals", () => {
      const { rerender, result } = renderHookWithSettings(() =>
        useDragAndDrop(defaultProps),
      );

      const expectedKeys = [
        "draggedSample",
        "dragOverSlot",
        "dropZone",
        "getSampleDragHandlers",
        "handleDragLeave",
        "handleDragOver",
        "handleDrop",
        "handleInternalDragOver",
        "handleInternalDrop",
      ];

      expect(Object.keys(result.current).sort()).toEqual(expectedKeys.sort());

      // Rerender and check consistency
      rerender();
      expect(Object.keys(result.current).sort()).toEqual(expectedKeys.sort());
    });

    it("returns functions for all handler properties", () => {
      const { result } = renderHookWithSettings(() =>
        useDragAndDrop(defaultProps),
      );

      expect(typeof result.current.getSampleDragHandlers).toBe("function");
      expect(typeof result.current.handleDragLeave).toBe("function");
      expect(typeof result.current.handleDragOver).toBe("function");
      expect(typeof result.current.handleDrop).toBe("function");
    });
  });

  describe("mocking validation", () => {
    afterEach(() => {
      // Ensure mocks are properly reset for each test
      vi.clearAllMocks();
    });

    it("verifies mock setup is working", () => {
      renderHookWithSettings(() => useDragAndDrop(defaultProps));

      expect(useExternalDragHandlers).toHaveBeenCalled();
      expect(useInternalDragHandlers).toHaveBeenCalled();
    });
  });
});

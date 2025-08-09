import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useSampleActions } from "../useSampleActions";

// Mock electron API
const mockShowItemInFolder = vi.fn();

describe("useSampleActions", () => {
  const mockOnSampleDelete = vi.fn();

  const defaultProps = {
    isEditable: true,
    onSampleDelete: mockOnSampleDelete,
    voice: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up centralized electronAPI mock
    setupElectronAPIMock({
      showItemInFolder: mockShowItemInFolder,
    });
  });

  describe("handleDeleteSample", () => {
    it("calls onSampleDelete when editable", async () => {
      const { result } = renderHook(() => useSampleActions(defaultProps));

      await result.current.handleDeleteSample(0);

      expect(mockOnSampleDelete).toHaveBeenCalledWith(1, 0);
    });

    it("does not call onSampleDelete when not editable", async () => {
      const { result } = renderHook(() =>
        useSampleActions({ ...defaultProps, isEditable: false }),
      );

      await result.current.handleDeleteSample(0);

      expect(mockOnSampleDelete).not.toHaveBeenCalled();
    });

    it("does not call onSampleDelete when callback is undefined", async () => {
      const { result } = renderHook(() =>
        useSampleActions({ ...defaultProps, onSampleDelete: undefined }),
      );

      await result.current.handleDeleteSample(0);

      expect(mockOnSampleDelete).not.toHaveBeenCalled();
    });

    it("handles delete errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorMock = vi.fn().mockRejectedValue(new Error("Delete failed"));

      const { result } = renderHook(() =>
        useSampleActions({ ...defaultProps, onSampleDelete: errorMock }),
      );

      await result.current.handleDeleteSample(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to delete sample:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("handleSampleContextMenu", () => {
    it("calls showItemInFolder when sample has source path", () => {
      const { result } = renderHook(() => useSampleActions(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent;

      const sampleData = {
        source_path: "/path/to/sample.wav",
      };

      result.current.handleSampleContextMenu(mockEvent, sampleData);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockShowItemInFolder).toHaveBeenCalledWith("/path/to/sample.wav");
    });

    it("does not call showItemInFolder when sample has no source path", () => {
      const { result } = renderHook(() => useSampleActions(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent;

      const sampleData = {
        source_path: undefined,
      };

      result.current.handleSampleContextMenu(mockEvent, sampleData);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockShowItemInFolder).not.toHaveBeenCalled();
    });

    it("does not call showItemInFolder when sample data is undefined", () => {
      const { result } = renderHook(() => useSampleActions(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent;

      result.current.handleSampleContextMenu(mockEvent, undefined);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockShowItemInFolder).not.toHaveBeenCalled();
    });

    it("does not call showItemInFolder when electronAPI is unavailable", () => {
      // Temporarily mock electronAPI as undefined
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        window,
        "electronAPI",
      );
      Object.defineProperty(window, "electronAPI", {
        configurable: true,
        value: undefined,
      });

      const { result } = renderHook(() => useSampleActions(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent;

      const sampleData = {
        source_path: "/path/to/sample.wav",
      };

      result.current.handleSampleContextMenu(mockEvent, sampleData);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockShowItemInFolder).not.toHaveBeenCalled();

      // Restore electronAPI
      if (originalDescriptor) {
        Object.defineProperty(window, "electronAPI", originalDescriptor);
      }
    });

    it("does not call showItemInFolder when showItemInFolder method is unavailable", () => {
      // Mock electronAPI without showItemInFolder method
      setupElectronAPIMock({
        // Explicitly omit showItemInFolder from the mock
        showItemInFolder: undefined as any,
      });

      const { result } = renderHook(() => useSampleActions(defaultProps));

      const mockEvent = {
        preventDefault: vi.fn(),
      } as unknown as React.MouseEvent;

      const sampleData = {
        source_path: "/path/to/sample.wav",
      };

      result.current.handleSampleContextMenu(mockEvent, sampleData);

      expect(mockEvent.preventDefault).toHaveBeenCalled();

      // Reset to normal mock for subsequent tests
      setupElectronAPIMock({
        showItemInFolder: mockShowItemInFolder,
      });
    });
  });
});

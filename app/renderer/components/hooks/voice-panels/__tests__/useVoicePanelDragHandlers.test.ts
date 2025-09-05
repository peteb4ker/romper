import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DRAG_TYPES } from "../dragUtils";
import { useVoicePanelDragHandlers } from "../useVoicePanelDragHandlers";

describe("useVoicePanelDragHandlers", () => {
  const mockDragAndDropHook = {
    getSampleDragHandlers: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: vi.fn(),
    handleInternalDragOver: vi.fn(),
    handleInternalDrop: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when editable", () => {
    it("returns combined drag handlers", () => {
      const { result } = renderHook(() =>
        useVoicePanelDragHandlers({
          dragAndDropHook: mockDragAndDropHook,
          isEditable: true,
        }),
      );

      expect(result.current.handleCombinedDragOver).toBeDefined();
      expect(result.current.handleCombinedDragLeave).toBeDefined();
      expect(result.current.handleCombinedDrop).toBeDefined();
    });

    it("calls internal handler for internal drags", () => {
      const { result } = renderHook(() =>
        useVoicePanelDragHandlers({
          dragAndDropHook: mockDragAndDropHook,
          isEditable: true,
        }),
      );

      const internalDragEvent = {
        dataTransfer: {
          types: [DRAG_TYPES.ROMPER_SAMPLE],
        },
      } as React.DragEvent;

      result.current.handleCombinedDragOver(internalDragEvent, 5);
      result.current.handleCombinedDrop(internalDragEvent, 5);

      expect(mockDragAndDropHook.handleInternalDragOver).toHaveBeenCalledWith(
        internalDragEvent,
        5,
      );
      expect(mockDragAndDropHook.handleInternalDrop).toHaveBeenCalledWith(
        internalDragEvent,
        5,
      );
      expect(mockDragAndDropHook.handleDragOver).not.toHaveBeenCalled();
      expect(mockDragAndDropHook.handleDrop).not.toHaveBeenCalled();
    });

    it("calls external handler for external drags", () => {
      const { result } = renderHook(() =>
        useVoicePanelDragHandlers({
          dragAndDropHook: mockDragAndDropHook,
          isEditable: true,
        }),
      );

      const externalDragEvent = {
        dataTransfer: {
          types: ["text/plain"],
        },
      } as React.DragEvent;

      result.current.handleCombinedDragOver(externalDragEvent, 3);
      result.current.handleCombinedDrop(externalDragEvent, 3);

      expect(mockDragAndDropHook.handleDragOver).toHaveBeenCalledWith(
        externalDragEvent,
        3,
      );
      expect(mockDragAndDropHook.handleDrop).toHaveBeenCalledWith(
        externalDragEvent,
        3,
      );
      expect(mockDragAndDropHook.handleInternalDragOver).not.toHaveBeenCalled();
      expect(mockDragAndDropHook.handleInternalDrop).not.toHaveBeenCalled();
    });

    it("calls drag leave handler", () => {
      const { result } = renderHook(() =>
        useVoicePanelDragHandlers({
          dragAndDropHook: mockDragAndDropHook,
          isEditable: true,
        }),
      );

      result.current.handleCombinedDragLeave();

      expect(mockDragAndDropHook.handleDragLeave).toHaveBeenCalled();
    });
  });

  describe("when not editable", () => {
    it("returns handlers that do nothing", () => {
      const { result } = renderHook(() =>
        useVoicePanelDragHandlers({
          dragAndDropHook: mockDragAndDropHook,
          isEditable: false,
        }),
      );

      const dragEvent = {
        dataTransfer: {
          types: [DRAG_TYPES.ROMPER_SAMPLE],
        },
      } as React.DragEvent;

      result.current.handleCombinedDragOver(dragEvent, 1);
      result.current.handleCombinedDrop(dragEvent, 1);
      result.current.handleCombinedDragLeave();

      expect(mockDragAndDropHook.handleInternalDragOver).not.toHaveBeenCalled();
      expect(mockDragAndDropHook.handleInternalDrop).not.toHaveBeenCalled();
      expect(mockDragAndDropHook.handleDragOver).not.toHaveBeenCalled();
      expect(mockDragAndDropHook.handleDrop).not.toHaveBeenCalled();
      expect(mockDragAndDropHook.handleDragLeave).not.toHaveBeenCalled();
    });
  });
});

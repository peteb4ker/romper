import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCombinedDragHandlers,
  DRAG_TYPES,
  isInternalSampleDrag,
} from "../dragUtils";

describe("dragUtils", () => {
  describe("isInternalSampleDrag", () => {
    it("returns true when drag event contains romper sample type", () => {
      const mockEvent = {
        dataTransfer: {
          types: [DRAG_TYPES.ROMPER_SAMPLE, "text/plain"],
        },
      } as React.DragEvent;

      expect(isInternalSampleDrag(mockEvent)).toBe(true);
    });

    it("returns false when drag event does not contain romper sample type", () => {
      const mockEvent = {
        dataTransfer: {
          types: ["text/plain", "text/html"],
        },
      } as React.DragEvent;

      expect(isInternalSampleDrag(mockEvent)).toBe(false);
    });

    it("returns false when drag event has empty types array", () => {
      const mockEvent = {
        dataTransfer: {
          types: [],
        },
      } as React.DragEvent;

      expect(isInternalSampleDrag(mockEvent)).toBe(false);
    });
  });

  describe("createCombinedDragHandlers", () => {
    const mockExternalHandlers = {
      onDragOver: vi.fn(),
      onDrop: vi.fn(),
    };

    const mockOriginalHandlers = {
      onDragOver: vi.fn(),
      onDrop: vi.fn(),
    };

    const slotNumber = 5;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("calls original handler for internal drags", () => {
      const combinedHandlers = createCombinedDragHandlers(
        mockOriginalHandlers,
        mockExternalHandlers,
        slotNumber,
      );

      const internalDragEvent = {
        dataTransfer: {
          types: [DRAG_TYPES.ROMPER_SAMPLE],
        },
      } as React.DragEvent;

      combinedHandlers.onDragOver(internalDragEvent);
      combinedHandlers.onDrop(internalDragEvent);

      expect(mockOriginalHandlers.onDragOver).toHaveBeenCalledWith(
        internalDragEvent,
      );
      expect(mockOriginalHandlers.onDrop).toHaveBeenCalledWith(
        internalDragEvent,
      );
      expect(mockExternalHandlers.onDragOver).not.toHaveBeenCalled();
      expect(mockExternalHandlers.onDrop).not.toHaveBeenCalled();
    });

    it("calls external handler for external drags", () => {
      const combinedHandlers = createCombinedDragHandlers(
        mockOriginalHandlers,
        mockExternalHandlers,
        slotNumber,
      );

      const externalDragEvent = {
        dataTransfer: {
          types: ["text/plain"],
        },
      } as React.DragEvent;

      combinedHandlers.onDragOver(externalDragEvent);
      combinedHandlers.onDrop(externalDragEvent);

      expect(mockExternalHandlers.onDragOver).toHaveBeenCalledWith(
        externalDragEvent,
        slotNumber,
      );
      expect(mockExternalHandlers.onDrop).toHaveBeenCalledWith(
        externalDragEvent,
        slotNumber,
      );
      expect(mockOriginalHandlers.onDragOver).not.toHaveBeenCalled();
      expect(mockOriginalHandlers.onDrop).not.toHaveBeenCalled();
    });

    it("handles missing original handlers gracefully", () => {
      const combinedHandlers = createCombinedDragHandlers(
        {},
        mockExternalHandlers,
        slotNumber,
      );

      const internalDragEvent = {
        dataTransfer: {
          types: [DRAG_TYPES.ROMPER_SAMPLE],
        },
      } as React.DragEvent;

      expect(() => {
        combinedHandlers.onDragOver(internalDragEvent);
        combinedHandlers.onDrop(internalDragEvent);
      }).not.toThrow();

      expect(mockExternalHandlers.onDragOver).not.toHaveBeenCalled();
      expect(mockExternalHandlers.onDrop).not.toHaveBeenCalled();
    });
  });
});

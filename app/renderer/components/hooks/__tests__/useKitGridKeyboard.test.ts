import type { Kit } from "@romper/shared/db/schema.js";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@romper/shared/kitUtilsShared", () => ({
  isValidKit: vi.fn(() => true),
}));

import { isValidKit } from "@romper/shared/kitUtilsShared";

import { useKitGridKeyboard } from "../useKitGridKeyboard";

const mockIsValidKit = vi.mocked(isValidKit);

function createMockKit(name: string): Kit {
  return {
    alias: null,
    artist: null,
    bank_letter: name[0],
    bpm: 120,
    editable: false,
    is_favorite: false,
    locked: false,
    modified_since_sync: false,
    name,
    step_pattern: null,
  };
}

describe("useKitGridKeyboard", () => {
  const mockOnSelectKit = vi.fn();
  const mockSetFocus = vi.fn();
  const mockOnBankFocus = vi.fn();
  const mockOnFocusKit = vi.fn();

  const kitsToDisplay: Kit[] = [
    createMockKit("A0"),
    createMockKit("A1"),
    createMockKit("A2"),
    createMockKit("B0"),
    createMockKit("B1"),
    createMockKit("B2"),
  ];

  const mockContainerRef = {
    current: {
      querySelector: vi.fn(() => ({
        scrollIntoView: vi.fn(),
      })),
    } as unknown as HTMLDivElement,
  };

  const defaultProps = {
    columnCount: 3,
    containerRef: mockContainerRef,
    focusedIdx: 1 as null | number,
    kitsToDisplay,
    onBankFocus: mockOnBankFocus,
    onFocusKit: mockOnFocusKit,
    onSelectKit: mockOnSelectKit,
    rowCount: 2,
    setFocus: mockSetFocus,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsValidKit.mockReturnValue(true);
  });

  describe("getGridCoords", () => {
    it("converts flat index 0 to row 0, column 0", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      expect(result.current.getGridCoords(0)).toEqual({
        columnIndex: 0,
        rowIndex: 0,
      });
    });

    it("converts flat index 2 to row 0, column 2", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      expect(result.current.getGridCoords(2)).toEqual({
        columnIndex: 2,
        rowIndex: 0,
      });
    });

    it("converts flat index 3 to row 1, column 0", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      expect(result.current.getGridCoords(3)).toEqual({
        columnIndex: 0,
        rowIndex: 1,
      });
    });

    it("converts flat index 5 to row 1, column 2", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      expect(result.current.getGridCoords(5)).toEqual({
        columnIndex: 2,
        rowIndex: 1,
      });
    });
  });

  describe("getFlatIndex", () => {
    it("converts row 0, column 0 to flat index 0", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      expect(result.current.getFlatIndex(0, 0)).toBe(0);
    });

    it("converts row 0, column 2 to flat index 2", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      expect(result.current.getFlatIndex(0, 2)).toBe(2);
    });

    it("converts row 1, column 0 to flat index 3", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      expect(result.current.getFlatIndex(1, 0)).toBe(3);
    });

    it("converts row 1, column 2 to flat index 5", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      expect(result.current.getFlatIndex(1, 2)).toBe(5);
    });
  });

  describe("handleKeyDown - arrow navigation", () => {
    it("handles ArrowRight to move focus right", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 1 }),
      );

      const mockEvent = {
        key: "ArrowRight",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockSetFocus).toHaveBeenCalledWith(2);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("handles ArrowLeft to move focus left", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 2 }),
      );

      const mockEvent = {
        key: "ArrowLeft",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockSetFocus).toHaveBeenCalledWith(1);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("handles ArrowDown to move focus down", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 1 }),
      );

      const mockEvent = {
        key: "ArrowDown",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockSetFocus).toHaveBeenCalledWith(4);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("handles ArrowUp to move focus up", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 4 }),
      );

      const mockEvent = {
        key: "ArrowUp",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockSetFocus).toHaveBeenCalledWith(1);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("clamps ArrowLeft at column 0", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 3 }),
      );

      const mockEvent = {
        key: "ArrowLeft",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      // Already at column 0 of row 1, stays at index 3
      expect(mockSetFocus).toHaveBeenCalledWith(3);
    });

    it("clamps ArrowUp at row 0", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 1 }),
      );

      const mockEvent = {
        key: "ArrowUp",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      // Already at row 0, stays at index 1
      expect(mockSetFocus).toHaveBeenCalledWith(1);
    });
  });

  describe("handleKeyDown - Enter/Space selection", () => {
    it("handles Enter to select focused kit", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 1 }),
      );

      const mockEvent = {
        key: "Enter",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockOnSelectKit).toHaveBeenCalledWith("A1");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("handles Space to select focused kit", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 1 }),
      );

      const mockEvent = {
        key: " ",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockOnSelectKit).toHaveBeenCalledWith("A1");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("does not select kit when isValidKit returns false", () => {
      mockIsValidKit.mockReturnValue(false);

      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 1 }),
      );

      const mockEvent = {
        key: "Enter",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockOnSelectKit).not.toHaveBeenCalled();
    });
  });

  describe("handleKeyDown - A-Z bank navigation", () => {
    it("handles letter key to navigate to first kit in bank", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      const mockEvent = {
        key: "b",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      // B0 is at index 3
      expect(mockSetFocus).toHaveBeenCalledWith(3);
      expect(mockOnBankFocus).toHaveBeenCalledWith("B");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it("handles uppercase letter key", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      const mockEvent = {
        key: "A",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      // A0 is at index 0
      expect(mockSetFocus).toHaveBeenCalledWith(0);
      expect(mockOnBankFocus).toHaveBeenCalledWith("A");
    });

    it("does not navigate for bank with no kits", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      const mockEvent = {
        key: "z",
        preventDefault: vi.fn(),
        target: document.createElement("div"),
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockSetFocus).not.toHaveBeenCalled();
      expect(mockOnBankFocus).not.toHaveBeenCalled();
    });
  });

  describe("handleKeyDown - input element filtering", () => {
    it("ignores keyboard events from input elements", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 1 }),
      );

      const inputElement = document.createElement("input");
      const mockEvent = {
        key: "Enter",
        preventDefault: vi.fn(),
        target: inputElement,
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockOnSelectKit).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("ignores keyboard events from textarea elements", () => {
      const { result } = renderHook(() =>
        useKitGridKeyboard({ ...defaultProps, focusedIdx: 1 }),
      );

      const textareaElement = document.createElement("textarea");
      const mockEvent = {
        key: "Enter",
        preventDefault: vi.fn(),
        target: textareaElement,
      } as unknown as React.KeyboardEvent;

      result.current.handleKeyDown(mockEvent);

      expect(mockOnSelectKit).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("scrollToKit", () => {
    it("scrolls to kit by name", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      result.current.scrollToKit("B0");

      // B0 is at index 3
      expect(mockSetFocus).toHaveBeenCalledWith(3);
    });

    it("does nothing for unknown kit name", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      result.current.scrollToKit("Z9");

      expect(mockSetFocus).not.toHaveBeenCalled();
    });
  });

  describe("scrollAndFocusKitByIndex", () => {
    it("sets focus and calls onFocusKit", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      result.current.scrollAndFocusKitByIndex(2);

      expect(mockSetFocus).toHaveBeenCalledWith(2);
      expect(mockOnFocusKit).toHaveBeenCalledWith("A2");
    });

    it("does nothing for out-of-range index", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      result.current.scrollAndFocusKitByIndex(99);

      expect(mockSetFocus).not.toHaveBeenCalled();
    });

    it("does nothing for negative index", () => {
      const { result } = renderHook(() => useKitGridKeyboard(defaultProps));

      result.current.scrollAndFocusKitByIndex(-1);

      expect(mockSetFocus).not.toHaveBeenCalled();
    });
  });
});

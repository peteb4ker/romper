import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKitKeyboardNav } from "../useKitKeyboardNav";

function openModal(): HTMLElement {
  const modal = document.createElement("div");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  document.body.appendChild(modal);
  return modal;
}

describe("useKitKeyboardNav", () => {
  const mockGlobalBankHotkeyHandler = vi.fn();
  const mockOnToggleFavorite = vi.fn();

  const defaultProps = {
    focusedKit: "Kit1",
    globalBankHotkeyHandler: mockGlobalBankHotkeyHandler,
    onToggleFavorite: mockOnToggleFavorite,
  };

  // Mock addEventListener and removeEventListener
  const mockAddEventListener = vi.fn();
  const mockRemoveEventListener = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup window mock
    Object.defineProperty(window, "addEventListener", {
      value: mockAddEventListener,
      writable: true,
    });

    Object.defineProperty(window, "removeEventListener", {
      value: mockRemoveEventListener,
      writable: true,
    });
  });

  describe("event listener setup", () => {
    it("registers event listeners on mount", () => {
      renderHook(() => useKitKeyboardNav(defaultProps));

      expect(mockAddEventListener).toHaveBeenCalledTimes(2);
      expect(mockAddEventListener).toHaveBeenCalledWith(
        "keydown",
        mockGlobalBankHotkeyHandler,
      );
      expect(mockAddEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
    });

    it("removes event listeners on unmount", () => {
      const { unmount } = renderHook(() => useKitKeyboardNav(defaultProps));

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledTimes(2);
      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "keydown",
        mockGlobalBankHotkeyHandler,
      );
      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
    });

    it("updates event listeners when handlers change", () => {
      const { rerender } = renderHook(
        ({ handler }) =>
          useKitKeyboardNav({
            ...defaultProps,
            globalBankHotkeyHandler: handler,
          }),
        { initialProps: { handler: mockGlobalBankHotkeyHandler } },
      );

      const newHandler = vi.fn();
      rerender({ handler: newHandler });

      // Should remove old listeners and add new ones
      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "keydown",
        mockGlobalBankHotkeyHandler,
      );
      expect(mockAddEventListener).toHaveBeenCalledWith("keydown", newHandler);
    });
  });

  describe("[UC-10] favorites keyboard handler (Shift+F)", () => {
    let favoritesHandler: (e: KeyboardEvent) => void;

    beforeEach(() => {
      renderHook(() => useKitKeyboardNav(defaultProps));

      // Extract the favorites handler from the addEventListener calls
      const calls = mockAddEventListener.mock.calls;
      const favoritesCall = calls.find(
        (call) => call[1] !== mockGlobalBankHotkeyHandler,
      );
      favoritesHandler = favoritesCall?.[1];
    });

    it.each(["F", "f"])(
      "toggles favorite on Shift+%s when a kit is focused",
      (key) => {
        const mockEvent = {
          key,
          preventDefault: vi.fn(),
          shiftKey: true,
          stopPropagation: vi.fn(),
          target: document.createElement("div"),
        } as unknown as KeyboardEvent;

        favoritesHandler(mockEvent);

        expect(mockOnToggleFavorite).toHaveBeenCalledWith("Kit1");
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(mockEvent.stopPropagation).toHaveBeenCalled();
      },
    );

    // #504: plain "F" stays the jump to bank F; "*" no longer stars
    it.each(["f", "F", "*"])("leaves %s without Shift alone", (key) => {
      const mockEvent = {
        key,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement("div"),
      } as unknown as KeyboardEvent;

      favoritesHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
    });

    it.each(["metaKey", "ctrlKey", "altKey"])(
      "ignores Shift+F with %s held",
      (modifier) => {
        const mockEvent = {
          key: "F",
          [modifier]: true,
          preventDefault: vi.fn(),
          shiftKey: true,
          stopPropagation: vi.fn(),
          target: document.createElement("div"),
        } as unknown as KeyboardEvent;

        favoritesHandler(mockEvent);

        expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      },
    );

    it("ignores Shift+F when no kit is focused", () => {
      const { rerender } = renderHook(
        ({ focused }) =>
          useKitKeyboardNav({ ...defaultProps, focusedKit: focused }),
        { initialProps: { focused: "Kit1" } },
      );

      rerender({ focused: null });

      // Get the updated handler
      const calls = mockAddEventListener.mock.calls;
      const latestCall = calls[calls.length - 1];
      const updatedHandler = latestCall[1];

      const mockEvent = {
        key: "F",
        preventDefault: vi.fn(),
        shiftKey: true,
        stopPropagation: vi.fn(),
        target: document.createElement("div"),
      } as unknown as KeyboardEvent;

      updatedHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("ignores Shift+F typed in an input field", () => {
      const inputElement = document.createElement("input");
      const mockEvent = {
        key: "F",
        preventDefault: vi.fn(),
        shiftKey: true,
        stopPropagation: vi.fn(),
        target: inputElement,
      } as unknown as KeyboardEvent;

      favoritesHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("ignores Shift+F typed in a textarea", () => {
      const textareaElement = document.createElement("textarea");
      const mockEvent = {
        key: "F",
        preventDefault: vi.fn(),
        shiftKey: true,
        stopPropagation: vi.fn(),
        target: textareaElement,
      } as unknown as KeyboardEvent;

      favoritesHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    // #500: keys pressed in a dialog are the dialog's
    it("[UC-07] ignores Shift+F while a modal dialog is open", () => {
      const modal = openModal();
      const mockEvent = {
        key: "F",
        preventDefault: vi.fn(),
        shiftKey: true,
        stopPropagation: vi.fn(),
        target: document.body,
      } as unknown as KeyboardEvent;

      favoritesHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      modal.remove();
    });

    it("ignores other keys", () => {
      const mockEvent = {
        key: "g",
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement("div"),
      } as unknown as KeyboardEvent;

      favoritesHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });
});

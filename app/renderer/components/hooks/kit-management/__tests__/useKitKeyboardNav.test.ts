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

  describe("[UC-10] [Q-06] favorite key (;)", () => {
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

    const keyEvent = (
      key: string,
      extra: { target?: EventTarget } & Partial<KeyboardEvent> = {},
    ) =>
      ({
        key,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement("div"),
        ...extra,
      }) as unknown as KeyboardEvent;

    it("toggles the focused kit's favorite on ;", () => {
      const mockEvent = keyEvent(";");

      favoritesHandler(mockEvent);

      expect(mockOnToggleFavorite).toHaveBeenCalledWith("Kit1");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    // #552: F and Shift+F no longer toggle a favorite; F is bank F's jump
    it.each([
      ["f", false],
      ["F", false],
      ["F", true],
      [":", true],
      ["*", false],
    ])("leaves %s (Shift: %s) alone", (key, shiftKey) => {
      const mockEvent = keyEvent(key, { shiftKey });

      favoritesHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
    });

    it.each(["metaKey", "ctrlKey", "altKey"])(
      "ignores ; with %s held",
      (modifier) => {
        const mockEvent = keyEvent(";", { [modifier]: true });

        favoritesHandler(mockEvent);

        expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      },
    );

    it("ignores ; when no kit is focused", () => {
      const initialProps: { focused: null | string } = { focused: "Kit1" };
      const { rerender } = renderHook(
        ({ focused }) =>
          useKitKeyboardNav({ ...defaultProps, focusedKit: focused }),
        { initialProps },
      );

      rerender({ focused: null });

      // Get the updated handler
      const calls = mockAddEventListener.mock.calls;
      const latestCall = calls[calls.length - 1];
      const updatedHandler = latestCall[1];

      const mockEvent = keyEvent(";");

      updatedHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("ignores ; typed in an input field", () => {
      const mockEvent = keyEvent(";", {
        target: document.createElement("input"),
      });

      favoritesHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("ignores ; typed in a textarea", () => {
      const mockEvent = keyEvent(";", {
        target: document.createElement("textarea"),
      });

      favoritesHandler(mockEvent);

      expect(mockOnToggleFavorite).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    // #500: keys pressed in a dialog are the dialog's
    it("[UC-07] ignores ; while a modal dialog is open", () => {
      const modal = openModal();
      const mockEvent = keyEvent(";", { target: document.body });

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

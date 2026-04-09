import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePopoverDismiss } from "../usePopoverDismiss";

describe("usePopoverDismiss", () => {
  let originalRAF: typeof requestAnimationFrame;
  let originalCAF: typeof cancelAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock requestAnimationFrame to call callback immediately
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
  });

  it("adds mousedown listener on document when active", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    renderHook(() => usePopoverDismiss(ref, onClose, true));

    expect(addSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    addSpy.mockRestore();
  });

  it("adds keydown listener for Escape when active", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    renderHook(() => usePopoverDismiss(ref, onClose, true));

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    addSpy.mockRestore();
  });

  it("calls onClose when clicking outside ref element", () => {
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    renderHook(() => usePopoverDismiss(ref, onClose, true));

    // Simulate mousedown outside the ref element
    const event = new MouseEvent("mousedown", { bubbles: true });
    document.dispatchEvent(event);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when clicking inside ref element", () => {
    const container = document.createElement("div");
    const child = document.createElement("span");
    container.appendChild(child);
    document.body.appendChild(container);

    const ref = { current: container };
    const onClose = vi.fn();

    renderHook(() => usePopoverDismiss(ref, onClose, true));

    // Simulate mousedown on the child inside the ref element
    const event = new MouseEvent("mousedown", { bubbles: true });
    Object.defineProperty(event, "target", { value: child });
    document.dispatchEvent(event);

    expect(onClose).not.toHaveBeenCalled();

    document.body.removeChild(container);
  });

  it("calls onClose on Escape key", () => {
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    renderHook(() => usePopoverDismiss(ref, onClose, true));

    const event = new KeyboardEvent("keydown", { key: "Escape" });
    document.dispatchEvent(event);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose on non-Escape keys", () => {
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    renderHook(() => usePopoverDismiss(ref, onClose, true));

    const event = new KeyboardEvent("keydown", { key: "Enter" });
    document.dispatchEvent(event);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT add listeners when isActive is false", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    renderHook(() => usePopoverDismiss(ref, onClose, false));

    expect(addSpy).not.toHaveBeenCalled();
    addSpy.mockRestore();
  });

  it("cleans up listeners on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    const { unmount } = renderHook(() => usePopoverDismiss(ref, onClose, true));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("calls cancelAnimationFrame on cleanup", () => {
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    const { unmount } = renderHook(() => usePopoverDismiss(ref, onClose, true));

    unmount();

    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it("uses requestAnimationFrame for mousedown listener registration", () => {
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    renderHook(() => usePopoverDismiss(ref, onClose, true));

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it("defaults isActive to true when not provided", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const ref = { current: document.createElement("div") };
    const onClose = vi.fn();

    renderHook(() => usePopoverDismiss(ref, onClose));

    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    addSpy.mockRestore();
  });
});

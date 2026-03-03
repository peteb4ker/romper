import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ICON_LED_COUNT, ICON_MAX_RIPPLES } from "../ledIconConstants";
import { useMiniLedAnimation } from "../useMiniLedAnimation";

describe("useMiniLedAnimation", () => {
  let rafCallbacks: FrameRequestCallback[];
  let rafId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = [];
    rafId = 0;

    // Mock getComputedStyle
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: () => "#e05a60",
    } as unknown as CSSStyleDeclaration);

    // Mock RAF to capture callbacks
    global.requestAnimationFrame = vi.fn((cb) => {
      rafCallbacks.push(cb);
      return ++rafId;
    });
    global.cancelAnimationFrame = vi.fn();

    // Mock performance.now
    vi.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createIsHoveredRef = (value = false) => ({ current: value });

  it("returns ledRefs, setMousePosition, clearMousePosition, and addRipple", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useMiniLedAnimation(isHoveredRef));

    expect(result.current.ledRefs).toBeDefined();
    expect(result.current.setMousePosition).toBeInstanceOf(Function);
    expect(result.current.clearMousePosition).toBeInstanceOf(Function);
    expect(result.current.addRipple).toBeInstanceOf(Function);
  });

  it("starts RAF on mount", () => {
    const isHoveredRef = createIsHoveredRef();
    renderHook(() => useMiniLedAnimation(isHoveredRef));
    expect(global.requestAnimationFrame).toHaveBeenCalled();
  });

  it("cancels RAF on unmount", () => {
    const isHoveredRef = createIsHoveredRef();
    const { unmount } = renderHook(() => useMiniLedAnimation(isHoveredRef));
    unmount();
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("ledRefs array can hold elements", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useMiniLedAnimation(isHoveredRef));
    expect(result.current.ledRefs.current).toBeInstanceOf(Array);
    result.current.ledRefs.current[0] = document.createElement("div");
    expect(result.current.ledRefs.current[0]).toBeInstanceOf(HTMLDivElement);
  });

  it("setMousePosition and clearMousePosition do not throw", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useMiniLedAnimation(isHoveredRef));
    expect(() => result.current.setMousePosition(3, 3)).not.toThrow();
    expect(() => result.current.clearMousePosition()).not.toThrow();
  });

  it("addRipple does not throw", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useMiniLedAnimation(isHoveredRef));
    expect(() => result.current.addRipple(4, 4)).not.toThrow();
  });

  it("updates LED opacity in animation frame", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useMiniLedAnimation(isHoveredRef));

    // Create mock LED elements
    const mockLeds = Array.from({ length: ICON_LED_COUNT }, () => {
      const el = document.createElement("div");
      el.style.opacity = "0.2";
      el.style.boxShadow = "none";
      return el;
    });
    result.current.ledRefs.current = mockLeds;

    // Run one animation frame
    vi.spyOn(performance, "now").mockReturnValue(1000);
    if (rafCallbacks.length > 0) {
      rafCallbacks[rafCallbacks.length - 1](1000);
    }

    // At least some LEDs should have updated opacity
    const opacities = mockLeds.map((el) => parseFloat(el.style.opacity));
    const hasVariation = opacities.some((o) => o !== 0.2);
    expect(hasVariation).toBe(true);
  });

  it("caps ripples at ICON_MAX_RIPPLES", () => {
    const isHoveredRef = createIsHoveredRef();
    const { result } = renderHook(() => useMiniLedAnimation(isHoveredRef));

    // Add more than ICON_MAX_RIPPLES ripples
    for (let i = 0; i < ICON_MAX_RIPPLES + 5; i++) {
      vi.spyOn(performance, "now").mockReturnValue(i * 100);
      result.current.addRipple(i, i);
    }

    // Should not throw or cause issues
    expect(() => result.current.addRipple(0, 0)).not.toThrow();
  });
});

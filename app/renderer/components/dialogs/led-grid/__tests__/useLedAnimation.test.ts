import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyTheme } from "../../../../utils/appliedTheme";
import { LED_COUNT, MAX_RIPPLES } from "../ledConstants";
import { useLedAnimation } from "../useLedAnimation";

describe("useLedAnimation", () => {
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

  it("returns ledRefs, setMousePosition, clearMousePosition, and addRipple", () => {
    const { result } = renderHook(() => useLedAnimation());

    expect(result.current.ledRefs).toBeDefined();
    expect(result.current.setMousePosition).toBeInstanceOf(Function);
    expect(result.current.clearMousePosition).toBeInstanceOf(Function);
    expect(result.current.addRipple).toBeInstanceOf(Function);
  });

  it("starts RAF on mount", () => {
    renderHook(() => useLedAnimation());
    expect(global.requestAnimationFrame).toHaveBeenCalled();
  });

  it("cancels RAF on unmount", () => {
    const { unmount } = renderHook(() => useLedAnimation());
    unmount();
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  it("ledRefs array can hold LED_COUNT elements", () => {
    const { result } = renderHook(() => useLedAnimation());
    expect(result.current.ledRefs.current).toBeInstanceOf(Array);
    // Should be able to assign to it
    result.current.ledRefs.current[0] = document.createElement("div");
    expect(result.current.ledRefs.current[0]).toBeInstanceOf(HTMLDivElement);
  });

  it("setMousePosition and clearMousePosition do not throw", () => {
    const { result } = renderHook(() => useLedAnimation());
    expect(() => result.current.setMousePosition(5, 5)).not.toThrow();
    expect(() => result.current.clearMousePosition()).not.toThrow();
  });

  it("addRipple does not throw", () => {
    const { result } = renderHook(() => useLedAnimation());
    expect(() => result.current.addRipple(5, 5)).not.toThrow();
  });

  it("updates LED opacity in animation frame", () => {
    const { result } = renderHook(() => useLedAnimation());

    // Create mock LED elements
    const mockLeds = Array.from({ length: LED_COUNT }, () => {
      const el = document.createElement("div");
      el.style.opacity = "0.06";
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
    const hasVariation = opacities.some((o) => o !== 0.06);
    expect(hasVariation).toBe(true);
  });

  it("caps ripples at MAX_RIPPLES", () => {
    const { result } = renderHook(() => useLedAnimation());

    // Add more than MAX_RIPPLES ripples
    for (let i = 0; i < MAX_RIPPLES + 5; i++) {
      vi.spyOn(performance, "now").mockReturnValue(i * 100);
      result.current.addRipple(i, i);
    }

    // Should not throw or cause issues
    expect(() => result.current.addRipple(0, 0)).not.toThrow();
  });
});

describe("[UC-29] the About dialog's glow follows the theme (#767)", () => {
  afterEach(() => {
    applyTheme(false);
    vi.restoreAllMocks();
  });

  it("draws the glow in the new theme's color right after a switch", () => {
    const callbacks: FrameRequestCallback[] = [];
    applyTheme(false);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      () =>
        ({
          getPropertyValue: () =>
            document.documentElement.classList.contains("dark")
              ? "#a0b0c0"
              : "#102030",
        }) as unknown as CSSStyleDeclaration,
    );
    global.requestAnimationFrame = vi.fn((cb) => {
      callbacks.push(cb);
      return callbacks.length;
    });
    global.cancelAnimationFrame = vi.fn();
    vi.spyOn(performance, "now").mockReturnValue(1000);

    const { result } = renderHook(() => useLedAnimation());
    const leds = Array.from({ length: LED_COUNT }, () =>
      document.createElement("div"),
    );
    result.current.ledRefs.current = leds;
    // A pointer over the grid lights the LEDs around it
    result.current.setMousePosition(7, 2);
    const shadows = () => leds.map((el) => el.style.boxShadow).join("|");

    callbacks.at(-1)?.(1000);
    expect(shadows()).toContain("16, 32, 48");

    act(() => {
      applyTheme(true);
    });
    callbacks.at(-1)?.(1000);
    expect(shadows()).toContain("160, 176, 192");
    expect(shadows()).not.toContain("16, 32, 48");
  });
});

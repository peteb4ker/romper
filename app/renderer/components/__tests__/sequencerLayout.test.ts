import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { usePadHeight } from "../sequencerLayout";

// jsdom has no PointerEvent; a MouseEvent with a pointer event type works

const KEY = "romper.sequencer.padHeight";

describe("usePadHeight", () => {
  beforeEach(() => localStorage.removeItem(KEY));

  it("follows the window until the pads are resized", () => {
    const { result } = renderHook(() => usePadHeight());
    expect(result.current.value).toBeNull();
    expect(result.current.style).toEqual({});
  });

  it("drags taller (the four rows share the drag) and remembers it", () => {
    const { result } = renderHook(() => usePadHeight());
    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientY: 500,
        preventDefault: () => {},
      } as never);
    });
    act(() => {
      globalThis.dispatchEvent(new MouseEvent("pointermove", { clientY: 460 }));
      globalThis.dispatchEvent(new MouseEvent("pointerup"));
    });

    // No pad in the DOM: starts from 40; 40 px up is 10 px per row
    expect(result.current.value).toBe(50);
    expect(result.current.style).toEqual({ "--seq-pad-h": "50px" });
    expect(localStorage.getItem(KEY)).toBe("50");
  });

  it("stays within its limits, and resets on request", () => {
    localStorage.setItem(KEY, "58");
    const { result } = renderHook(() => usePadHeight());
    expect(result.current.value).toBe(58);

    act(() => {
      result.current.onPointerDown({
        button: 0,
        clientY: 500,
        preventDefault: () => {},
      } as never);
    });
    act(() => {
      globalThis.dispatchEvent(new MouseEvent("pointermove", { clientY: 0 }));
      globalThis.dispatchEvent(new MouseEvent("pointerup"));
    });
    expect(result.current.value).toBe(result.current.max);

    act(() => result.current.reset());
    expect(result.current.value).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("ignores a stored size out of range", () => {
    localStorage.setItem(KEY, "500");
    const { result } = renderHook(() => usePadHeight());
    expect(result.current.value).toBeNull();
  });
});

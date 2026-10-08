import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTimeouts } from "../useTimeouts";

describe("[Q-07] useTimeouts (#709)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs each timeout after its delay while mounted", () => {
    const { result } = renderHook(() => useTimeouts());
    const first = vi.fn();
    const second = vi.fn();

    result.current.set(first, 100);
    result.current.set(second, 200);

    vi.advanceTimersByTime(100);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cancels a timeout it's given", () => {
    const { result } = renderHook(() => useTimeouts());
    const callback = vi.fn();

    result.current.clear(result.current.set(callback, 100));
    result.current.clear(null);

    vi.advanceTimersByTime(100);
    expect(callback).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears pending timeouts when it unmounts", () => {
    const { result, unmount } = renderHook(() => useTimeouts());
    const callback = vi.fn();
    result.current.set(callback, 100);
    result.current.set(callback, 200);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
  });

  it("schedules nothing after unmount", () => {
    const { result, unmount } = renderHook(() => useTimeouts());
    const { set } = result.current;
    unmount();

    const callback = vi.fn();
    expect(set(callback, 100)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the same functions across renders", () => {
    const { rerender, result } = renderHook(() => useTimeouts());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

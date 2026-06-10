import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMessageDisplay } from "../useMessageDisplay";

describe("useMessageDisplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes the expected API and starts empty", () => {
    const { result } = renderHook(() => useMessageDisplay());

    expect(result.current.messages).toEqual([]);
    expect(typeof result.current.showMessage).toBe("function");
    expect(typeof result.current.dismissMessage).toBe("function");
    expect(typeof result.current.clearMessages).toBe("function");
  });

  it("adds a message to state when shown", () => {
    const { result } = renderHook(() => useMessageDisplay());

    act(() => {
      result.current.showMessage("Saved", "success");
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      text: "Saved",
      type: "success",
    });
  });

  it("normalizes an unknown type to info", () => {
    const { result } = renderHook(() => useMessageDisplay());

    act(() => {
      result.current.showMessage("Hi", "banana");
    });

    expect(result.current.messages[0].type).toBe("info");
  });

  it("auto-dismisses after the duration", () => {
    const { result } = renderHook(() => useMessageDisplay());

    act(() => {
      result.current.showMessage("Temporary", "info", 1000);
    });
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.messages).toHaveLength(0);
  });

  it("keeps a sticky message (duration 0) until dismissed", () => {
    const { result } = renderHook(() => useMessageDisplay());

    let id = 0;
    act(() => {
      id = result.current.showMessage("Sticky", "error", 0);
    });

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(result.current.messages).toHaveLength(1);

    act(() => {
      result.current.dismissMessage(id);
    });
    expect(result.current.messages).toHaveLength(0);
  });

  it("dismisses a specific message by id", () => {
    const { result } = renderHook(() => useMessageDisplay());

    let firstId = 0;
    act(() => {
      firstId = result.current.showMessage("First", "info", 0);
      result.current.showMessage("Second", "info", 0);
    });
    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.dismissMessage(firstId);
    });
    expect(result.current.messages.map((m) => m.text)).toEqual(["Second"]);
  });

  it("clears all messages", () => {
    const { result } = renderHook(() => useMessageDisplay());

    act(() => {
      result.current.showMessage("A", "info", 5000);
      result.current.showMessage("B", "warning", 5000);
    });
    expect(result.current.messages).toHaveLength(2);

    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.messages).toHaveLength(0);
  });

  it("mirrors errors to the structured logger", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { result } = renderHook(() => useMessageDisplay());

    act(() => {
      result.current.showMessage("Boom", "error");
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith("[message] Boom");
    consoleErrorSpy.mockRestore();
  });
});

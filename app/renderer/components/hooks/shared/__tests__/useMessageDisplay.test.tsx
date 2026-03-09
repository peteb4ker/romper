import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMessageDisplay } from "../useMessageDisplay";

describe("useMessageDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the correct API", () => {
    const { result } = renderHook(() => useMessageDisplay());
    expect(typeof result.current.showMessage).toBe("function");
    expect(typeof result.current.dismissMessage).toBe("function");
    expect(typeof result.current.clearMessages).toBe("function");
    expect(Array.isArray(result.current.messages)).toBe(true);
  });

  it("logs messages to console", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation();
    const { result } = renderHook(() => useMessageDisplay());
    act(() => {
      result.current.showMessage("Test info", "info", 1234);
    });
    expect(consoleSpy).toHaveBeenCalledWith("[message] Test info");
    consoleSpy.mockRestore();
  });

  it("logs error messages to console.error", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();
    const { result } = renderHook(() => useMessageDisplay());
    act(() => {
      result.current.showMessage("Test error", "error");
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith("[message] Test error");
    consoleErrorSpy.mockRestore();
  });

  it("dismissMessage and clearMessages are callable and do nothing", () => {
    const { result } = renderHook(() => useMessageDisplay());
    expect(() => result.current.dismissMessage("id")).not.toThrow();
    expect(() => result.current.clearMessages()).not.toThrow();
  });
});

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMessageDisplay } from "../useMessageDisplay";

describe("useMessageDisplay", () => {
  it("should return the expected API", () => {
    const { result } = renderHook(() => useMessageDisplay());

    expect(result.current).toEqual({
      clearMessages: expect.any(Function),
      dismissMessage: expect.any(Function),
      messages: [],
      showMessage: expect.any(Function),
    });
  });

  it("should expose showMessage function", () => {
    const { result } = renderHook(() => useMessageDisplay());

    expect(typeof result.current.showMessage).toBe("function");
  });

  it("should expose dismissMessage function", () => {
    const { result } = renderHook(() => useMessageDisplay());

    expect(typeof result.current.dismissMessage).toBe("function");
  });

  it("should expose clearMessages function", () => {
    const { result } = renderHook(() => useMessageDisplay());

    expect(typeof result.current.clearMessages).toBe("function");
  });

  it("should return empty messages array", () => {
    const { result } = renderHook(() => useMessageDisplay());

    expect(result.current.messages).toEqual([]);
  });

  it("should log info messages to console.log", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation();
    const { result } = renderHook(() => useMessageDisplay());

    result.current.showMessage("Test message", "info", 5000);

    expect(consoleSpy).toHaveBeenCalledWith("[message] Test message");
    consoleSpy.mockRestore();
  });

  it("should log error messages to console.error", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();
    const { result } = renderHook(() => useMessageDisplay());

    result.current.showMessage("Test message", "error", 3000);

    expect(consoleErrorSpy).toHaveBeenCalledWith("[message] Test message");
    consoleErrorSpy.mockRestore();
  });

  it("should handle dismissMessage as no-op", () => {
    const { result } = renderHook(() => useMessageDisplay());

    // Should not throw
    expect(() => result.current.dismissMessage()).not.toThrow();
  });

  it("should handle clearMessages as no-op", () => {
    const { result } = renderHook(() => useMessageDisplay());

    // Should not throw
    expect(() => result.current.clearMessages()).not.toThrow();
  });
});

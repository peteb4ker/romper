import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useMessageDisplay } from "../useMessageDisplay";

// Mock sonner
vi.mock("sonner", () => ({
  toast: vi.fn(() => "toast-id"),
}));

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

  it("should call toast when showMessage is called", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() => useMessageDisplay());

    result.current.showMessage("Test message", "info", 5000);

    expect(toast).toHaveBeenCalledWith("Test message", { duration: 5000 });
  });

  it("should call toast with default parameters", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() => useMessageDisplay());

    result.current.showMessage("Test message");

    expect(toast).toHaveBeenCalledWith("Test message", { duration: undefined });
  });

  it("should ignore type parameter since sonner handles styling differently", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(() => useMessageDisplay());

    result.current.showMessage("Test message", "error", 3000);

    expect(toast).toHaveBeenCalledWith("Test message", { duration: 3000 });
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

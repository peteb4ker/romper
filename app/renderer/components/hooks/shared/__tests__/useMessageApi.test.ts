import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { MessageDisplayContext } from "../../../MessageDisplayContext";
import { useMessageApi } from "../useMessageApi";

describe("useMessageApi", () => {
  it("returns context value when used within MessageDisplayContext", () => {
    const mockContextValue = {
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        MessageDisplayContext.Provider,
        { value: mockContextValue },
        children
      );

    const { result } = renderHook(() => useMessageApi(), { wrapper });

    expect(result.current).toBe(mockContextValue);
  });

  it("throws error when used outside MessageDisplayContext", () => {
    // Mock console.error to avoid test noise
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      renderHook(() => useMessageApi());
    }).toThrow("useMessageApi must be used within MessageDisplayContext");

    consoleErrorSpy.mockRestore();
  });

  it("throws error when context value is null", () => {
    // Mock console.error to avoid test noise
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        MessageDisplayContext.Provider,
        { value: null },
        children
      );

    expect(() => {
      renderHook(() => useMessageApi(), { wrapper });
    }).toThrow("useMessageApi must be used within MessageDisplayContext");

    consoleErrorSpy.mockRestore();
  });

  it("throws error when context value is undefined", () => {
    // Mock console.error to avoid test noise
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        MessageDisplayContext.Provider,
        { value: undefined },
        children
      );

    expect(() => {
      renderHook(() => useMessageApi(), { wrapper });
    }).toThrow("useMessageApi must be used within MessageDisplayContext");

    consoleErrorSpy.mockRestore();
  });
});

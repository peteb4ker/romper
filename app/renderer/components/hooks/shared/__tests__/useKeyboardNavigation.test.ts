import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKeyboardNavigation } from "../useKeyboardNavigation";

describe("useKeyboardNavigation", () => {
  const mockOnPlay = vi.fn();

  const defaultProps = {
    isActive: true,
    onPlay: mockOnPlay,
    samples: ["kick.wav", "snare.wav", "hat.wav"],
    selectedIdx: 0,
    voice: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns handleKeyDown function", () => {
    const { result } = renderHook(() => useKeyboardNavigation(defaultProps));

    expect(typeof result.current.handleKeyDown).toBe("function");
  });

  it("handles space key to play sample", () => {
    const { result } = renderHook(() => useKeyboardNavigation(defaultProps));

    const mockEvent = {
      key: " ",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLUListElement>;

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockOnPlay).toHaveBeenCalledWith(1, "kick.wav");
  });

  it("ignores Enter key (removed to prevent conflicts with kit name editing)", () => {
    const { result } = renderHook(() => useKeyboardNavigation(defaultProps));

    const mockEvent = {
      key: "Enter",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLUListElement>;

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(mockOnPlay).not.toHaveBeenCalled();
  });

  it("plays correct sample based on selectedIdx", () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ ...defaultProps, selectedIdx: 1 })
    );

    const mockEvent = {
      key: " ",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLUListElement>;

    result.current.handleKeyDown(mockEvent);

    expect(mockOnPlay).toHaveBeenCalledWith(1, "snare.wav");
  });

  it("ignores keys when not active", () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ ...defaultProps, isActive: false })
    );

    const mockEvent = {
      key: " ",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLUListElement>;

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(mockOnPlay).not.toHaveBeenCalled();
  });

  it("ignores keys when no samples", () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ ...defaultProps, samples: [] })
    );

    const mockEvent = {
      key: " ",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLUListElement>;

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(mockOnPlay).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const { result } = renderHook(() => useKeyboardNavigation(defaultProps));

    const mockEvent = {
      key: "ArrowDown",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLUListElement>;

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(mockOnPlay).not.toHaveBeenCalled();
  });

  it("handles edge case when selectedIdx is out of bounds", () => {
    const { result } = renderHook(() =>
      useKeyboardNavigation({ ...defaultProps, selectedIdx: 5 })
    );

    const mockEvent = {
      key: " ",
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent<HTMLUListElement>;

    result.current.handleKeyDown(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockOnPlay).toHaveBeenCalledWith(1, undefined); // Sample at index 5 doesn't exist
  });
});

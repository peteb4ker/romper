import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKitVoicePanel } from "../useKitVoicePanel";

describe("useKitVoicePanel", () => {
  it("initializes with default selected voice", () => {
    const { result } = renderHook(() => useKitVoicePanel({}));

    expect(result.current.selectedVoice).toBe(1);
  });

  it("initializes with custom initial selected voice", () => {
    const { result } = renderHook(() =>
      useKitVoicePanel({ initialSelectedVoice: 3 })
    );

    expect(result.current.selectedVoice).toBe(3);
  });

  it("updates selected voice when selectVoice is called", () => {
    const { result } = renderHook(() => useKitVoicePanel({}));

    act(() => {
      result.current.setSelectedVoice(2);
    });

    expect(result.current.selectedVoice).toBe(2);
  });

  it("calls onVoiceSelect callback when voice is selected", () => {
    const mockOnVoiceSelect = vi.fn();
    const { result } = renderHook(() =>
      useKitVoicePanel({ onVoiceSelect: mockOnVoiceSelect })
    );

    act(() => {
      result.current.setSelectedVoice(4);
    });

    expect(mockOnVoiceSelect).toHaveBeenCalledWith(4);
    expect(result.current.selectedVoice).toBe(4);
  });

  it("does not call onVoiceSelect callback when not provided", () => {
    const { result } = renderHook(() => useKitVoicePanel({}));

    // Should not throw an error
    act(() => {
      result.current.setSelectedVoice(3);
    });

    expect(result.current.selectedVoice).toBe(3);
  });

  it("handles numVoices parameter (for future use)", () => {
    const { result } = renderHook(() =>
      useKitVoicePanel({ numVoices: 8, initialSelectedVoice: 2 })
    );

    expect(result.current.selectedVoice).toBe(2);
  });

  it("maintains voice selection state across multiple calls", () => {
    const mockOnVoiceSelect = vi.fn();
    const { result } = renderHook(() =>
      useKitVoicePanel({ onVoiceSelect: mockOnVoiceSelect })
    );

    act(() => {
      result.current.setSelectedVoice(2);
    });

    act(() => {
      result.current.setSelectedVoice(3);
    });

    act(() => {
      result.current.setSelectedVoice(1);
    });

    expect(result.current.selectedVoice).toBe(1);
    expect(mockOnVoiceSelect).toHaveBeenCalledTimes(3);
    expect(mockOnVoiceSelect).toHaveBeenNthCalledWith(1, 2);
    expect(mockOnVoiceSelect).toHaveBeenNthCalledWith(2, 3);
    expect(mockOnVoiceSelect).toHaveBeenNthCalledWith(3, 1);
  });
});
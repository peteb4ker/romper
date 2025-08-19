import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUndoActionHandlers } from "../useUndoActionHandlers";

// Mock window.electronAPI
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
  deleteSampleFromSlotWithoutReindexing: vi.fn(),
  moveSampleInKit: vi.fn(),
};

beforeEach(() => {
  (window as any).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
});

afterEach(() => {
  delete (window as any).electronAPI;
});

describe("useUndoActionHandlers", () => {
  const defaultProps = {
    kitName: "TestKit",
    onMessage: vi.fn(),
    onSamplesChanged: vi.fn(),
  };

  it("initializes without error", () => {
    const { result } = renderHook(() => useUndoActionHandlers(defaultProps));
    expect(result.current).toBeDefined();
  });

  it("provides undo action handler function", () => {
    const { result } = renderHook(() => useUndoActionHandlers(defaultProps));

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe("object");
  });

  it("handles null kit name", () => {
    const propsWithNullKit = { ...defaultProps, kitName: null };
    const { result } = renderHook(() =>
      useUndoActionHandlers(propsWithNullKit)
    );

    expect(result.current).toBeDefined();
  });
});

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleManagement } from "../useSampleManagement";

// Mock window.electronAPI
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
  deleteSampleFromSlotWithoutReindexing: vi.fn(),
  getAllSamplesForKit: vi.fn(),
  moveSampleInKit: vi.fn(),
  replaceSampleInSlot: vi.fn(),
};

beforeEach(() => {
  (window as any).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
});

afterEach(() => {
  delete (window as any).electronAPI;
});

describe("useSampleManagement", () => {
  const defaultProps = {
    kitName: "TestKit",
    onMessage: vi.fn(),
    onSamplesChanged: vi.fn(),
  };

  it("initializes without error", () => {
    const { result } = renderHook(() => useSampleManagement(defaultProps));
    expect(result.current).toBeDefined();
  });

  it("provides sample management functions", () => {
    const { result } = renderHook(() => useSampleManagement(defaultProps));

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe("object");
  });

  it("handles null kit name", () => {
    const propsWithNullKit = { ...defaultProps, kitName: null };
    const { result } = renderHook(() => useSampleManagement(propsWithNullKit));

    expect(result.current).toBeDefined();
  });
});

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useSampleManagement } from "../useSampleManagement";

beforeEach(() => {
  setupElectronAPIMock();
  vi.clearAllMocks();
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
});

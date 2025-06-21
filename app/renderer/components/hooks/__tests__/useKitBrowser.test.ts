// @vitest-environment jsdom
vi.mock("../../../shared/kitUtilsShared", () => ({
  getNextKitSlot: () => "A1",
  toCapitalCase: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}));
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useKitBrowser } from "../useKitBrowser";

// Mock electronAPI
let mockListFilesInRoot: any;
let mockCreateKit: any;
let mockCopyKit: any;
let mockSelectSdCard: any;
let mockSetSetting: any;

beforeEach(() => {
  mockListFilesInRoot = vi.fn();
  mockCreateKit = vi.fn();
  mockCopyKit = vi.fn();
  mockSelectSdCard = vi.fn();
  mockSetSetting = vi.fn();
  global.window = Object.create(window);
  window.electronAPI = {
    listFilesInRoot: mockListFilesInRoot,
    createKit: mockCreateKit,
    copyKit: mockCopyKit,
    selectSdCard: mockSelectSdCard,
    setSetting: mockSetSetting,
  };
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper to create the hook with default props
function renderKitBrowserHook(props = {}) {
  return renderHook(() =>
    useKitBrowser({
      kits: ["A1"],
      localStorePath: "/sd",
      ...props,
    }),
  );
}

describe("useKitBrowser", () => {
  it("initializes with default state", () => {
    const { result } = renderKitBrowserHook();
    expect(result.current.kits).toEqual(["A1"]);
    expect(result.current.showNewKit).toBe(false);
    expect(result.current.newKitSlot).toBe("");
    expect(result.current.duplicateKitSource).toBe(null);
  });

  it("loads bankNames from rtf files", async () => {
    mockListFilesInRoot.mockResolvedValue([
      "A - alpha.rtf",
      "B - beta.rtf",
      "foo.txt",
    ]);
    const { result } = renderKitBrowserHook();
    // Wait for useEffect
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.bankNames).toEqual({ A: "Alpha", B: "Beta" });
  });

  it("setNewKitSlot updates state", () => {
    const { result } = renderKitBrowserHook();
    act(() => {
      result.current.setNewKitSlot("A2");
    });
    expect(result.current.newKitSlot).toBe("A2");
  });

  it("setDuplicateKitSource and setDuplicateKitDest update state", () => {
    const { result } = renderKitBrowserHook();
    act(() => {
      result.current.setDuplicateKitSource("A1");
      result.current.setDuplicateKitDest("B2");
    });
    expect(result.current.duplicateKitSource).toBe("A1");
    expect(result.current.duplicateKitDest).toBe("B2");
  });

  it("handleCreateKit validates and calls electronAPI", async () => {
    mockCreateKit.mockResolvedValue(undefined);
    const onRefreshKits = vi.fn();
    const { result } = renderKitBrowserHook({ onRefreshKits });
    act(() => {
      result.current.setNewKitSlot("A2");
    });
    await act(async () => {
      await result.current.handleCreateKit();
    });
    expect(mockCreateKit).toHaveBeenCalledWith("/sd", "A2");
    expect(onRefreshKits).toHaveBeenCalled();
  });

  it("handleCreateKit sets error for invalid slot", async () => {
    const { result } = renderKitBrowserHook();
    act(() => {
      result.current.setNewKitSlot("bad");
    });
    await act(async () => {
      await result.current.handleCreateKit();
    });
    expect(result.current.newKitError).toMatch(/Invalid kit slot/);
  });

  it("handleDuplicateKit validates and calls electronAPI", async () => {
    mockCopyKit.mockResolvedValue(undefined);
    const onRefreshKits = vi.fn();
    const { result } = renderKitBrowserHook({ onRefreshKits });
    await act(async () => {
      result.current.setDuplicateKitSource("A1");
      result.current.setDuplicateKitDest("B2");
    });
    await act(async () => {
      await result.current.handleDuplicateKit();
    });
    expect(mockCopyKit).toHaveBeenCalledWith("/sd", "A1", "B2");
    expect(onRefreshKits).toHaveBeenCalled();
  });

  it("handleBankClick scrolls to the correct element", () => {
    const scrollTo = vi.fn();
    const getBoundingClientRect = vi.fn(() => ({
      top: 100,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
    }));
    const el = { getBoundingClientRect };
    const container = { getBoundingClientRect, scrollTop: 0, scrollTo };
    vi.spyOn(document, "getElementById").mockReturnValue(el as any);
    vi.spyOn(document, "querySelector").mockReturnValue({
      offsetHeight: 0,
    } as any);
    const { result } = renderKitBrowserHook();
    result.current.scrollContainerRef.current = container as any;
    act(() => {
      result.current.handleBankClick("A");
    });
    expect(scrollTo).toHaveBeenCalled();
  });
});

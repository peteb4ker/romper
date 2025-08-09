import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKitBrowserHeader } from "../useKitBrowserHeader";

describe("useKitBrowserHeader", () => {
  it("calls correct handlers", () => {
    const onShowNewKit = vi.fn();
    const onCreateNextKit = vi.fn();
    const nextKitSlot = "A1";
    const { result } = renderHook(() =>
      useKitBrowserHeader({
        nextKitSlot,
        onCreateNextKit,
        onShowNewKit,
      }),
    );
    act(() => result.current.handleShowNewKit());
    expect(onShowNewKit).toHaveBeenCalled();
    act(() => result.current.handleCreateNextKit());
    expect(onCreateNextKit).toHaveBeenCalled();
    expect(result.current.nextKitSlot).toBe("A1");
  });
});

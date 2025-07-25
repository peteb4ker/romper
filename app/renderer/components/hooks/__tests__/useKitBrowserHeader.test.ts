import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKitBrowserHeader } from "../useKitBrowserHeader";

describe("useKitBrowserHeader", () => {
  it("calls correct handlers", () => {
    const onRescanAllVoiceNames = vi.fn();
    const onShowNewKit = vi.fn();
    const onCreateNextKit = vi.fn();
    const nextKitSlot = "A1";
    const { result } = renderHook(() =>
      useKitBrowserHeader({
        onRescanAllVoiceNames,
        onShowNewKit,
        onCreateNextKit,
        nextKitSlot,
      }),
    );
    act(() => result.current.handleRescanAllVoiceNames());
    expect(onRescanAllVoiceNames).toHaveBeenCalled();
    act(() => result.current.handleShowNewKit());
    expect(onShowNewKit).toHaveBeenCalled();
    act(() => result.current.handleCreateNextKit());
    expect(onCreateNextKit).toHaveBeenCalled();
    expect(result.current.nextKitSlot).toBe("A1");
  });
});

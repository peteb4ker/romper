import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKitBrowserHeader } from "../useKitBrowserHeader";

describe("useKitBrowserHeader", () => {
  it("calls correct handlers", () => {
    const onShowNewKit = vi.fn();
    const { result } = renderHook(() =>
      useKitBrowserHeader({
        onShowNewKit,
      })
    );
    act(() => result.current.handleShowNewKit());
    expect(onShowNewKit).toHaveBeenCalled();
  });
});

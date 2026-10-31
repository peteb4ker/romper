import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSampleRefreshListener } from "../useSampleRefreshListener";

function refresh(kitName: string) {
  document.dispatchEvent(
    new CustomEvent("romper:refresh-samples", { detail: { kitName } }),
  );
}

describe("[UC-26] useSampleRefreshListener", () => {
  it("[Q-01] reloads the selected kit, samples and sequence, in one reload (#452)", () => {
    const refreshKit = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useSampleRefreshListener({
        refreshKit,
        selectedKit: "A0",
      }),
    );

    refresh("A0");
    refresh("B1");

    expect(refreshKit).toHaveBeenCalledTimes(1);
    expect(refreshKit).toHaveBeenCalledWith("A0");
    unmount();
  });

  it("[UC-05] reloads the kit Remove missing samples changed, open or not (#822)", () => {
    const refreshKit = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useSampleRefreshListener({ refreshKit, selectedKit: null }),
    );

    document.dispatchEvent(
      new CustomEvent("romper:refresh-samples", {
        detail: { kitName: "B1", refreshAll: true },
      }),
    );
    // Undo on the kit grid names no kit
    refresh("");

    expect(refreshKit).toHaveBeenCalledTimes(1);
    expect(refreshKit).toHaveBeenCalledWith("B1");
    unmount();
  });
});

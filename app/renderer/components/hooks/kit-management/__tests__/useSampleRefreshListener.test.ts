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
    const reloadCurrentKitSamples = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useSampleRefreshListener({
        reloadCurrentKitSamples,
        selectedKit: "A0",
      }),
    );

    refresh("A0");
    refresh("B1");

    expect(reloadCurrentKitSamples).toHaveBeenCalledTimes(1);
    expect(reloadCurrentKitSamples).toHaveBeenCalledWith("A0");
    unmount();
  });
});

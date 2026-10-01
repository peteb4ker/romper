import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSampleRefreshListener } from "../useSampleRefreshListener";

function refresh(kitName: string) {
  document.dispatchEvent(
    new CustomEvent("romper:refresh-samples", { detail: { kitName } }),
  );
}

describe("useSampleRefreshListener", () => {
  it("reloads the selected kit's samples and its data (sequence)", () => {
    const reloadCurrentKitSamples = vi.fn().mockResolvedValue(undefined);
    const refreshKitMetadata = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useSampleRefreshListener({
        refreshKitMetadata,
        reloadCurrentKitSamples,
        selectedKit: "A0",
      }),
    );

    refresh("A0");
    refresh("B1");

    expect(reloadCurrentKitSamples).toHaveBeenCalledTimes(1);
    expect(reloadCurrentKitSamples).toHaveBeenCalledWith("A0");
    expect(refreshKitMetadata).toHaveBeenCalledTimes(1);
    expect(refreshKitMetadata).toHaveBeenCalledWith("A0");
    unmount();
  });
});

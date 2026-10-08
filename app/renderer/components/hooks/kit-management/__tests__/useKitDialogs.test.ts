import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useKitDialogs } from "../useKitDialogs";

describe("useKitDialogs", () => {
  it("starts with the validation dialog closed", () => {
    const { result } = renderHook(() => useKitDialogs());

    expect(result.current.showValidationDialog).toBe(false);
  });

  it("shows and hides the validation dialog", () => {
    const { result } = renderHook(() => useKitDialogs());

    act(() => {
      result.current.handleShowValidationDialog();
    });

    expect(result.current.showValidationDialog).toBe(true);

    act(() => {
      result.current.handleCloseValidationDialog();
    });

    expect(result.current.showValidationDialog).toBe(false);
  });
});

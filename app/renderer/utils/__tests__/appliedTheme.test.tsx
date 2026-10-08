import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { applyTheme, getAppliedTheme, useAppliedTheme } from "../appliedTheme";

describe("[UC-29] the theme on screen (#760)", () => {
  afterEach(() => {
    applyTheme(false);
  });

  it("switches the root element's dark class", () => {
    applyTheme(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(getAppliedTheme()).toBe("dark");
    applyTheme(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(getAppliedTheme()).toBe("light");
  });

  it("re-renders its readers only when the theme changes", () => {
    applyTheme(false);
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useAppliedTheme();
    });
    expect(result.current).toBe("light");

    act(() => {
      applyTheme(false);
    });
    expect(renders).toBe(1);

    act(() => {
      applyTheme(true);
    });
    expect(result.current).toBe("dark");
    expect(renders).toBe(2);
  });
});

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLatestRef } from "../useLatestRef";

describe("[Q-07] useLatestRef", () => {
  it("holds the first value after mounting", () => {
    const { result } = renderHook(() => useLatestRef("A0"));
    expect(result.current.current).toBe("A0");
  });

  it("holds the latest value after each render, in the same ref", () => {
    const { rerender, result } = renderHook(
      ({ value }) => useLatestRef(value),
      { initialProps: { value: 1 } },
    );
    const ref = result.current;

    rerender({ value: 2 });

    expect(result.current).toBe(ref);
    expect(ref.current).toBe(2);
  });

  it("keeps a value a callback wrote until the next render", () => {
    const { rerender, result } = renderHook(
      ({ value }) => useLatestRef(value),
      { initialProps: { value: 120 } },
    );

    result.current.current = 121;
    expect(result.current.current).toBe(121);

    rerender({ value: 125 });
    expect(result.current.current).toBe(125);
  });
});

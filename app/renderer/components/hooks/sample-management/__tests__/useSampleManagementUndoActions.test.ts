import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSampleManagementUndoActions } from "../useSampleManagementUndoActions";

describe("useSampleManagementUndoActions", () => {
  const defaultProps = {
    kitName: "TestKit",
    sampleMetadata: {},
    samples: { 1: ["test.wav"], 2: [], 3: [], 4: [] },
  };

  it("initializes without error", () => {
    const { result } = renderHook(() =>
      useSampleManagementUndoActions(defaultProps),
    );
    expect(result.current).toBeDefined();
  });

  it("provides undo action functions", () => {
    const { result } = renderHook(() =>
      useSampleManagementUndoActions(defaultProps),
    );

    expect(typeof result.current.getOldSampleForUndo).toBe("function");
    expect(typeof result.current.getSampleToDeleteForUndo).toBe("function");
  });

  it("handles empty samples", () => {
    const emptyProps = {
      ...defaultProps,
      samples: { 1: [], 2: [], 3: [], 4: [] },
    };

    const { result } = renderHook(() =>
      useSampleManagementUndoActions(emptyProps),
    );

    expect(result.current).toBeDefined();
  });
});

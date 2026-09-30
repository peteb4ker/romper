import type { SliceStep } from "@romper/shared/sliceTypes";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeSliceStep, toSliceView } from "../hooks/shared/sliceConstants";
import SliceStepEditor from "../SliceStepEditor";

function setup(step: SliceStep) {
  const onChange = vi.fn();
  render(<SliceStepEditor division={16} onChange={onChange} step={step} />);
  /** Apply the last edit the editor sent to `step`. */
  const lastEdit = () => {
    const edit = onChange.mock.calls.at(-1)![0] as (s: SliceStep) => SliceStep;
    return edit(step);
  };
  return { lastEdit, onChange };
}

describe("SliceStepEditor", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the step's slice number and length", () => {
    setup(makeSliceStep(4, 2, 16));
    expect(screen.getByTestId("slice-step-start")).toHaveValue(5);
    expect(screen.getByTestId("slice-step-length")).toHaveTextContent(
      "2 slices",
    );
  });

  it("sets the slice number", () => {
    const { lastEdit } = setup(makeSliceStep(0, 1, 16));
    fireEvent.change(screen.getByTestId("slice-step-start"), {
      target: { value: "9" },
    });
    expect(toSliceView(lastEdit(), 16).startSlice).toBe(8);
  });

  it("ignores an empty slice number", () => {
    const { onChange } = setup(makeSliceStep(0, 1, 16));
    fireEvent.change(screen.getByTestId("slice-step-start"), {
      target: { value: "" },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lengthens and shortens within bounds", () => {
    const { lastEdit } = setup(makeSliceStep(0, 2, 16));
    fireEvent.click(screen.getByTestId("slice-step-longer"));
    expect(toSliceView(lastEdit(), 16).lengthSlices).toBe(3);
    fireEvent.click(screen.getByTestId("slice-step-shorter"));
    expect(toSliceView(lastEdit(), 16).lengthSlices).toBe(1);
  });

  it("disables shorter at one slice and longer at the sample end", () => {
    setup(makeSliceStep(15, 1, 16));
    expect(screen.getByTestId("slice-step-shorter")).toBeDisabled();
    expect(screen.getByTestId("slice-step-longer")).toBeDisabled();
  });

  it("toggles random and lock", () => {
    const { lastEdit } = setup(makeSliceStep(0, 1, 16));
    fireEvent.click(screen.getByTestId("slice-step-random"));
    expect(lastEdit().random).toBe(true);
    fireEvent.click(screen.getByTestId("slice-step-lock"));
    expect(lastEdit().locked).toBe(true);
  });

  it("disables the slice number for random steps", () => {
    setup(makeSliceStep(0, 1, 16, { random: true }));
    expect(screen.getByTestId("slice-step-start")).toBeDisabled();
  });
});

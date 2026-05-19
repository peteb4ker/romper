import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import StereoIcon from "../StereoIcon";

describe("StereoIcon", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an svg element", () => {
    const { container } = render(<StereoIcon />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders two interlocking circles", () => {
    const { container } = render(<StereoIcon />);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });

  it("uses the default size of 16 when no size is given", () => {
    const { container } = render(<StereoIcon />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
  });

  it("applies a custom size", () => {
    const { container } = render(<StereoIcon size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
  });

  it("applies a custom className", () => {
    const { container } = render(<StereoIcon className="stereo" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toBe(
      "stereo",
    );
  });
});

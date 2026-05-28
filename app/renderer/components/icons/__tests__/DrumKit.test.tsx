import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DrumKit } from "../DrumKit";

describe("DrumKit", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an svg element", () => {
    const { container } = render(<DrumKit />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("uses the default size of 256 when no size is given", () => {
    const { container } = render(<DrumKit />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("256");
    expect(svg?.getAttribute("height")).toBe("256");
  });

  it("applies a custom size", () => {
    const { container } = render(<DrumKit size={48} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("48");
    expect(svg?.getAttribute("height")).toBe("48");
  });

  it("applies a custom className", () => {
    const { container } = render(<DrumKit className="my-icon" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toBe(
      "my-icon",
    );
  });

  it("defaults fill to currentColor", () => {
    const { container } = render(<DrumKit />);
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe(
      "currentColor",
    );
  });

  it("uses the color prop for fill", () => {
    const { container } = render(<DrumKit color="#ff0000" />);
    expect(container.querySelector("svg")?.getAttribute("fill")).toBe(
      "#ff0000",
    );
  });

  it("forwards a ref to the svg element", () => {
    const ref = React.createRef<SVGSVGElement>();
    render(<DrumKit ref={ref} />);
    expect(ref.current?.tagName).toBe("svg");
  });

  it("exposes a displayName", () => {
    expect(DrumKit.displayName).toBe("DrumKit");
  });
});

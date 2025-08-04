import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Spinner from "../Spinner";

describe("Spinner", () => {
  it("should render with default props", () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector("svg");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute("width", "20");
    expect(spinner).toHaveAttribute("height", "20");
  });

  it("should render with custom size", () => {
    const { container } = render(<Spinner size={40} />);
    const spinner = container.querySelector("svg");
    expect(spinner).toHaveAttribute("width", "40");
    expect(spinner).toHaveAttribute("height", "40");
  });

  it("should apply custom className", () => {
    const { container } = render(<Spinner className="custom-class" />);
    const spinner = container.querySelector("svg");
    expect(spinner).toHaveClass("custom-class");
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveClass("text-white");
  });

  it("should render with data-testid", () => {
    render(<Spinner data-testid="loading-spinner" />);
    const spinner = screen.getByTestId("loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("should have correct SVG structure", () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector("svg");

    // Check SVG attributes
    expect(spinner).toHaveAttribute("viewBox", "0 0 24 24");
    expect(spinner).toHaveAttribute("fill", "none");
    expect(spinner).toHaveAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Check inline styles
    expect(spinner).toHaveStyle({
      display: "inline-block",
      verticalAlign: "middle",
    });
  });

  it("should contain circle and path elements", () => {
    const { container } = render(<Spinner />);
    const circle = container.querySelector("circle");
    const path = container.querySelector("path");

    expect(circle).toBeInTheDocument();
    expect(path).toBeInTheDocument();

    // Check circle attributes
    expect(circle).toHaveAttribute("cx", "12");
    expect(circle).toHaveAttribute("cy", "12");
    expect(circle).toHaveAttribute("r", "10");
    expect(circle).toHaveAttribute("stroke", "currentColor");
    expect(circle).toHaveAttribute("stroke-width", "4");
    expect(circle).toHaveClass("opacity-25");

    // Check path attributes
    expect(path).toHaveAttribute("fill", "currentColor");
    expect(path).toHaveAttribute("d", "M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z");
    expect(path).toHaveClass("opacity-75");
  });

  it("should combine default and custom classes correctly", () => {
    const { container } = render(
      <Spinner className="my-custom-class another-class" />,
    );
    const spinner = container.querySelector("svg");
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveClass("text-white");
    expect(spinner).toHaveClass("my-custom-class");
    expect(spinner).toHaveClass("another-class");
  });
});

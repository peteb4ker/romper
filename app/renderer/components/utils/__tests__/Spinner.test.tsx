import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import Spinner from "../Spinner";

describe("Spinner", () => {
  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(<Spinner />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("should render SVG with default size", () => {
      const { container } = render(<Spinner />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "20");
      expect(svg).toHaveAttribute("height", "20");
    });

    it("should render with custom size", () => {
      const { container } = render(<Spinner size={32} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "32");
      expect(svg).toHaveAttribute("height", "32");
    });

    it("should apply custom className", () => {
      const { container } = render(<Spinner className="custom-class" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("custom-class");
    });

    it("should apply data-testid when provided", () => {
      render(<Spinner data-testid="loading-spinner" />);
      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
    });
  });

  describe("SVG structure", () => {
    it("should have correct viewBox", () => {
      const { container } = render(<Spinner />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
    });

    it("should have circle element with correct attributes", () => {
      const { container } = render(<Spinner />);
      const circle = container.querySelector("circle");
      expect(circle).toBeInTheDocument();
      expect(circle).toHaveAttribute("cx", "12");
      expect(circle).toHaveAttribute("cy", "12");
      expect(circle).toHaveAttribute("r", "10");
      expect(circle).toHaveAttribute("stroke", "currentColor");
      expect(circle).toHaveAttribute("stroke-width", "4");
      expect(circle).toHaveClass("opacity-25");
    });

    it("should have path element with correct attributes", () => {
      const { container } = render(<Spinner />);
      const path = container.querySelector("path");
      expect(path).toBeInTheDocument();
      expect(path).toHaveAttribute("d", "M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z");
      expect(path).toHaveAttribute("fill", "currentColor");
      expect(path).toHaveClass("opacity-75");
    });
  });

  describe("CSS classes", () => {
    it("should have default classes", () => {
      const { container } = render(<Spinner />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("animate-spin");
      expect(svg).toHaveClass("text-white");
    });

    it("should combine default and custom classes", () => {
      const { container } = render(<Spinner className="text-blue-500 ml-2" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("animate-spin");
      expect(svg).toHaveClass("text-white");
      expect(svg).toHaveClass("text-blue-500");
      expect(svg).toHaveClass("ml-2");
    });
  });

  describe("inline styles", () => {
    it("should have correct inline styles", () => {
      const { container } = render(<Spinner />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveStyle({
        display: "inline-block",
        verticalAlign: "middle",
      });
    });
  });

  describe("edge cases", () => {
    it("should handle size of 0", () => {
      const { container } = render(<Spinner size={0} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "0");
      expect(svg).toHaveAttribute("height", "0");
    });

    it("should handle very large sizes", () => {
      const { container } = render(<Spinner size={1000} />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "1000");
      expect(svg).toHaveAttribute("height", "1000");
    });

    it("should handle empty className", () => {
      const { container } = render(<Spinner className="" />);
      const svg = container.querySelector("svg");
      expect(svg).toHaveClass("animate-spin");
      expect(svg).toHaveClass("text-white");
    });

    it("should handle undefined props gracefully", () => {
      const { container } = render(
        <Spinner className={undefined} size={undefined} />
      );
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "20");
      expect(svg).toHaveAttribute("height", "20");
    });
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GainKnob from "../GainKnob";

describe("GainKnob", () => {
  const defaultProps = {
    onChange: vi.fn(),
    value: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders an SVG slider element", () => {
      render(<GainKnob {...defaultProps} />);

      const slider = screen.getByRole("slider");
      expect(slider).toBeInTheDocument();
      expect(slider.tagName).toBe("svg");
    });

    it("renders with correct aria-label for 0 dB", () => {
      render(<GainKnob {...defaultProps} value={0} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-label", "Gain: 0 dB");
    });

    it("renders with correct aria-label for positive value", () => {
      render(<GainKnob {...defaultProps} value={12} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-label", "Gain: +12 dB");
    });

    it("renders with correct aria-label for negative value", () => {
      render(<GainKnob {...defaultProps} value={-24} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-label", "Gain: -24 dB");
    });

    it("renders with correct aria-valuemin and aria-valuemax", () => {
      render(<GainKnob {...defaultProps} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-valuemin", "-24");
      expect(slider).toHaveAttribute("aria-valuemax", "12");
    });

    it("renders with correct aria-valuenow", () => {
      render(<GainKnob {...defaultProps} value={6} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-valuenow", "6");
    });

    it("renders SVG path elements for arcs", () => {
      const { container } = render(<GainKnob {...defaultProps} value={0} />);

      const paths = container.querySelectorAll("path");
      // Background arc + value arc (value > MIN_DB)
      expect(paths.length).toBeGreaterThanOrEqual(1);
    });

    it("renders background arc path", () => {
      const { container } = render(<GainKnob {...defaultProps} value={0} />);

      const paths = container.querySelectorAll("path");
      // First path is the background arc
      expect(paths[0]).toHaveAttribute("d");
      expect(paths[0].getAttribute("d")).toContain("M");
      expect(paths[0].getAttribute("d")).toContain("A");
    });

    it("renders value arc when value is above minimum", () => {
      const { container } = render(<GainKnob {...defaultProps} value={0} />);

      const paths = container.querySelectorAll("path");
      // Should have both background and value arc
      expect(paths.length).toBe(2);
    });

    it("does not render value arc when value is at minimum (-24)", () => {
      const { container } = render(<GainKnob {...defaultProps} value={-24} />);

      const paths = container.querySelectorAll("path");
      // Only background arc, no value arc
      expect(paths.length).toBe(1);
    });

    it("renders dot indicator circle", () => {
      const { container } = render(<GainKnob {...defaultProps} />);

      const circles = container.querySelectorAll("circle");
      expect(circles.length).toBe(1);
    });

    it("renders unity mark line when not hovered", () => {
      const { container } = render(<GainKnob {...defaultProps} />);

      const lines = container.querySelectorAll("line");
      expect(lines.length).toBe(1);
    });
  });

  describe("formatDb display", () => {
    it("formats 0 as '0 dB'", () => {
      render(<GainKnob {...defaultProps} value={0} />);

      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-label",
        "Gain: 0 dB",
      );
    });

    it("formats positive values with plus sign", () => {
      render(<GainKnob {...defaultProps} value={6} />);

      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-label",
        "Gain: +6 dB",
      );
    });

    it("formats max value as '+12 dB'", () => {
      render(<GainKnob {...defaultProps} value={12} />);

      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-label",
        "Gain: +12 dB",
      );
    });

    it("formats min value as '-24 dB'", () => {
      render(<GainKnob {...defaultProps} value={-24} />);

      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-label",
        "Gain: -24 dB",
      );
    });

    it("rounds fractional values", () => {
      render(<GainKnob {...defaultProps} value={3.7} />);

      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-label",
        "Gain: +4 dB",
      );
    });
  });

  describe("disabled state", () => {
    it("renders with default cursor when disabled", () => {
      render(<GainKnob {...defaultProps} disabled />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveStyle({ cursor: "default" });
    });

    it("renders with ns-resize cursor when not disabled", () => {
      render(<GainKnob {...defaultProps} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveStyle({ cursor: "ns-resize" });
    });
  });

  describe("SVG dimensions", () => {
    it("renders SVG with correct width and height", () => {
      render(<GainKnob {...defaultProps} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("width", "20");
      expect(slider).toHaveAttribute("height", "20");
    });

    it("renders SVG with correct viewBox", () => {
      render(<GainKnob {...defaultProps} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("viewBox", "0 0 20 20");
    });
  });
});

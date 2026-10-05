import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GainKnob, { gainForKey } from "../GainKnob";

describe("[UC-24] GainKnob", () => {
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

  describe("[UC-07] an unknown gain (#628)", () => {
    it("shows – instead of a gain, and is disabled", () => {
      render(<GainKnob onChange={vi.fn()} value={null} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-label", "Gain: –");
      expect(slider).toHaveAttribute("aria-valuetext", "–");
      expect(slider).not.toHaveAttribute("aria-valuenow");
      expect(slider).toHaveAttribute("aria-disabled", "true");
      expect(slider).toHaveAttribute("tabindex", "-1");
      // No value arc or dot to read as 0 dB
      expect(slider.querySelector("circle")).toBeNull();
      expect(slider.querySelectorAll("path")).toHaveLength(1);
    });

    it("shows – on hover", () => {
      render(<GainKnob onChange={vi.fn()} value={null} />);

      fireEvent.mouseEnter(screen.getByRole("presentation"));

      expect(screen.getByText("–")).toBeInTheDocument();
      expect(screen.queryByText("0 dB")).not.toBeInTheDocument();
    });

    it("can't be turned", () => {
      const onChange = vi.fn();
      render(<GainKnob onChange={onChange} value={null} />);
      const slider = screen.getByRole("slider");

      fireEvent.wheel(slider, { deltaY: -100 });
      fireEvent.keyDown(slider, { key: "ArrowUp" });
      fireEvent.click(slider);
      fireEvent.mouseDown(slider, { clientY: 100 });
      fireEvent.mouseMove(globalThis.window, { clientY: 50 });
      fireEvent.mouseUp(globalThis.window);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("shows the gain again once it's known", () => {
      const { rerender } = render(<GainKnob onChange={vi.fn()} value={null} />);

      rerender(<GainKnob onChange={vi.fn()} value={-3} />);

      const slider = screen.getByRole("slider");
      expect(slider).toHaveAttribute("aria-label", "Gain: -3 dB");
      expect(slider).toHaveAttribute("aria-valuenow", "-3");
      expect(slider).not.toHaveAttribute("aria-disabled");
      expect(slider).toHaveAttribute("tabindex", "0");
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

  // RE-48: the knob had no keyboard support
  describe("[Q-06] keyboard", () => {
    it("is in the tab order unless disabled", () => {
      const { rerender } = render(<GainKnob {...defaultProps} />);
      expect(screen.getByRole("slider")).toHaveAttribute("tabindex", "0");
      rerender(<GainKnob {...defaultProps} disabled />);
      expect(screen.getByRole("slider")).toHaveAttribute("tabindex", "-1");
    });

    it.each([
      ["ArrowUp", false, 1],
      ["ArrowRight", false, 1],
      ["ArrowDown", false, -1],
      ["ArrowLeft", false, -1],
      ["ArrowUp", true, 0.5],
      ["PageUp", false, 6],
      ["PageDown", false, -6],
      ["Home", false, -24],
      ["End", false, 12],
    ])("%s (Shift: %s) sets the gain to %s dB", (key, shiftKey, expected) => {
      const onChange = vi.fn();
      render(<GainKnob onChange={onChange} value={0} />);
      const slider = screen.getByRole("slider");

      const notCancelled = fireEvent.keyDown(slider, { key, shiftKey });

      expect(onChange).toHaveBeenCalledWith(expected);
      expect(notCancelled).toBe(false);
      expect(slider).toHaveAttribute("aria-valuenow", String(expected));
    });

    it("0 returns to unity gain", () => {
      const onChange = vi.fn();
      render(<GainKnob onChange={onChange} value={-6} />);
      fireEvent.keyDown(screen.getByRole("slider"), { key: "0" });
      expect(onChange).toHaveBeenCalledWith(0);
    });

    it("stays within -24 to +12 dB", () => {
      const onChange = vi.fn();
      render(<GainKnob onChange={onChange} value={11} />);
      fireEvent.keyDown(screen.getByRole("slider"), { key: "PageUp" });
      expect(onChange).toHaveBeenCalledWith(12);
    });

    it("keeps its keys from the sample list around it", () => {
      const onParentKey = vi.fn();
      render(
        <div onKeyDown={onParentKey}>
          <GainKnob {...defaultProps} />
        </div>,
      );
      fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowDown" });
      expect(onParentKey).not.toHaveBeenCalled();
    });

    it("ignores keys when disabled or with Cmd, Ctrl or Alt", () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <GainKnob disabled onChange={onChange} value={0} />,
      );
      fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowUp" });
      rerender(<GainKnob onChange={onChange} value={0} />);
      fireEvent.keyDown(screen.getByRole("slider"), {
        key: "ArrowUp",
        metaKey: true,
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("shows the value while focused", () => {
      render(<GainKnob {...defaultProps} value={3} />);
      expect(screen.queryByText("+3 dB")).not.toBeInTheDocument();
      fireEvent.focus(screen.getByRole("slider"));
      expect(screen.getByText("+3 dB")).toBeInTheDocument();
      fireEvent.blur(screen.getByRole("slider"));
      expect(screen.queryByText("+3 dB")).not.toBeInTheDocument();
    });

    it("gainForKey ignores other keys", () => {
      expect(gainForKey("a", 0, false)).toBeNull();
    });
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ICON_LED_COUNT } from "../ledIconConstants";

// Mock useMiniLedAnimation to avoid RAF in tests
const mockSetMousePosition = vi.fn();
const mockClearMousePosition = vi.fn();
const mockAddRipple = vi.fn();

vi.mock("../useLedVisualization", () => ({
  useLedVisualization: () => ({
    addRipple: mockAddRipple,
    clearMousePosition: mockClearMousePosition,
    ledRefs: { current: [] },
    setMousePosition: mockSetMousePosition,
  }),
}));

// Import after mock
import LedIconGrid from "../LedIconGrid";

describe("LedIconGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(cb, 16);
      return 1;
    });
    global.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the grid container", () => {
    render(<LedIconGrid />);
    const grid = screen.getByTestId("led-icon-grid");
    expect(grid).toBeInTheDocument();
  });

  it("renders exactly ICON_LED_COUNT LED pixels", () => {
    render(<LedIconGrid />);
    const leds = screen.getAllByTestId("led-icon-pixel");
    expect(leds).toHaveLength(ICON_LED_COUNT);
    expect(leds).toHaveLength(70);
  });

  it("each LED has rounded-full and bg-voice-1 classes", () => {
    render(<LedIconGrid />);
    const leds = screen.getAllByTestId("led-icon-pixel");
    expect(leds[0]).toHaveClass("rounded-full", "bg-voice-1");
  });

  it("grid has correct grid template styles", () => {
    render(<LedIconGrid />);
    const grid = screen.getByTestId("led-icon-grid");
    expect(grid.style.gridTemplateColumns).toBe("repeat(14, 6px)");
    expect(grid.style.gridTemplateRows).toBe("repeat(5, 6px)");
  });

  it("calls clearMousePosition on mouse leave", () => {
    render(<LedIconGrid />);
    const grid = screen.getByTestId("led-icon-grid");
    fireEvent.mouseLeave(grid);
    expect(mockClearMousePosition).toHaveBeenCalled();
  });

  it("has button role and accessible label", () => {
    render(<LedIconGrid />);
    const button = screen.getByRole("button", { name: "About Romper" });
    expect(button).toBeInTheDocument();
  });

  it("is keyboard focusable", () => {
    render(<LedIconGrid />);
    const grid = screen.getByTestId("led-icon-grid");
    expect(grid.getAttribute("tabindex")).toBe("0");
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<LedIconGrid onClick={handleClick} />);
    const grid = screen.getByTestId("led-icon-grid");
    fireEvent.click(grid);
    expect(handleClick).toHaveBeenCalled();
  });

  it("triggers ripple and onClick on Enter key", () => {
    const handleClick = vi.fn();
    render(<LedIconGrid onClick={handleClick} />);
    const grid = screen.getByTestId("led-icon-grid");
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(mockAddRipple).toHaveBeenCalledWith(7, 2.5);
    expect(handleClick).toHaveBeenCalled();
  });

  it("triggers ripple and onClick on Space key", () => {
    const handleClick = vi.fn();
    render(<LedIconGrid onClick={handleClick} />);
    const grid = screen.getByTestId("led-icon-grid");
    fireEvent.keyDown(grid, { key: " " });
    expect(mockAddRipple).toHaveBeenCalledWith(7, 2.5);
    expect(handleClick).toHaveBeenCalled();
  });

  it("has correct size classes", () => {
    render(<LedIconGrid />);
    const grid = screen.getByTestId("led-icon-grid");
    expect(grid).toHaveClass("h-[38px]", "rounded-sm", "bg-black");
  });
});

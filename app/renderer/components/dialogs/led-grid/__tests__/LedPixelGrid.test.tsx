import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LED_COUNT } from "../ledConstants";

// Mock useLedAnimation to avoid RAF in tests
const mockSetMousePosition = vi.fn();
const mockClearMousePosition = vi.fn();
const mockAddRipple = vi.fn();

vi.mock("../useLedAnimation", () => ({
  useLedAnimation: () => ({
    addRipple: mockAddRipple,
    clearMousePosition: mockClearMousePosition,
    ledRefs: { current: [] },
    setMousePosition: mockSetMousePosition,
  }),
}));

// Import after mock
import LedPixelGrid from "../LedPixelGrid";

describe("LedPixelGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock RAF
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
    render(<LedPixelGrid />);
    const grid = screen.getByTestId("led-pixel-grid");
    expect(grid).toBeInTheDocument();
  });

  it("renders exactly LED_COUNT LED pixels", () => {
    render(<LedPixelGrid />);
    const leds = screen.getAllByTestId("led-pixel");
    expect(leds).toHaveLength(LED_COUNT);
    expect(leds).toHaveLength(448);
  });

  it("each LED has rounded-full and bg-voice-1 classes", () => {
    render(<LedPixelGrid />);
    const leds = screen.getAllByTestId("led-pixel");
    expect(leds[0]).toHaveClass("rounded-full", "bg-voice-1");
  });

  it("grid has correct grid template styles", () => {
    render(<LedPixelGrid />);
    const grid = screen.getByTestId("led-pixel-grid");
    expect(grid.style.gridTemplateColumns).toBe("repeat(28, 1fr)");
    expect(grid.style.gridTemplateRows).toBe("repeat(16, 1fr)");
  });

  it("calls clearMousePosition on mouse leave", () => {
    render(<LedPixelGrid />);
    const grid = screen.getByTestId("led-pixel-grid");

    fireEvent.mouseLeave(grid);
    expect(mockClearMousePosition).toHaveBeenCalled();
  });

  it("has absolute positioning for overlay usage", () => {
    render(<LedPixelGrid />);
    const grid = screen.getByTestId("led-pixel-grid");
    expect(grid).toHaveClass("absolute", "inset-0");
  });
});

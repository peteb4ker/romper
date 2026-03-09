import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LED_COLS, LED_COUNT, LED_ROWS } from "../ledConstants";

// Mock useLedAnimation to avoid RAF in tests
const mockSetMousePosition = vi.fn();
const mockClearMousePosition = vi.fn();
const mockAddRipple = vi.fn();
const mockLedRefs: { current: (HTMLElement | null)[] } = { current: [] };

vi.mock("../useLedAnimation", () => ({
  useLedAnimation: () => ({
    addRipple: mockAddRipple,
    clearMousePosition: mockClearMousePosition,
    ledRefs: mockLedRefs,
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

  describe("mouse coordinate mapping via LED element positions", () => {
    function mockLedPositions() {
      // Simulate a 400x240 grid area with 4px padding, 2px gaps
      // First LED (top-left): center at (10, 10)
      // Last LED (bottom-right): center at (390, 230)
      const firstLed = mockLedRefs.current[0];
      const lastLed = mockLedRefs.current[LED_COUNT - 1];
      if (firstLed) {
        vi.spyOn(firstLed, "getBoundingClientRect").mockReturnValue({
          bottom: 15,
          height: 10,
          left: 5,
          right: 15,
          top: 5,
          width: 10,
          x: 5,
          y: 5,
        });
      }
      if (lastLed) {
        vi.spyOn(lastLed, "getBoundingClientRect").mockReturnValue({
          bottom: 235,
          height: 10,
          left: 385,
          right: 395,
          top: 225,
          width: 10,
          x: 385,
          y: 225,
        });
      }
    }

    it("maps mouse at first LED center to col=0, row=0", () => {
      render(<LedPixelGrid />);
      mockLedPositions();
      const grid = screen.getByTestId("led-pixel-grid");

      // Mouse at first LED center (10, 10)
      fireEvent.mouseMove(grid, { clientX: 10, clientY: 10 });

      expect(mockSetMousePosition).toHaveBeenCalledWith(0, 0);
    });

    it("maps mouse at last LED center to col=LED_COLS-1, row=LED_ROWS-1", () => {
      render(<LedPixelGrid />);
      mockLedPositions();
      const grid = screen.getByTestId("led-pixel-grid");

      // Mouse at last LED center (390, 230)
      fireEvent.mouseMove(grid, { clientX: 390, clientY: 230 });

      expect(mockSetMousePosition).toHaveBeenCalledWith(
        LED_COLS - 1,
        LED_ROWS - 1,
      );
    });

    it("maps mouse at grid center to approximately mid-column and mid-row", () => {
      render(<LedPixelGrid />);
      mockLedPositions();
      const grid = screen.getByTestId("led-pixel-grid");

      // Mouse at center between first (10,10) and last (390,230) = (200, 120)
      fireEvent.mouseMove(grid, { clientX: 200, clientY: 120 });

      expect(mockSetMousePosition).toHaveBeenCalled();
      const [col, row] = mockSetMousePosition.mock.calls[0];
      // Center should map to roughly half of (LED_COLS-1) and (LED_ROWS-1)
      expect(col).toBeCloseTo((LED_COLS - 1) / 2, 0);
      expect(row).toBeCloseTo((LED_ROWS - 1) / 2, 0);
    });

    it("maps click at LED position to correct ripple coordinates", () => {
      render(<LedPixelGrid />);
      mockLedPositions();
      const grid = screen.getByTestId("led-pixel-grid");

      // Click at last LED center
      fireEvent.click(grid, { clientX: 390, clientY: 230 });

      expect(mockAddRipple).toHaveBeenCalledWith(LED_COLS - 1, LED_ROWS - 1);
    });

    it("does not call setMousePosition when LED refs are missing", () => {
      // Temporarily clear refs to simulate unmounted state
      const savedRefs = [...mockLedRefs.current];
      mockLedRefs.current = [];

      render(<LedPixelGrid />);
      // Override the refs that render populated
      mockLedRefs.current = [];

      const grid = screen.getByTestId("led-pixel-grid");
      fireEvent.mouseMove(grid, { clientX: 100, clientY: 100 });

      expect(mockSetMousePosition).not.toHaveBeenCalled();

      // Restore
      mockLedRefs.current = savedRefs;
    });
  });
});

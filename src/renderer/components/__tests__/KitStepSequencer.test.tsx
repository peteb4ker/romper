import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import KitStepSequencer from "../KitStepSequencer";

// Minimal stub for required props
const defaultSamples = {
  1: ["kick.wav"],
  2: ["snare.wav"],
  3: ["hat.wav"],
  4: ["tom.wav"],
};
const defaultStepPattern = Array.from({ length: 4 }, () =>
  Array(16).fill(false),
);

describe("KitStepSequencer", () => {
  let onPlaySample;
  let stepPattern;
  let setStepPattern;
  let sequencerOpen;
  let setSequencerOpen;

  beforeEach(() => {
    onPlaySample = vi.fn();
    stepPattern = defaultStepPattern.map((row) => [...row]);
    setStepPattern = vi.fn((pattern) => {
      stepPattern = pattern;
    });
    sequencerOpen = false;
    setSequencerOpen = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a 4x16 step grid with color-coded rows and toggleable steps", () => {
    render(
      <KitStepSequencer
        samples={defaultSamples}
        onPlaySample={onPlaySample}
        stepPattern={stepPattern}
        setStepPattern={setStepPattern}
      />,
    );
    const grid = screen.getByTestId("kit-step-sequencer");
    for (let v = 0; v < 4; v++) {
      expect(screen.getByTestId(`seq-voice-label-${v}`)).toBeInTheDocument();
      for (let s = 0; s < 16; s++) {
        const btn = screen.getByTestId(`seq-step-${v}-${s}`);
        expect(btn).toBeInTheDocument();
        expect(btn).toHaveClass("bg-gray-300");
      }
    }
    // Toggle a step and check color
    const stepBtn = screen.getByTestId("seq-step-2-5");
    fireEvent.click(stepBtn);
    // setStepPattern is called, but we can't check color change without rerender
    expect(setStepPattern).toHaveBeenCalled();
  });

  it("step sequencer grid and buttons have fixed size", () => {
    render(
      <KitStepSequencer
        samples={defaultSamples}
        onPlaySample={onPlaySample}
        stepPattern={stepPattern}
        setStepPattern={setStepPattern}
      />,
    );
    const grid = screen.getByTestId("kit-step-sequencer-grid");
    expect(grid.className).toMatch(/w-\[600px\]/);
    expect(grid.className).toMatch(/min-w-\[600px\]/);
    expect(grid.className).toMatch(/max-w-\[600px\]/);
    for (let v = 0; v < 4; v++) {
      for (let s = 0; s < 16; s++) {
        const btn = screen.getByTestId(`seq-step-${v}-${s}`);
        expect(btn.className).toMatch(/w-8/);
        expect(btn.className).toMatch(/h-8/);
        expect(btn.className).toMatch(/min-w-8/);
        expect(btn.className).toMatch(/min-h-8/);
        expect(btn.className).toMatch(/max-w-8/);
        expect(btn.className).toMatch(/max-h-8/);
      }
    }
  });

  it("step sequencer drawer is hidden by default", () => {
    render(
      <KitStepSequencer
        samples={defaultSamples}
        onPlaySample={onPlaySample}
        stepPattern={stepPattern}
        setStepPattern={setStepPattern}
      />,
    );
    const drawer = screen.getByTestId("kit-step-sequencer-drawer");
    expect(drawer.className).toMatch(/max-h-0/);
    expect(drawer.className).toMatch(/opacity-0/);
  });

  it("step sequencer drawer can be shown and hidden with animation", () => {
    // Use stateful wrapper to test open/close
    function Wrapper() {
      const [open, setOpen] = React.useState(false);
      return (
        <KitStepSequencer
          samples={defaultSamples}
          onPlaySample={onPlaySample}
          stepPattern={stepPattern}
          setStepPattern={setStepPattern}
          sequencerOpen={open}
          setSequencerOpen={setOpen}
        />
      );
    }
    render(<Wrapper />);
    const handle = screen.getByTestId("kit-step-sequencer-handle");
    const drawer = screen.getByTestId("kit-step-sequencer-drawer");
    fireEvent.click(handle);
    expect(drawer.className).toMatch(/max-h-\[400px\]/);
    expect(drawer.className).toMatch(/opacity-100/);
    fireEvent.click(handle);
    expect(drawer.className).toMatch(/max-h-0/);
    expect(drawer.className).toMatch(/opacity-0/);
  });

  it("supports keyboard navigation and toggling of steps", () => {
    function Wrapper() {
      const [open, setOpen] = React.useState(true);
      return (
        <KitStepSequencer
          samples={defaultSamples}
          onPlaySample={onPlaySample}
          stepPattern={stepPattern}
          setStepPattern={setStepPattern}
          sequencerOpen={open}
          setSequencerOpen={setOpen}
        />
      );
    }
    render(<Wrapper />);
    // Open the drawer first
    const grid = screen.getByTestId("kit-step-sequencer-grid");
    grid.focus();
    let btn = screen.getByTestId("seq-step-0-0");
    expect(screen.getByTestId("seq-step-focus-ring")).toBeVisible();
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    btn = screen.getByTestId("seq-step-0-1");
    expect(screen.getByTestId("seq-step-focus-ring")).toBeVisible();
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    btn = screen.getByTestId("seq-step-1-1");
    expect(screen.getByTestId("seq-step-focus-ring")).toBeVisible();
    fireEvent.keyDown(grid, { key: "ArrowLeft" });
    btn = screen.getByTestId("seq-step-1-0");
    expect(screen.getByTestId("seq-step-focus-ring")).toBeVisible();
    fireEvent.keyDown(grid, { key: "ArrowUp" });
    btn = screen.getByTestId("seq-step-0-0");
    expect(screen.getByTestId("seq-step-focus-ring")).toBeVisible();
    expect(btn).toHaveClass("bg-gray-300");
    fireEvent.keyDown(grid, { key: " " });
    expect(setStepPattern).toHaveBeenCalled();
    fireEvent.keyDown(grid, { key: "Enter" });
    expect(setStepPattern).toHaveBeenCalled();
    const btn2 = screen.getByTestId("seq-step-2-5");
    fireEvent.click(btn2);
    expect(screen.getByTestId("seq-step-focus-ring")).toBeVisible();
  });

  it("does not allow keyboard navigation when sequencerOpen is false (drawer closed)", () => {
    render(
      <KitStepSequencer
        samples={defaultSamples}
        onPlaySample={onPlaySample}
        stepPattern={stepPattern}
        setStepPattern={setStepPattern}
        sequencerOpen={false}
        setSequencerOpen={setSequencerOpen}
      />,
    );
    // Try to focus and send key events
    const grid = screen.getByTestId("kit-step-sequencer-grid");
    grid.focus();
    fireEvent.keyDown(grid, { key: "ArrowRight" });
    // Focus should not move, no step toggled
    expect(setStepPattern).not.toHaveBeenCalled();
  });

  it("allows keyboard navigation when sequencerOpen is true (drawer open)", () => {
    render(
      <KitStepSequencer
        samples={defaultSamples}
        onPlaySample={onPlaySample}
        stepPattern={stepPattern}
        setStepPattern={setStepPattern}
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
      />,
    );
    const grid = screen.getByTestId("kit-step-sequencer-grid");
    grid.focus();
    fireEvent.keyDown(grid, { key: " " });
    expect(setStepPattern).toHaveBeenCalled();
  });

  it("focuses the sequencer grid when opened (3.9)", async () => {
    function Wrapper() {
      const [open, setOpen] = React.useState(false);
      const gridRef = React.useRef(null);
      return (
        <KitStepSequencer
          samples={defaultSamples}
          onPlaySample={onPlaySample}
          stepPattern={stepPattern}
          setStepPattern={setStepPattern}
          sequencerOpen={open}
          setSequencerOpen={setOpen}
          gridRef={gridRef}
        />
      );
    }
    render(<Wrapper />);
    const handle = screen.getByTestId("kit-step-sequencer-handle");
    fireEvent.click(handle); // open
    const grid = screen.getByTestId("kit-step-sequencer-grid");
    await waitFor(() => {
      expect(document.activeElement).toBe(grid);
    });
  });
});

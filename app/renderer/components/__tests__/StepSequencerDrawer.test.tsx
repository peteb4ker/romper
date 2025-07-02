import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StepSequencerDrawer from "../StepSequencerDrawer";

describe("StepSequencerDrawer", () => {
  let sequencerOpen;
  let setSequencerOpen;

  beforeEach(() => {
    sequencerOpen = false;
    setSequencerOpen = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders closed drawer when sequencerOpen is false", () => {
    render(
      <StepSequencerDrawer
        sequencerOpen={false}
        setSequencerOpen={setSequencerOpen}
      >
        <div data-testid="drawer-content">Content</div>
      </StepSequencerDrawer>,
    );

    const drawer = screen.getByTestId("kit-step-sequencer-drawer");
    expect(drawer).toBeInTheDocument();

    // Verify drawer is closed (check for closed drawer classes)
    expect(drawer.className).toMatch(/max-h-0/);
    expect(drawer.className).toMatch(/opacity-0/);

    // Content should still be in the DOM when closed
    expect(screen.getByTestId("drawer-content")).toBeInTheDocument();
  });

  it("renders open drawer when sequencerOpen is true", () => {
    render(
      <StepSequencerDrawer
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
      >
        <div data-testid="drawer-content">Content</div>
      </StepSequencerDrawer>,
    );

    const drawer = screen.getByTestId("kit-step-sequencer-drawer");
    expect(drawer).toBeInTheDocument();

    // Verify drawer is open (check for open drawer classes)
    expect(drawer.className).toMatch(/max-h-\[400px\]/);
    expect(drawer.className).toMatch(/opacity-100/);

    // Content should be visible in the open drawer
    expect(screen.getByTestId("drawer-content")).toBeInTheDocument();
  });

  it("toggles drawer state when handle is clicked", () => {
    render(
      <StepSequencerDrawer
        sequencerOpen={false}
        setSequencerOpen={setSequencerOpen}
      >
        <div>Content</div>
      </StepSequencerDrawer>,
    );

    const handle = screen.getByTestId("kit-step-sequencer-handle");
    fireEvent.click(handle);

    expect(setSequencerOpen).toHaveBeenCalledWith(true);

    // Reset and test from open state
    cleanup();
    setSequencerOpen.mockClear();

    render(
      <StepSequencerDrawer
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
      >
        <div>Content</div>
      </StepSequencerDrawer>,
    );

    const openHandle = screen.getByTestId("kit-step-sequencer-handle");
    fireEvent.click(openHandle);

    expect(setSequencerOpen).toHaveBeenCalledWith(false);
  });

  it("renders children inside the drawer", () => {
    const testContent = (
      <div data-testid="custom-content">Custom Drawer Content</div>
    );

    render(
      <StepSequencerDrawer
        sequencerOpen={true}
        setSequencerOpen={setSequencerOpen}
      >
        {testContent}
      </StepSequencerDrawer>,
    );

    expect(screen.getByTestId("custom-content")).toBeInTheDocument();
    expect(screen.getByText("Custom Drawer Content")).toBeInTheDocument();
  });
});

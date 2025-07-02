import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StepSequencerControls from "../StepSequencerControls";

describe("StepSequencerControls", () => {
  let isSeqPlaying;
  let setIsSeqPlaying;

  beforeEach(() => {
    isSeqPlaying = false;
    setIsSeqPlaying = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders play button when sequencer is stopped", () => {
    render(
      <StepSequencerControls
        isSeqPlaying={false}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const playButton = screen.getByRole("button");
    expect(playButton).toBeInTheDocument();
    expect(
      screen.getByTestId("kit-step-sequencer-controls"),
    ).toBeInTheDocument();

    // Verify it's the correct button by checking the data-testid
    expect(playButton).toHaveAttribute("data-testid", "play-step-sequencer");
  });

  it("renders stop button when sequencer is playing", () => {
    render(
      <StepSequencerControls
        isSeqPlaying={true}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const stopButton = screen.getByRole("button");
    expect(stopButton).toBeInTheDocument();

    // Verify it's the correct button by checking the data-testid
    expect(stopButton).toHaveAttribute("data-testid", "stop-step-sequencer");
  });

  it("calls setIsSeqPlaying when play button is clicked", () => {
    render(
      <StepSequencerControls
        isSeqPlaying={false}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const playButton = screen.getByRole("button");
    fireEvent.click(playButton);

    expect(setIsSeqPlaying).toHaveBeenCalledWith(true);
  });

  it("calls setIsSeqPlaying when stop button is clicked", () => {
    render(
      <StepSequencerControls
        isSeqPlaying={true}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const stopButton = screen.getByRole("button");
    fireEvent.click(stopButton);

    expect(setIsSeqPlaying).toHaveBeenCalledWith(false);
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StepSequencerControls from "../StepSequencerControls";

// Mock the useBpm hook
vi.mock("../hooks/shared/useBpm", () => ({
  useBpm: vi.fn(() => ({
    bpm: 120,
    isEditing: false,
    setBpm: vi.fn(),
    setIsEditing: vi.fn(),
    validateBpm: vi.fn((value) => value >= 30 && value <= 180),
  })),
}));

describe("StepSequencerControls", () => {
  let setIsSeqPlaying;

  beforeEach(() => {
    setIsSeqPlaying = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders play button when sequencer is stopped", () => {
    render(
      <StepSequencerControls
        bpm={120}
        isSeqPlaying={false}
        kitName="TestKit"
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const playButton = screen.getByTestId("play-step-sequencer");
    expect(playButton).toBeInTheDocument();
    expect(
      screen.getByTestId("kit-step-sequencer-controls"),
    ).toBeInTheDocument();
  });

  it("renders stop button when sequencer is playing", () => {
    render(
      <StepSequencerControls
        bpm={120}
        isSeqPlaying={true}
        kitName="TestKit"
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const stopButton = screen.getByTestId("stop-step-sequencer");
    expect(stopButton).toBeInTheDocument();
  });

  it("calls setIsSeqPlaying when play button is clicked", () => {
    render(
      <StepSequencerControls
        bpm={120}
        isSeqPlaying={false}
        kitName="TestKit"
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const playButton = screen.getByTestId("play-step-sequencer");
    fireEvent.click(playButton);

    expect(setIsSeqPlaying).toHaveBeenCalledWith(true);
  });

  it("calls setIsSeqPlaying when stop button is clicked", () => {
    render(
      <StepSequencerControls
        bpm={120}
        isSeqPlaying={true}
        kitName="TestKit"
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const stopButton = screen.getByTestId("stop-step-sequencer");
    fireEvent.click(stopButton);

    expect(setIsSeqPlaying).toHaveBeenCalledWith(false);
  });

  it("displays the current BPM value in input field", () => {
    render(
      <StepSequencerControls
        bpm={140}
        isSeqPlaying={false}
        kitName="TestKit"
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const bpmInput = screen.getByTestId("bpm-input");
    expect(bpmInput).toBeInTheDocument();
    expect(bpmInput).toHaveValue(120); // Mock returns 120
    expect(screen.getByText("BPM")).toBeInTheDocument();
    expect(screen.getByText("30-180")).toBeInTheDocument();
  });

  it("displays BPM input field with correct attributes", () => {
    render(
      <StepSequencerControls
        bpm={120}
        isSeqPlaying={false}
        kitName="TestKit"
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const bpmInput = screen.getByTestId("bpm-input");
    expect(bpmInput).toHaveAttribute("type", "number");
    expect(bpmInput).toHaveAttribute("min", "30");
    expect(bpmInput).toHaveAttribute("max", "180");
  });
});

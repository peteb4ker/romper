import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StepSequencerControls from "../StepSequencerControls";

describe("StepSequencerControls", () => {
  let setIsSeqPlaying;
  let mockBpmLogic;

  beforeEach(() => {
    setIsSeqPlaying = vi.fn();
    mockBpmLogic = {
      bpm: 120,
      isEditing: false,
      setBpm: vi.fn(),
      setIsEditing: vi.fn(),
      validateBpm: vi.fn((value) => value >= 30 && value <= 180),
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders play button when sequencer is stopped", () => {
    render(
      <StepSequencerControls
        bpmLogic={mockBpmLogic}
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
        bpmLogic={mockBpmLogic}
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
        bpmLogic={mockBpmLogic}
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
        bpmLogic={mockBpmLogic}
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
    const customBpmLogic = { ...mockBpmLogic, bpm: 140 };
    render(
      <StepSequencerControls
        bpmLogic={customBpmLogic}
        isSeqPlaying={false}
        kitName="TestKit"
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const bpmInput = screen.getByTestId("bpm-input");
    expect(bpmInput).toBeInTheDocument();
    expect(bpmInput).toHaveValue(140);
    expect(screen.getByText("BPM")).toBeInTheDocument();
    expect(screen.getByText("30-180")).toBeInTheDocument();
  });

  it("displays BPM input field with correct attributes", () => {
    render(
      <StepSequencerControls
        bpmLogic={mockBpmLogic}
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

  it("handles arrow key BPM changes", () => {
    mockBpmLogic.validateBpm.mockReturnValue(true);

    render(
      <StepSequencerControls
        bpmLogic={mockBpmLogic}
        isSeqPlaying={false}
        kitName="TestKit"
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const bpmInput = screen.getByTestId("bpm-input");

    // Test arrow up
    fireEvent.keyDown(bpmInput, { key: "ArrowUp" });
    expect(mockBpmLogic.setBpm).toHaveBeenCalledWith(121);

    // Test arrow down
    fireEvent.keyDown(bpmInput, { key: "ArrowDown" });
    expect(mockBpmLogic.setBpm).toHaveBeenCalledWith(119);
  });

  it("validates BPM range on arrow key changes", () => {
    mockBpmLogic.validateBpm.mockReturnValue(false);

    render(
      <StepSequencerControls
        bpmLogic={mockBpmLogic}
        isSeqPlaying={false}
        kitName="TestKit"
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const bpmInput = screen.getByTestId("bpm-input");

    // Test invalid BPM - should not call setBpm
    fireEvent.keyDown(bpmInput, { key: "ArrowUp" });
    expect(mockBpmLogic.setBpm).not.toHaveBeenCalled();
  });
});

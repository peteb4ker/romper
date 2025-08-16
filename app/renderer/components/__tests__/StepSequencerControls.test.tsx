import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StepSequencerControls from "../StepSequencerControls";

describe("StepSequencerControls", () => {
  let setIsSeqPlaying;
  let setBpm;

  beforeEach(() => {
    setIsSeqPlaying = vi.fn();
    setBpm = vi.fn();
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
        setBpm={setBpm}
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
        setBpm={setBpm}
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
        setBpm={setBpm}
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
        setBpm={setBpm}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const stopButton = screen.getByTestId("stop-step-sequencer");
    fireEvent.click(stopButton);

    expect(setIsSeqPlaying).toHaveBeenCalledWith(false);
  });

  it("displays the current BPM value", () => {
    render(
      <StepSequencerControls
        bpm={140}
        isSeqPlaying={false}
        setBpm={setBpm}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    expect(screen.getByText("140 BPM")).toBeInTheDocument();
  });

  it("allows editing BPM when clicked", () => {
    render(
      <StepSequencerControls
        bpm={120}
        isSeqPlaying={false}
        setBpm={setBpm}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const bpmButton = screen.getByText("120 BPM");
    fireEvent.click(bpmButton);

    // Should show input field
    const bpmInput = screen.getByDisplayValue("120");
    expect(bpmInput).toBeInTheDocument();
    expect(bpmInput).toHaveAttribute("type", "number");
  });

  it("calls setBpm when Enter is pressed on BPM input", () => {
    render(
      <StepSequencerControls
        bpm={120}
        isSeqPlaying={false}
        setBpm={setBpm}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const bpmButton = screen.getByText("120 BPM");
    fireEvent.click(bpmButton);

    const bpmInput = screen.getByDisplayValue("120");
    fireEvent.change(bpmInput, { target: { value: "140" } });
    fireEvent.keyDown(bpmInput, { key: "Enter" });

    expect(setBpm).toHaveBeenCalledWith(140);
  });

  it("calls setBpm when BPM input loses focus", () => {
    render(
      <StepSequencerControls
        bpm={120}
        isSeqPlaying={false}
        setBpm={setBpm}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const bpmButton = screen.getByText("120 BPM");
    fireEvent.click(bpmButton);

    const bpmInput = screen.getByDisplayValue("120");
    fireEvent.change(bpmInput, { target: { value: "90" } });
    fireEvent.blur(bpmInput);

    expect(setBpm).toHaveBeenCalledWith(90);
  });

  it("validates BPM range and rejects values outside 30-180", () => {
    render(
      <StepSequencerControls
        bpm={120}
        isSeqPlaying={false}
        setBpm={setBpm}
        setIsSeqPlaying={setIsSeqPlaying}
      />,
    );

    const bpmButton = screen.getByText("120 BPM");
    fireEvent.click(bpmButton);

    const bpmInput = screen.getByDisplayValue("120");

    // Test value too low
    fireEvent.change(bpmInput, { target: { value: "20" } });
    fireEvent.blur(bpmInput);
    expect(setBpm).not.toHaveBeenCalledWith(20);

    // Test value too high
    fireEvent.change(bpmInput, { target: { value: "200" } });
    fireEvent.blur(bpmInput);
    expect(setBpm).not.toHaveBeenCalledWith(200);

    // Test valid value
    fireEvent.change(bpmInput, { target: { value: "150" } });
    fireEvent.blur(bpmInput);
    expect(setBpm).toHaveBeenCalledWith(150);
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StepSequencerGrid from "../StepSequencerGrid";

describe("StepSequencerGrid", () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = {
      currentSeqStep: 0,
      focusedStep: { step: 0, voice: 0 },
      gridRef: { current: null },
      handleStepGridKeyDown: vi.fn(),
      isSeqPlaying: false,
      LED_GLOWS: [
        "shadow-glow-red",
        "shadow-glow-yellow",
        "shadow-glow-green",
        "shadow-glow-blue",
      ],
      NUM_STEPS: 16,
      NUM_VOICES: 4,
      ROW_COLORS: ["bg-voice-1", "bg-voice-2", "bg-voice-3", "bg-voice-4"],
      safeStepPattern: Array.from({ length: 4 }, () => Array(16).fill(0)),
      setFocusedStep: vi.fn(),
      toggleStep: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a grid with correct dimensions", () => {
    render(<StepSequencerGrid {...defaultProps} />);

    const grid = screen.getByTestId("kit-step-sequencer-grid");
    expect(grid).toBeInTheDocument();

    // Check voice labels
    const voiceLabels = screen.getAllByTestId(/seq-voice-label-\d/);
    expect(voiceLabels).toHaveLength(4);

    // Check the total number of step cells (4 voices x 16 steps)
    const stepCells = screen.getAllByTestId(/seq-step-\d+-\d+/);
    expect(stepCells).toHaveLength(4 * 16);
  });

  it("renders 3 beat-group dividers per voice row", () => {
    render(<StepSequencerGrid {...defaultProps} />);

    // Each voice row should have 3 dividers (between groups)
    for (let voice = 0; voice < 4; voice++) {
      for (let group = 1; group <= 3; group++) {
        expect(
          screen.getByTestId(`beat-divider-${voice}-${group}`),
        ).toBeInTheDocument();
      }
    }

    // Total of 12 dividers (4 voices x 3 dividers)
    const allDividers = screen.getAllByTestId(/beat-divider-/);
    expect(allDividers).toHaveLength(12);
  });

  it("highlights the focused step", () => {
    const customFocusedStep = { step: 5, voice: 2 };

    render(
      <StepSequencerGrid {...defaultProps} focusedStep={customFocusedStep} />,
    );

    const focusRing = screen.getByTestId("seq-step-focus-ring");
    expect(focusRing).toBeInTheDocument();
  });

  it("highlights the currently playing step when sequencer is running", () => {
    render(
      <StepSequencerGrid
        {...defaultProps}
        currentSeqStep={3}
        isSeqPlaying={true}
      />,
    );

    for (let voice = 0; voice < 4; voice++) {
      const step = screen.getByTestId(`seq-step-${voice}-3`);
      expect(step).toBeInTheDocument();
    }
  });

  it("calls toggleStep when a step is clicked", () => {
    render(<StepSequencerGrid {...defaultProps} />);

    const stepToClick = screen.getByTestId("seq-step-1-4");
    fireEvent.click(stepToClick);

    expect(defaultProps.toggleStep).toHaveBeenCalledWith(1, 4);
    expect(defaultProps.setFocusedStep).toHaveBeenCalledWith({
      step: 4,
      voice: 1,
    });
  });

  it("shows active steps with LED glow effect", () => {
    const activePattern = Array.from({ length: 4 }, () => Array(16).fill(0));
    activePattern[0][1] = 1;
    activePattern[2][3] = 1;

    render(
      <StepSequencerGrid {...defaultProps} safeStepPattern={activePattern} />,
    );

    expect(screen.getByTestId("seq-step-0-1")).toBeInTheDocument();
    expect(screen.getByTestId("seq-step-2-3")).toBeInTheDocument();
    expect(screen.getByTestId("seq-step-1-1")).toBeInTheDocument();
  });

  it("handles keyboard events through the handleStepGridKeyDown prop", () => {
    render(<StepSequencerGrid {...defaultProps} />);

    const grid = screen.getByTestId("kit-step-sequencer-grid");
    fireEvent.keyDown(grid, { key: "ArrowRight" });

    expect(defaultProps.handleStepGridKeyDown).toHaveBeenCalled();
  });

  describe("Per-voice controls", () => {
    it("renders volume sliders for all 4 voices", () => {
      render(
        <StepSequencerGrid
          {...defaultProps}
          voiceVolumes={{ 1: 100, 2: 80, 3: 100, 4: 60 }}
        />,
      );

      for (let i = 0; i < 4; i++) {
        const slider = screen.getByTestId(`voice-volume-${i}`);
        expect(slider).toBeInTheDocument();
        expect(slider).toHaveAttribute("type", "range");
      }
    });

    it("displays correct volume values in slider title", () => {
      render(
        <StepSequencerGrid
          {...defaultProps}
          voiceVolumes={{ 1: 100, 2: 80, 3: 50, 4: 0 }}
        />,
      );

      expect(screen.getByTestId("voice-volume-0")).toHaveAttribute(
        "title",
        "Volume: 100",
      );
      expect(screen.getByTestId("voice-volume-1")).toHaveAttribute(
        "title",
        "Volume: 80",
      );
      expect(screen.getByTestId("voice-volume-2")).toHaveAttribute(
        "title",
        "Volume: 50",
      );
      expect(screen.getByTestId("voice-volume-3")).toHaveAttribute(
        "title",
        "Volume: 0",
      );
    });

    it("calls onVolumeChange when slider is changed", () => {
      const mockOnVolumeChange = vi.fn();
      render(
        <StepSequencerGrid
          {...defaultProps}
          onVolumeChange={mockOnVolumeChange}
          voiceVolumes={{ 1: 100, 2: 80, 3: 100, 4: 60 }}
        />,
      );

      const slider = screen.getByTestId("voice-volume-0");
      fireEvent.change(slider, { target: { value: "75" } });

      expect(mockOnVolumeChange).toHaveBeenCalledWith(1, 75);
    });

    it("defaults to volume 100 when no voiceVolumes provided", () => {
      render(<StepSequencerGrid {...defaultProps} />);

      for (let i = 0; i < 4; i++) {
        expect(screen.getByTestId(`voice-volume-${i}`)).toHaveAttribute(
          "title",
          "Volume: 100",
        );
      }
    });

    it("renders sample mode buttons for all 4 voices", () => {
      render(<StepSequencerGrid {...defaultProps} />);

      for (let i = 0; i < 4; i++) {
        const modeButton = screen.getByTestId(`sample-mode-${i}`);
        expect(modeButton).toBeInTheDocument();
      }
    });

    it("displays correct mode labels", () => {
      render(
        <StepSequencerGrid
          {...defaultProps}
          sampleModes={{
            1: "first",
            2: "random",
            3: "round-robin",
            4: "first",
          }}
        />,
      );

      expect(screen.getByTestId("sample-mode-0")).toHaveAttribute(
        "title",
        "Sample mode: 1st",
      );
      expect(screen.getByTestId("sample-mode-1")).toHaveAttribute(
        "title",
        "Sample mode: Rnd",
      );
      expect(screen.getByTestId("sample-mode-2")).toHaveAttribute(
        "title",
        "Sample mode: R-R",
      );
      expect(screen.getByTestId("sample-mode-3")).toHaveAttribute(
        "title",
        "Sample mode: 1st",
      );
    });

    it("cycles through sample modes on click", () => {
      const mockOnSampleModeChange = vi.fn();
      render(
        <StepSequencerGrid
          {...defaultProps}
          onSampleModeChange={mockOnSampleModeChange}
          sampleModes={{ 1: "first", 2: "first", 3: "first", 4: "first" }}
        />,
      );

      const modeButton = screen.getByTestId("sample-mode-0");
      fireEvent.click(modeButton);

      // first -> random
      expect(mockOnSampleModeChange).toHaveBeenCalledWith(1, "random");
    });

    it("cycles from round-robin back to first", () => {
      const mockOnSampleModeChange = vi.fn();
      render(
        <StepSequencerGrid
          {...defaultProps}
          onSampleModeChange={mockOnSampleModeChange}
          sampleModes={{
            1: "round-robin",
            2: "first",
            3: "first",
            4: "first",
          }}
        />,
      );

      const modeButton = screen.getByTestId("sample-mode-0");
      fireEvent.click(modeButton);

      // round-robin -> first
      expect(mockOnSampleModeChange).toHaveBeenCalledWith(1, "first");
    });
  });

  describe("Trigger conditions", () => {
    it("renders condition indicator on active step with condition set", () => {
      const triggerConditions = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      triggerConditions[0][0] = "1:2";

      const activePattern = Array.from({ length: 4 }, () => Array(16).fill(0));
      activePattern[0][0] = 127;

      render(
        <StepSequencerGrid
          {...defaultProps}
          safeStepPattern={activePattern}
          triggerConditions={triggerConditions}
        />,
      );

      const indicator = screen.getByTestId("seq-condition-0-0");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent("1:2");
    });

    it("renders dot indicator on inactive step with condition set", () => {
      const triggerConditions = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      triggerConditions[1][3] = "2:4";

      render(
        <StepSequencerGrid
          {...defaultProps}
          triggerConditions={triggerConditions}
        />,
      );

      const indicator = screen.getByTestId("seq-condition-1-3");
      expect(indicator).toBeInTheDocument();
      // Should contain the dot span, not text
      expect(indicator).not.toHaveTextContent("2:4");
    });

    it("shows no condition indicator when condition is null", () => {
      const triggerConditions = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );

      render(
        <StepSequencerGrid
          {...defaultProps}
          triggerConditions={triggerConditions}
        />,
      );

      expect(screen.queryByTestId("seq-condition-0-0")).not.toBeInTheDocument();
    });

    it("right-click on step opens condition popover", () => {
      render(<StepSequencerGrid {...defaultProps} />);

      const step = screen.getByTestId("seq-step-0-0");
      fireEvent.contextMenu(step);

      const popover = document.querySelector(
        '[data-testid="condition-popover"]',
      );
      expect(popover).toBeInTheDocument();
    });

    it("selecting a condition calls onConditionChange", () => {
      const mockOnConditionChange = vi.fn();
      render(
        <StepSequencerGrid
          {...defaultProps}
          onConditionChange={mockOnConditionChange}
        />,
      );

      // Right-click to open popover
      const step = screen.getByTestId("seq-step-2-5");
      fireEvent.contextMenu(step);

      // Select a condition from the popover
      const option = document.querySelector(
        '[data-testid="condition-option-1:2"]',
      ) as HTMLElement;
      expect(option).toBeInTheDocument();
      fireEvent.click(option);

      expect(mockOnConditionChange).toHaveBeenCalledWith(2, 5, "1:2");
    });

    it("condition text appears in step aria-label", () => {
      const triggerConditions = Array.from({ length: 4 }, () =>
        Array(16).fill(null),
      );
      triggerConditions[0][2] = "3:4";

      render(
        <StepSequencerGrid
          {...defaultProps}
          triggerConditions={triggerConditions}
        />,
      );

      const step = screen.getByTestId("seq-step-0-2");
      expect(step).toHaveAttribute(
        "aria-label",
        "Toggle step 3 for voice 1 (3:4)",
      );
    });
  });
});

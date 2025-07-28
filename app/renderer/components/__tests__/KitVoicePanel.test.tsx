import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useKitVoicePanels } from "../hooks/useKitVoicePanels";
import KitVoicePanel from "../KitVoicePanel";
import { MockMessageDisplayProvider } from "./MockMessageDisplayProvider";
import { MockSettingsProvider } from "./MockSettingsProvider";

const baseProps = {
  voice: 1,
  samples: ["kick.wav", "snare.wav", "hat.wav"],
  voiceName: "Kick",
  onSaveVoiceName: vi.fn(),
  onRescanVoiceName: vi.fn(),
  samplePlaying: {},
  playTriggers: {},
  stopTriggers: {},
  onPlay: vi.fn(),
  onStop: vi.fn(),
  onWaveformPlayingChange: vi.fn(),
  kitName: "Kit1",
};

const controlledProps = {
  ...baseProps,
  selectedIdx: 0,
  onSampleKeyNav: vi.fn(),
  onSampleSelect: vi.fn(),
  isActive: true,
};

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

// Reusable TestWrapper for single-voice tests
function SingleVoiceTestWrapper({
  initialSelectedIdx = 0,
  onPlay = vi.fn(),
  samples = ["kick.wav", "snare.wav", "hat.wav"],
  ...props
} = {}) {
  const [selectedIdx, setSelectedIdx] = useState(initialSelectedIdx);
  React.useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (["ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        if (e.key === "ArrowDown")
          setSelectedIdx((idx) => Math.min(idx + 1, samples.length - 1));
        else if (e.key === "ArrowUp")
          setSelectedIdx((idx) => Math.max(idx - 1, 0));
        else if (e.key === " " || e.key === "Enter")
          onPlay(1, samples[selectedIdx]);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedIdx, samples, onPlay]);
  return (
    <MockSettingsProvider>
      <MockMessageDisplayProvider>
        <KitVoicePanel
          {...baseProps}
          samples={samples}
          selectedIdx={selectedIdx}
          onSampleKeyNav={vi.fn()}
          onSampleSelect={(_, idx) => setSelectedIdx(idx)}
          onPlay={onPlay}
          isActive={true}
          {...props}
        />
      </MockMessageDisplayProvider>
    </MockSettingsProvider>
  );
}

describe("KitVoicePanel", () => {
  it("renders all sample slots", () => {
    render(
      <MockSettingsProvider>
        <MockMessageDisplayProvider>
          <KitVoicePanel {...controlledProps} />
        </MockMessageDisplayProvider>
      </MockSettingsProvider>,
    );
    expect(screen.getByText("kick.wav")).toBeInTheDocument();
    expect(screen.getByText("snare.wav")).toBeInTheDocument();
    expect(screen.getByText("hat.wav")).toBeInTheDocument();
  });

  it("moves selection and previews sample with keyboard", async () => {
    render(<SingleVoiceTestWrapper />);
    // Down arrow to snare.wav
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    expect(
      screen.getAllByTestId("sample-selected-voice-1")[0],
    ).toHaveTextContent("snare.wav");
    // Up arrow to kick.wav
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowUp" });
    });
    expect(
      screen.getAllByTestId("sample-selected-voice-1")[0],
    ).toHaveTextContent("kick.wav");
  });

  it("shows visible focus indicator for selected sample", () => {
    render(
      <MockSettingsProvider>
        <MockMessageDisplayProvider>
          <KitVoicePanel {...controlledProps} />
        </MockMessageDisplayProvider>
      </MockSettingsProvider>,
    );
    const lists = screen.getAllByTestId("sample-list-voice-1");
    const list = lists[0];
    list.focus();
    const selected = screen.getAllByTestId("sample-selected-voice-1");
    expect(selected[0].className).toMatch(/ring-2|bg-blue/);
  });

  it("updates selection when a sample slot is clicked", async () => {
    render(<SingleVoiceTestWrapper />);
    const slots = screen.getAllByRole("listitem");
    await act(async () => {
      fireEvent.click(slots[1]);
    });
    expect(
      screen.getAllByTestId("sample-selected-voice-1")[0],
    ).toHaveTextContent("snare.wav");
  });

  it("triggers onPlay when space/enter is pressed on selected sample (keyboard preview navigation)", async () => {
    const onPlay = vi.fn();
    render(<SingleVoiceTestWrapper onPlay={onPlay} />);
    // Preview first sample (kick.wav) with space
    await act(async () => {
      fireEvent.keyDown(window, { key: " " });
    });
    expect(onPlay).toHaveBeenCalledWith(1, "kick.wav");
    onPlay.mockClear();
    // Move to snare.wav and preview with Enter
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    await waitFor(() => {
      expect(
        screen.getAllByTestId("sample-selected-voice-1")[0],
      ).toHaveTextContent("snare.wav");
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });
    expect(onPlay).toHaveBeenCalledWith(1, "snare.wav");
  });

  it("renders slot number indicator for each sample, visually distinct and not part of sample name", () => {
    const samples = ["1kick.wav", "2snare.wav", "hat.wav"];
    render(
      <MockSettingsProvider>
        <MockMessageDisplayProvider>
          <KitVoicePanel {...controlledProps} samples={samples} />
        </MockMessageDisplayProvider>
      </MockSettingsProvider>,
    );
    samples.forEach((sample, i) => {
      // Slot number indicator is always present, visually distinct, and not part of sample name
      const slotNumber = screen.getAllByText(`${i + 1}.`)[0];
      expect(slotNumber).toBeInTheDocument();
      expect(slotNumber.className).toMatch(/text-xs/);
      expect(slotNumber.className).toMatch(/font-mono/);
      expect(slotNumber.className).toMatch(/text-gray-500/);
      // The sample name is rendered separately
      const sampleName = screen.getByText(sample);
      expect(sampleName).toBeInTheDocument();
      // Slot number and sample name are not concatenated
      expect(sampleName.textContent).toBe(sample);
    });
  });

  it("slot number indicator uses accessible color classes for light and dark mode", () => {
    render(
      <MockSettingsProvider>
        <MockMessageDisplayProvider>
          <KitVoicePanel {...controlledProps} />
        </MockMessageDisplayProvider>
      </MockSettingsProvider>,
    );
    // Check slot number indicator for first sample
    const slotNumber = screen.getAllByText("1.")[0];
    expect(slotNumber.className).toMatch(/text-gray-500/);
    expect(slotNumber.className).toMatch(/dark:text-gray-400/);
    // Should be visually distinct (font-mono, px-1, select-none)
    expect(slotNumber.className).toMatch(/font-mono/);
    expect(slotNumber.className).toMatch(/px-1/);
    expect(slotNumber.className).toMatch(/select-none/);
  });

  it("slot number indicator takes up uniform space for alignment", () => {
    const samples = ["1kick.wav", "2snare.wav", "hat.wav"];
    render(
      <MockSettingsProvider>
        <MockMessageDisplayProvider>
          <KitVoicePanel {...controlledProps} samples={samples} />
        </MockMessageDisplayProvider>
      </MockSettingsProvider>,
    );
    // All slot number indicators should have the same computed width
    const slotNumbers = samples.map((_, i) =>
      screen.getByTestId(`slot-number-1-${i}`),
    );
    const widths = slotNumbers.map(
      (el) => el.style.minWidth || el.getAttribute("style"),
    );
    // All should be set to 32px
    widths.forEach((w) => {
      expect(w).toMatch(/32px/);
    });
    // All should have display: inline-block
    slotNumbers.forEach((el) => {
      expect(el.className).toMatch(/inline-block/);
    });
  });

  it("renders exactly 12 slots, with empty slots for unassigned samples (1.16)", () => {
    render(
      <MockSettingsProvider>
        <MockMessageDisplayProvider>
          <KitVoicePanel
            {...controlledProps}
            samples={["kick.wav", "snare.wav"]}
          />
        </MockMessageDisplayProvider>
      </MockSettingsProvider>,
    );
    // Should always render 12 list items
    const slots = screen.getAllByRole("listitem");
    expect(slots).toHaveLength(12);
    // The first two are filled, the rest are empty
    expect(screen.getByText("kick.wav")).toBeInTheDocument();
    expect(screen.getByText("snare.wav")).toBeInTheDocument();
    // Check for empty slot labels
    for (let i = 2; i < 12; i++) {
      expect(screen.getByTestId(`empty-slot-1-${i}`)).toBeInTheDocument();
      expect(screen.getByTestId(`slot-number-1-${i}`)).toHaveTextContent(
        `${i + 1}.`,
      );
    }
  });

  it("empty slots have the same min-height as filled slots (1.16.1)", () => {
    render(
      <MockSettingsProvider>
        <MockMessageDisplayProvider>
          <KitVoicePanel {...controlledProps} samples={["kick.wav"]} />
        </MockMessageDisplayProvider>
      </MockSettingsProvider>,
    );
    const slots = screen.getAllByRole("listitem");
    // All slots (filled and empty) should have the same min-h-[28px] class
    slots.forEach((slot) => {
      expect(slot.className).toMatch(/min-h-\[28px\]/);
    });
  });
});

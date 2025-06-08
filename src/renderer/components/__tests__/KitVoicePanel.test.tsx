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
  sdCardPath: "/fake/path",
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
  );
}

describe("KitVoicePanel", () => {
  it("renders all sample slots", () => {
    render(
      <MockMessageDisplayProvider>
        <KitVoicePanel {...controlledProps} />
      </MockMessageDisplayProvider>,
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
      <MockMessageDisplayProvider>
        <KitVoicePanel {...controlledProps} />
      </MockMessageDisplayProvider>,
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
});

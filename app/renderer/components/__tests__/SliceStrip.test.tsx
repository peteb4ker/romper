import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { applyTheme } from "../../utils/appliedTheme";
import { getSharedAudioContext } from "../../utils/sharedAudioContext";
import SliceStrip, { sliceHint, type SliceStripProps } from "../SliceStrip";

// The strip decodes in the shared context, through the sample audio cache
vi.mock("../../utils/sharedAudioContext", () => ({
  getSharedAudioContext: vi.fn(),
}));

// jsdom has no PointerEvent; without it pointer events lose button/clientX
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(
    type: string,
    init: { pointerId?: number } & MouseEventInit = {},
  ) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}
if (!globalThis.PointerEvent) {
  globalThis.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
}

function renderStrip(overrides: Partial<SliceStripProps> = {}) {
  const props = stripProps(overrides);
  render(<SliceStrip {...props} />);
  return props;
}

function stripProps(overrides: Partial<SliceStripProps> = {}): SliceStripProps {
  return {
    canUndo: false,
    division: 16,
    editingVoice: 1,
    hoverView: null,
    kitName: "A0",
    notice: null,
    onAssign: vi.fn(),
    onAudition: vi.fn(),
    onClose: vi.fn(),
    onDivisionChange: vi.fn(),
    onRoll: vi.fn(),
    onSelectVoice: vi.fn(),
    onSettingsChange: vi.fn(),
    onUndo: vi.fn(),
    playingView: null,
    sampleName: "break.wav",
    sampleSource: "/samples/break.wav",
    selectedStep: null,
    selectedStepRandom: false,
    selectedView: null,
    settings: {
      enabled: true,
      maxLength: 2,
      rollAmount: 100,
      varyLength: false,
    },
    sliceVoices: [1],
    slotIndex: 0,
    usedSlices: new Set<number>(),
    voiceLabel: "1",
    ...overrides,
  };
}

describe("SliceStrip", () => {
  beforeEach(() => {
    setupElectronAPIMock();
  });

  it("draws one slice cell per division with sparse labels at high divisions", () => {
    renderStrip({ division: 64 });
    expect(screen.getAllByRole("button", { name: /^Slice \d+$/ })).toHaveLength(
      64,
    );
    // Every 4th slice is labelled at /64
    const labels = screen.getByTestId("slice-labels");
    expect(labels.children[4]).toHaveTextContent("5");
    expect(labels.children[1]).toHaveTextContent("");
  });

  it("shows the sample being sliced and its slot", () => {
    renderStrip({ sampleName: "amen.wav", slotIndex: 2 });
    expect(screen.getByTestId("slice-strip-sample")).toHaveTextContent(
      "amen.wav (slot 3)",
    );
  });

  it("assigns a slice with the keyboard, keeping the current length", () => {
    const props = renderStrip({
      selectedStep: 2,
      selectedView: { lengthSlices: 3, startSlice: 0 },
    });
    fireEvent.click(screen.getByTestId("slice-7"));
    expect(props.onAssign).toHaveBeenCalledWith(7, 3);
  });

  it("assigns a dragged span of slices", () => {
    const props = renderStrip({ selectedStep: 0 });
    const area = screen.getByTestId("slice-waveform");
    area.getBoundingClientRect = () => ({ left: 0, width: 160 }) as DOMRect; // 10px per slice at /16

    fireEvent.pointerDown(area, { button: 0, clientX: 45, pointerId: 1 });
    fireEvent.pointerMove(area, { clientX: 25, pointerId: 1 });
    fireEvent.pointerUp(area, { pointerId: 1 });

    expect(props.onAssign).toHaveBeenCalledWith(2, 3);
  });

  it("auditions without assigning on Alt-click", () => {
    const props = renderStrip({ selectedStep: 0 });
    const area = screen.getByTestId("slice-waveform");
    area.getBoundingClientRect = () => ({ left: 0, width: 160 }) as DOMRect;

    fireEvent.pointerDown(area, {
      altKey: true,
      button: 0,
      clientX: 95,
      pointerId: 1,
    });
    fireEvent.pointerUp(area, { pointerId: 1 });

    expect(props.onAudition).toHaveBeenCalledWith(9, 1);
    expect(props.onAssign).not.toHaveBeenCalled();
  });

  it("highlights the selected, hovered, and playing slices", () => {
    renderStrip({
      hoverView: { lengthSlices: 1, startSlice: 8 },
      playingView: { lengthSlices: 1, startSlice: 12 },
      selectedStep: 0,
      selectedView: { lengthSlices: 2, startSlice: 4 },
    });
    expect(screen.getByTestId("slice-selected")).toHaveStyle({
      left: "25%",
      width: "12.5%",
    });
    expect(screen.getByTestId("slice-hover")).toHaveStyle({ left: "50%" });
    expect(screen.getByTestId("slice-playing")).toHaveStyle({ left: "75%" });
  });

  it("wires the division, roll, undo and roll settings controls", () => {
    const props = renderStrip({ canUndo: true });

    fireEvent.change(screen.getByTestId("slice-division"), {
      target: { value: "32" },
    });
    expect(props.onDivisionChange).toHaveBeenCalledWith(32);

    fireEvent.click(screen.getByTestId("slice-roll"));
    expect(props.onRoll).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("slice-undo-roll"));
    expect(props.onUndo).toHaveBeenCalled();

    // Roll settings live behind the menu next to Roll
    expect(screen.queryByTestId("slice-roll-amount")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("slice-roll-options"));
    fireEvent.change(screen.getByTestId("slice-roll-amount"), {
      target: { value: "25" },
    });
    expect(props.onSettingsChange).toHaveBeenCalledWith({ rollAmount: 25 });

    fireEvent.click(screen.getByTestId("slice-vary-length"));
    expect(props.onSettingsChange).toHaveBeenCalledWith({ varyLength: true });
  });

  it("disables undo until the next undo is a sequencer edit", () => {
    renderStrip({ canUndo: false });
    expect(screen.getByTestId("slice-undo-roll")).toBeDisabled();
  });

  it("offers voice tabs when several voices are sliced", () => {
    const props = renderStrip({ sliceVoices: [1, 3] });
    fireEvent.click(screen.getByTestId("slice-voice-tab-3"));
    expect(props.onSelectVoice).toHaveBeenCalledWith(3);
  });

  it("shows a notice in place of the hint when there is one", () => {
    renderStrip({ notice: "Nothing to roll" });
    expect(screen.getByTestId("slice-hint")).toHaveTextContent(
      "Nothing to roll",
    );
  });
});

describe("SliceStrip waveform", () => {
  let api: ReturnType<typeof setupElectronAPIMock>;
  const fillRect = vi.fn();

  beforeEach(() => {
    api = setupElectronAPIMock();
    fillRect.mockClear();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      fillRect,
      fillStyle: "",
      globalAlpha: 1,
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    const samples = new Float32Array(2048).map((_, i) => Math.sin(i / 10));
    vi.mocked(getSharedAudioContext).mockReturnValue({
      decodeAudioData: vi.fn().mockResolvedValue({
        getChannelData: () => samples,
        length: samples.length,
        numberOfChannels: 1,
      }),
    } as unknown as AudioContext);
  });

  it("loads the displayed slot, draws it, and reuses the decoded peaks", async () => {
    vi.mocked(api.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(8), version: "v1" },
      success: true,
    });
    const props = { slotIndex: 0 };
    const { rerender } = render(<SliceStrip {...stripProps({ ...props })} />);
    await waitFor(() => expect(fillRect).toHaveBeenCalled());
    expect(api.getSampleAudioBuffer).toHaveBeenCalledWith(
      "A0",
      1,
      0,
      undefined,
    );

    // Switch away and back: the second visit comes from the cache
    rerender(<SliceStrip {...stripProps({ slotIndex: null })} />);
    rerender(<SliceStrip {...stripProps({ slotIndex: 0 })} />);
    expect(api.getSampleAudioBuffer).toHaveBeenCalledTimes(1);
  });

  it("[UC-33] loads the file that moves up into the slot (#575)", async () => {
    // Each answer is another file, so another version
    let answers = 0;
    vi.mocked(api.getSampleAudioBuffer).mockImplementation(async () => ({
      data: { bytes: new ArrayBuffer(8), version: `v${++answers}` },
      success: true,
    }));
    const shown = (sampleName: string, sampleSource: string) =>
      stripProps({ sampleName, sampleSource, slotIndex: 0 });
    const { rerender } = render(
      <SliceStrip {...shown("break.wav", "/a/break.wav")} />,
    );
    await waitFor(() => expect(fillRect).toHaveBeenCalled());

    // The voice's first sample is deleted beside the open strip, and the
    // next one, with the same name, moves up into slot 1
    fillRect.mockClear();
    rerender(<SliceStrip {...shown("break.wav", "/b/break.wav")} />);
    await waitFor(() => expect(fillRect).toHaveBeenCalled());
    expect(api.getSampleAudioBuffer).toHaveBeenCalledTimes(2);
    // It offers main the audio it holds for the slot; main sends the new file
    expect(api.getSampleAudioBuffer).toHaveBeenLastCalledWith("A0", 1, 0, "v1");

    // The deleted file's peaks were dropped, not kept for the slot
    rerender(<SliceStrip {...shown("break.wav", "/a/break.wav")} />);
    await waitFor(() =>
      expect(api.getSampleAudioBuffer).toHaveBeenCalledTimes(3),
    );
  });

  it("doesn't reuse peaks while it's unknown which file they're from", async () => {
    vi.mocked(api.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(8), version: "v1" },
      success: true,
    });
    const unknown = { sampleSource: null, slotIndex: 0 };
    const { rerender } = render(<SliceStrip {...stripProps(unknown)} />);
    await waitFor(() => expect(fillRect).toHaveBeenCalled());
    rerender(<SliceStrip {...stripProps({ slotIndex: null })} />);
    rerender(<SliceStrip {...stripProps(unknown)} />);
    await waitFor(() =>
      expect(api.getSampleAudioBuffer).toHaveBeenCalledTimes(2),
    );
  });

  it("warns and draws nothing when the sample can't be decoded", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(api.getSampleAudioBuffer).mockRejectedValue(new Error("missing"));
    render(<SliceStrip {...stripProps({ slotIndex: 1 })} />);
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(fillRect).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignores failed loads", async () => {
    vi.mocked(api.getSampleAudioBuffer).mockResolvedValue({
      error: "no",
      success: false,
    });
    render(<SliceStrip {...stripProps({ slotIndex: 2 })} />);
    await waitFor(() => expect(api.getSampleAudioBuffer).toHaveBeenCalled());
    expect(fillRect).not.toHaveBeenCalled();
  });

  it("[UC-29] draws again in the new theme's voice color (#760)", async () => {
    applyTheme(false);
    const getComputedStyleSpy = vi
      .spyOn(globalThis, "getComputedStyle")
      .mockImplementation(
        () =>
          ({
            getPropertyValue: (name: string) =>
              name === "--voice-1" &&
              document.documentElement.classList.contains("dark")
                ? "#e05a60"
                : "#d44950",
          }) as CSSStyleDeclaration,
      );
    const canvas = {
      clearRect: vi.fn(),
      fillRect,
      fillStyle: "",
      globalAlpha: 1,
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => canvas,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    vi.mocked(api.getSampleAudioBuffer).mockResolvedValue({
      data: { bytes: new ArrayBuffer(8), version: "v1" },
      success: true,
    });
    render(<SliceStrip {...stripProps({ kitName: "T760", slotIndex: 0 })} />);
    await waitFor(() => expect(fillRect).toHaveBeenCalled());
    expect(canvas.fillStyle).toBe("#d44950");
    fillRect.mockClear();

    act(() => {
      applyTheme(true);
    });

    expect(fillRect).toHaveBeenCalled();
    expect(canvas.fillStyle).toBe("#e05a60");
    getComputedStyleSpy.mockRestore();
    applyTheme(false);
  });
});

describe("sliceHint", () => {
  const base = {
    sampleName: "break.wav",
    selectedStep: null,
    selectedStepRandom: false,
    selectedView: null,
    voiceLabel: "1",
  };

  it("asks for a sample when the voice is empty", () => {
    expect(sliceHint({ ...base, sampleName: null })).toMatch(/no sample/);
  });

  it("explains the first move when nothing is selected", () => {
    expect(sliceHint(base)).toMatch(/Click a step/);
  });

  it("describes the selected step's slice span", () => {
    expect(
      sliceHint({
        ...base,
        selectedStep: 2,
        selectedView: { lengthSlices: 2, startSlice: 4 },
      }),
    ).toMatch(/Step 3 plays slices 5–6/);
  });

  it("describes live-random steps", () => {
    expect(
      sliceHint({
        ...base,
        selectedStep: 0,
        selectedStepRandom: true,
        selectedView: { lengthSlices: 1, startSlice: 0 },
      }),
    ).toMatch(/random slice each time/);
  });
});

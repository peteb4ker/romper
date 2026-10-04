import type { SliceStep } from "@romper/shared/sliceTypes";

import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FocusedStep } from "../../shared/stepPatternConstants";
import type { SequenceEditMeta } from "../useSequenceHistory";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import {
  createEmptySliceSteps,
  makeSliceStep,
  toSliceView,
} from "../../shared/sliceConstants";
import {
  displayedSlotIndex,
  type SlicerVoiceData,
  sliceSettingNotSaved,
  useSlicerEditor,
  useVoiceSliceSettings,
} from "../useSlicerEditor";

type Grid = (null | SliceStep)[][];

const emptyPattern = () =>
  Array.from({ length: 4 }, () => new Array(16).fill(0));

interface HarnessOptions {
  isSeqPlaying?: boolean;
  pattern?: number[][];
  samples?: { [voice: number]: string[] };
  voices?: SlicerVoiceData[];
}

/** Wires the editor to real state so interactions behave as in the app. */
function useHarness(options: HarnessOptions, onPlaySample: () => void) {
  const [sliceSteps, setGrid] = React.useState<Grid>(createEmptySliceSteps);
  // How each edit would appear in the undo history
  const edits = React.useRef<(SequenceEditMeta | undefined)[]>([]);
  const setSliceSteps = React.useCallback(
    (update: ((prev: Grid) => Grid) | Grid, meta?: SequenceEditMeta) => {
      edits.current.push(meta);
      setGrid((prev) => (typeof update === "function" ? update(prev) : update));
    },
    [],
  );
  const [pattern, setPattern] = React.useState(
    options.pattern ?? emptyPattern(),
  );
  const toggleStep = React.useCallback((v: number, s: number) => {
    setPattern((prev) =>
      prev.map((row, vi) =>
        vi === v ? row.map((x, si) => (si === s ? (x > 0 ? 0 : 127) : x)) : row,
      ),
    );
  }, []);
  const [focusedStep, setFocusedStep] = React.useState<FocusedStep>({
    step: 0,
    voice: 0,
  });
  const { sliceSettings, updateSliceSettings } = useVoiceSliceSettings(
    "A0",
    options.voices,
  );
  const editor = useSlicerEditor({
    focusedStep,
    isSeqPlaying: options.isSeqPlaying ?? false,
    kitName: "A0",
    onPlaySample,
    samples: options.samples ?? { 1: ["break.wav"], 2: [], 3: [], 4: [] },
    setFocusedStep,
    setSliceSteps,
    slicerDivision: 16,
    sliceSettings,
    sliceSteps,
    stepPattern: pattern,
    toggleStep,
    updateSliceSettings,
    voiceVolumes: { 1: 90 },
  });
  return {
    editor,
    edits: edits.current,
    pattern,
    setFocusedStep,
    sliceSettings,
    sliceSteps,
  };
}

// Voice data arrays are hoisted: kit data is stable between renders in the app
const voice3Settings: SlicerVoiceData[] = [
  {
    slice_enabled: true,
    slice_max_length: 4,
    slice_roll_amount: 50,
    slice_vary_length: true,
    voice_number: 3,
  },
];

const voice1Sliced: SlicerVoiceData[] = [
  { slice_enabled: true, voice_number: 1 },
];

function key(
  keyName: string,
  mods: Partial<Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey">> = {},
) {
  return {
    altKey: false,
    ctrlKey: false,
    key: keyName,
    metaKey: false,
    shiftKey: false,
    stopPropagation: vi.fn(),
    ...mods,
  } as unknown as React.KeyboardEvent<HTMLDivElement>;
}

function patternWith(steps: number[]): number[][] {
  const p = emptyPattern();
  for (const s of steps) p[0][s] = 127;
  return p;
}

describe("[UC-33] useSlicerEditor", () => {
  let api: ReturnType<typeof setupElectronAPIMock>;
  let onPlaySample: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = setupElectronAPIMock();
    onPlaySample = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("slice mode toggle", () => {
    it("turns slice mode on, persists it, and edits that voice", () => {
      const { result } = renderHook(() => useHarness({}, onPlaySample));
      expect(result.current.editor.editingVoice).toBeNull();

      act(() => result.current.editor.handleSliceToggle(1));

      expect(result.current.sliceSettings[1].enabled).toBe(true);
      expect(api.updateVoiceSliceSettings).toHaveBeenCalledWith("A0", 1, {
        enabled: true,
      });
      expect(result.current.editor.editingVoice).toBe(1);
      expect(result.current.editor.sliceVoices).toEqual([1]);
    });

    it("loads slice settings from voice data", () => {
      const { result } = renderHook(() =>
        useHarness({ voices: voice3Settings }, onPlaySample),
      );
      expect(result.current.sliceSettings[3]).toEqual({
        enabled: true,
        maxLength: 4,
        rollAmount: 50,
        varyLength: true,
      });
      expect(result.current.editor.editingVoice).toBe(3);
    });
  });

  describe("closing the editor", () => {
    it("hides the strip but leaves every sliced voice in slice mode", () => {
      const { result } = renderHook(() =>
        useHarness({ voices: voice1Sliced }, onPlaySample),
      );
      act(() => result.current.editor.handleSliceToggle(2));
      act(() => result.current.editor.handleStepClick(1, 4));
      expect(result.current.editor.editorOpen).toBe(true);

      act(() => result.current.editor.closeEditor());

      expect(result.current.editor.editorOpen).toBe(false);
      expect(result.current.editor.selectedStep).toBeNull();
      // Slice mode (what playback reads) is untouched for both voices
      expect(result.current.sliceSettings[1].enabled).toBe(true);
      expect(result.current.sliceSettings[2].enabled).toBe(true);
      expect(api.updateVoiceSliceSettings).not.toHaveBeenCalledWith(
        "A0",
        expect.any(Number),
        { enabled: false },
      );
    });

    it("reopens when a step on a sliced row is clicked", () => {
      const { result } = renderHook(() =>
        useHarness({ voices: voice1Sliced }, onPlaySample),
      );
      act(() => result.current.editor.closeEditor());

      act(() => result.current.editor.handleStepClick(0, 3));

      expect(result.current.editor.editorOpen).toBe(true);
      expect(result.current.editor.editingVoice).toBe(1);
      expect(result.current.editor.selectedStep).toBe(3);
    });

    it("stays closed while clicking steps on rows that aren't sliced", () => {
      const { result } = renderHook(() =>
        useHarness({ voices: voice1Sliced }, onPlaySample),
      );
      act(() => result.current.editor.closeEditor());

      act(() => result.current.editor.handleStepClick(1, 3));

      expect(result.current.editor.editorOpen).toBe(false);
    });

    it("reopens on the voice whose slice mode is turned on", () => {
      const { result } = renderHook(() =>
        useHarness({ voices: voice1Sliced }, onPlaySample),
      );
      act(() => result.current.editor.closeEditor());

      act(() => result.current.editor.handleSliceToggle(2));

      expect(result.current.editor.editorOpen).toBe(true);
      expect(result.current.editor.editingVoice).toBe(2);
    });
  });

  describe("step clicks", () => {
    it("toggles steps on rows that are not sliced", () => {
      const { result } = renderHook(() => useHarness({}, onPlaySample));
      act(() => result.current.editor.handleStepClick(1, 3));
      expect(result.current.pattern[1][3]).toBe(127);
    });

    it("on a slice row: turns an off step on and selects it", () => {
      const { result } = renderHook(() =>
        useHarness({ voices: voice1Sliced }, onPlaySample),
      );
      act(() => result.current.editor.handleStepClick(0, 5));
      expect(result.current.pattern[0][5]).toBe(127);
      expect(result.current.editor.selectedStep).toBe(5);
    });

    it("on a slice row: selects an active step without turning it off", () => {
      const { result } = renderHook(() =>
        useHarness(
          { pattern: patternWith([2]), voices: voice1Sliced },
          onPlaySample,
        ),
      );
      act(() => result.current.editor.handleStepClick(0, 2));
      expect(result.current.pattern[0][2]).toBe(127);
      expect(result.current.editor.selectedStep).toBe(2);

      // Clicking the selected step again turns it off
      act(() => result.current.editor.handleStepClick(0, 2));
      expect(result.current.pattern[0][2]).toBe(0);
    });

    it("keyboard focus on a slice row selects that step", () => {
      const { result } = renderHook(() =>
        useHarness({ voices: voice1Sliced }, onPlaySample),
      );
      act(() => result.current.setFocusedStep({ step: 7, voice: 0 }));
      expect(result.current.editor.selectedStep).toBe(7);
    });
  });

  describe("assigning slices from the strip", () => {
    it("points the selected step at a slice span and auditions it", () => {
      const { result } = renderHook(() =>
        useHarness(
          { pattern: patternWith([3]), voices: voice1Sliced },
          onPlaySample,
        ),
      );
      act(() => result.current.editor.handleStepClick(0, 3));
      act(() => result.current.editor.assignSlice(9, 2));

      expect(toSliceView(result.current.sliceSteps[0][3]!, 16)).toEqual({
        lengthSlices: 2,
        startSlice: 9,
      });
      expect(onPlaySample).toHaveBeenCalledWith(1, 0, 90, {
        region: { length: 2 / 16, start: 9 / 16 },
      });
    });

    it("turns the selected step on if it was off", () => {
      const { result } = renderHook(() =>
        useHarness(
          { pattern: patternWith([3]), voices: voice1Sliced },
          onPlaySample,
        ),
      );
      act(() => result.current.editor.handleStepClick(0, 3)); // select
      act(() => result.current.editor.handleStepClick(0, 3)); // turn off
      expect(result.current.pattern[0][3]).toBe(0);

      act(() => result.current.editor.assignSlice(1, 1));
      expect(result.current.pattern[0][3]).toBe(127);
    });

    it("only auditions when no step is selected", () => {
      const { result } = renderHook(() =>
        useHarness({ voices: voice1Sliced }, onPlaySample),
      );
      act(() => result.current.editor.assignSlice(4, 1));
      expect(onPlaySample).toHaveBeenCalled();
      expect(result.current.sliceSteps).toEqual(createEmptySliceSteps());
    });

    it("does not audition while the sequencer is playing", () => {
      const { result } = renderHook(() =>
        useHarness({ isSeqPlaying: true, voices: voice1Sliced }, onPlaySample),
      );
      act(() => result.current.editor.auditionSlice(0, 1));
      expect(onPlaySample).not.toHaveBeenCalled();
    });
  });

  describe("rolls", () => {
    it("rolls active steps as one named undo step", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const { result } = renderHook(() =>
        useHarness(
          { pattern: patternWith([0, 4]), voices: voice1Sliced },
          onPlaySample,
        ),
      );

      act(() => result.current.editor.roll(1));
      expect(toSliceView(result.current.sliceSteps[0][0]!, 16).startSlice).toBe(
        15,
      );
      expect(result.current.editor.rolledSteps?.steps).toEqual([0, 4]);
      expect(result.current.edits).toEqual([
        { description: "Roll slices on voice 1" },
      ]);
    });

    it("explains when there is nothing to roll, and records nothing", () => {
      const { result } = renderHook(() =>
        useHarness({ voices: voice1Sliced }, onPlaySample),
      );
      act(() => result.current.editor.roll(1));
      expect(result.current.editor.notice).toMatch(/Nothing to roll/);
      expect(result.current.edits).toEqual([]);
    });

    it("merges repeated edits of one step's slice", () => {
      const { result } = renderHook(() =>
        useHarness(
          { pattern: patternWith([0]), voices: voice1Sliced },
          onPlaySample,
        ),
      );
      act(() => result.current.editor.handleStepWheel(0, 0, 1, false));
      act(() => result.current.editor.handleStepWheel(0, 0, 1, true));
      expect(result.current.edits.map((e) => e?.mergeKey)).toEqual([
        "slice:0:0",
        "slice:0:0",
      ]);
    });
  });

  describe("keyboard shortcuts", () => {
    function setup() {
      const rendered = renderHook(() =>
        useHarness(
          { pattern: patternWith([0]), voices: voice1Sliced },
          onPlaySample,
        ),
      );
      return rendered;
    }
    const focus = { step: 0, voice: 0 };

    it("[ and ] move the start slice, { and } change the length", () => {
      const { result } = setup();
      act(() => {
        result.current.editor.handleGridKeyDown(key("]"), focus);
      });
      act(() => {
        result.current.editor.handleGridKeyDown(key("}"), focus);
      });
      expect(toSliceView(result.current.sliceSteps[0][0]!, 16)).toEqual({
        lengthSlices: 2,
        startSlice: 1,
      });
      act(() => {
        result.current.editor.handleGridKeyDown(key("["), focus);
      });
      act(() => {
        result.current.editor.handleGridKeyDown(key("{"), focus);
      });
      expect(toSliceView(result.current.sliceSteps[0][0]!, 16)).toEqual({
        lengthSlices: 1,
        startSlice: 0,
      });
    });

    it("R toggles live random and L toggles the lock", () => {
      const { result } = setup();
      act(() => {
        result.current.editor.handleGridKeyDown(key("r"), focus);
      });
      act(() => {
        result.current.editor.handleGridKeyDown(key("l"), focus);
      });
      expect(result.current.sliceSteps[0][0]).toMatchObject({
        locked: true,
        random: true,
      });
    });

    it("D rolls", () => {
      const { result } = setup();
      act(() => {
        result.current.editor.handleGridKeyDown(key("d"), focus);
      });
      expect(result.current.edits).toEqual([
        { description: "Roll slices on voice 1" },
      ]);
    });

    it("leaves Cmd/Ctrl+Z to the kit's undo", () => {
      const { result } = setup();
      act(() => {
        result.current.editor.handleGridKeyDown(key("d"), focus);
      });
      expect(
        result.current.editor.handleGridKeyDown(
          key("z", { ctrlKey: true }),
          focus,
        ),
      ).toBe(false);
    });

    it("Escape closes the slicer first, then lets the kit have it", () => {
      const { result } = setup();
      expect(result.current.editor.editorOpen).toBe(true);
      const escape = key("Escape");
      let handled = false;
      act(() => {
        handled = result.current.editor.handleGridKeyDown(escape, focus);
      });
      expect(handled).toBe(true);
      expect(escape.stopPropagation).toHaveBeenCalled();
      expect(result.current.editor.editorOpen).toBe(false);

      expect(
        result.current.editor.handleGridKeyDown(key("Escape"), focus),
      ).toBe(false);
    });

    it("ignores slicer keys on rows that are not sliced", () => {
      const { result } = setup();
      expect(
        result.current.editor.handleGridKeyDown(key("]"), {
          step: 0,
          voice: 1,
        }),
      ).toBe(false);
    });
  });

  describe("scroll wheel", () => {
    it("nudges start, or length with Shift, on active slice steps only", () => {
      const { result } = renderHook(() =>
        useHarness(
          { pattern: patternWith([0]), voices: voice1Sliced },
          onPlaySample,
        ),
      );
      act(() => result.current.editor.handleStepWheel(0, 0, 1, false));
      act(() => result.current.editor.handleStepWheel(0, 0, 1, true));
      act(() => result.current.editor.handleStepWheel(0, 5, 1, false)); // off step
      expect(toSliceView(result.current.sliceSteps[0][0]!, 16)).toEqual({
        lengthSlices: 2,
        startSlice: 1,
      });
      expect(result.current.sliceSteps[0][5]).toBeNull();
    });
  });

  describe("playback flash", () => {
    it("records the slice that fired, and clears it when playback stops", () => {
      const { rerender, result } = renderHook(
        ({ playing }) =>
          useHarness(
            { isSeqPlaying: playing, voices: voice1Sliced },
            onPlaySample,
          ),
        { initialProps: { playing: true } },
      );
      act(() =>
        result.current.editor.handleSliceTriggered(1, {
          lengthSlices: 1,
          startSlice: 3,
        }),
      );
      expect(result.current.editor.playingSlice?.view.startSlice).toBe(3);

      rerender({ playing: false });
      expect(result.current.editor.playingSlice).toBeNull();
    });
  });

  it("shows slice views with sequential defaults for steps without data", () => {
    const { result } = renderHook(() =>
      useHarness({ voices: voice1Sliced }, onPlaySample),
    );
    expect(result.current.editor.sliceViews[0][6]).toEqual({
      lengthSlices: 1,
      startSlice: 6,
    });
    expect(makeSliceStep(0, 1, 16).start).toBe(0);
  });
});

describe("displayedSlotIndex", () => {
  it("uses the slot selected in the voice panel for that voice", () => {
    expect(displayedSlotIndex(["a.wav", "b.wav"], 1, 1, 1)).toBe(1);
  });

  it("falls back to the first filled slot", () => {
    expect(displayedSlotIndex(["", "b.wav"], 2, 1, 0)).toBe(1);
    expect(displayedSlotIndex(["a.wav"], 1, 1, 5)).toBe(0);
  });

  it("returns null for an empty voice", () => {
    expect(displayedSlotIndex([], 1)).toBeNull();
    expect(displayedSlotIndex(["", ""], 1)).toBeNull();
    expect(displayedSlotIndex(undefined, 1)).toBeNull();
  });
});

describe("[UC-33] [UC-36] a slicer setting that isn't saved says so (#511)", () => {
  beforeEach(() => {
    setupElectronAPIMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const voices: SlicerVoiceData[] = [
    { slice_enabled: false, slice_roll_amount: 50, voice_number: 1 },
  ];

  it("turns slicing back off and says so when main refuses", async () => {
    vi.mocked(
      globalThis.electronAPI.updateVoiceSliceSettings,
    ).mockResolvedValue({ error: "disk full", success: false });
    const onMessage = vi.fn();
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useVoiceSliceSettings("A0", voices, onChanged, onMessage),
    );

    await act(async () => {
      result.current.updateSliceSettings(1, { enabled: true });
    });

    expect(result.current.sliceSettings[1].enabled).toBe(false);
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      "Couldn't turn slicing on for voice 1. Try again.",
      "error",
    );
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("puts the roll amount back when the save throws", async () => {
    vi.mocked(
      globalThis.electronAPI.updateVoiceSliceSettings,
    ).mockRejectedValue(new Error("IPC gone"));
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useVoiceSliceSettings("A0", voices, undefined, onMessage),
    );

    await act(async () => {
      result.current.updateSliceSettings(1, { rollAmount: 25 });
    });

    expect(result.current.sliceSettings[1].rollAmount).toBe(50);
    expect(onMessage).toHaveBeenCalledWith(
      "Couldn't save the roll amount for voice 1, so it's back to 50%. Try again.",
      "error",
    );
  });

  it("[Q-02] turns slicing back off and says so when updateVoiceSliceSettings is missing (#543)", async () => {
    const api = globalThis.electronAPI as unknown as Record<string, unknown>;
    const original = api.updateVoiceSliceSettings;
    api.updateVoiceSliceSettings = undefined;
    try {
      const onMessage = vi.fn();
      const onChanged = vi.fn();
      const { result } = renderHook(() =>
        useVoiceSliceSettings("A0", voices, onChanged, onMessage),
      );

      await act(async () => {
        result.current.updateSliceSettings(1, { enabled: true });
      });

      expect(result.current.sliceSettings[1].enabled).toBe(false);
      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't turn slicing on for voice 1. Try again.",
        "error",
      );
      expect(onChanged).not.toHaveBeenCalled();
    } finally {
      api.updateVoiceSliceSettings = original;
    }
  });

  it("reloads the kit once a setting is saved, and says nothing", async () => {
    vi.mocked(
      globalThis.electronAPI.updateVoiceSliceSettings,
    ).mockResolvedValue({ success: true });
    const onMessage = vi.fn();
    const onChanged = vi.fn();
    const { result } = renderHook(() =>
      useVoiceSliceSettings("A0", voices, onChanged, onMessage),
    );

    await act(async () => {
      result.current.updateSliceSettings(1, { varyLength: true });
    });

    expect(result.current.sliceSettings[1].varyLength).toBe(true);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("treats the same settings in any order as one setting", async () => {
    vi.mocked(
      globalThis.electronAPI.updateVoiceSliceSettings,
    ).mockResolvedValue({ error: "disk full", success: false });
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useVoiceSliceSettings("A0", voices, undefined, onMessage),
    );

    // Main answers in order, so only the latest change for the key reports
    await act(async () => {
      result.current.updateSliceSettings(1, { enabled: true, rollAmount: 25 });
      result.current.updateSliceSettings(1, { enabled: true, rollAmount: 75 });
      // Built so the linter can't put the fields back in order
      result.current.updateSliceSettings(
        1,
        Object.fromEntries([
          ["rollAmount", 100],
          ["enabled", true],
        ]),
      );
    });

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(result.current.sliceSettings[1]).toMatchObject({
      enabled: false,
      rollAmount: 50,
    });
  });

  it("names each setting in its message", () => {
    expect(sliceSettingNotSaved(2, { enabled: true })).toBe(
      "Couldn't turn slicing off for voice 2. Try again.",
    );
    expect(sliceSettingNotSaved(2, { varyLength: false })).toBe(
      "Couldn't turn Vary length on for voice 2. Try again.",
    );
    expect(sliceSettingNotSaved(2, { maxLength: 4 })).toBe(
      "Couldn't save the longest random length for voice 2, so it's back to 4. Try again.",
    );
    expect(sliceSettingNotSaved(2, { enabled: true, rollAmount: 50 })).toBe(
      "Couldn't save the slicer settings for voice 2. Try again.",
    );
  });
});

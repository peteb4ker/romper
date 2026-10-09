import type { KitWithRelations, Sample } from "@romper/shared/db/schema";
import type { AnyUndoAction, MoveSampleAction } from "@romper/shared/undoTypes";

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VoiceSamples } from "../../../kitTypes";

import { useSampleManagementMoveOps } from "../../sample-management/useSampleManagementMoveOps";
import { useUndoActionHandlers } from "../../shared/useUndoActionHandlers";
import { moveKeyTarget, useSampleMoveKeys } from "../useSampleMoveKeys";

const NONE = new Set<number>();

/** A voice holding `count` samples named v<voice>-<slot>.wav */
const voiceOf = (voice: number, count: number) =>
  Array.from({ length: count }, (_, slot) => `v${voice}-${slot}.wav`);

describe("[Q-06] [UC-21] moveKeyTarget (#522)", () => {
  const samples: VoiceSamples = {
    1: voiceOf(1, 3),
    2: voiceOf(2, 1),
    3: [],
    4: voiceOf(4, 12),
  };

  it("Up and Down swap the sample with its neighbor in the voice", () => {
    expect(moveKeyTarget("up", 1, 1, samples, NONE)).toEqual({
      toSlot: 0,
      toVoice: 1,
    });
    expect(moveKeyTarget("down", 1, 1, samples, NONE)).toEqual({
      toSlot: 2,
      toVoice: 1,
    });
  });

  it("stops at the voice's first slot and its last sample", () => {
    expect(moveKeyTarget("up", 1, 0, samples, NONE)).toBeNull();
    // Below the last sample is the drop zone, where it would stay last
    expect(moveKeyTarget("down", 1, 2, samples, NONE)).toBeNull();
  });

  it("Left and Right keep the slot, or go after the voice's last sample", () => {
    expect(moveKeyTarget("right", 1, 0, samples, NONE)).toEqual({
      toSlot: 0,
      toVoice: 2,
    });
    // Voice 2 has one sample, so slot 3 lands after it, in slot 2
    expect(moveKeyTarget("right", 1, 2, samples, NONE)).toEqual({
      toSlot: 1,
      toVoice: 2,
    });
    expect(moveKeyTarget("left", 2, 0, samples, NONE)).toEqual({
      toSlot: 0,
      toVoice: 1,
    });
    // An empty voice takes it in its first slot
    expect(moveKeyTarget("right", 2, 0, samples, NONE)).toEqual({
      toSlot: 0,
      toVoice: 3,
    });
  });

  it("doesn't wrap: voice 1 doesn't go left, voice 4 doesn't go right", () => {
    expect(moveKeyTarget("left", 1, 0, samples, NONE)).toBeNull();
    expect(moveKeyTarget("right", 4, 0, samples, NONE)).toBeNull();
  });

  it("still tries a full voice, so main says it's full, as for a drag", () => {
    expect(
      moveKeyTarget("left", 4, 0, { ...samples, 3: voiceOf(3, 12) }, NONE),
    ).toEqual({ toSlot: 0, toVoice: 3 });
  });

  it("[UC-28] skips the hidden right-hand voice of a stereo pair, as a drag can't reach it", () => {
    const hidden = new Set([2]);
    expect(moveKeyTarget("right", 1, 0, samples, hidden)).toEqual({
      toSlot: 0,
      toVoice: 3,
    });
    expect(
      moveKeyTarget("left", 3, 0, { ...samples, 3: ["x.wav"] }, hidden),
    ).toEqual({ toSlot: 0, toVoice: 1 });
    // Voices 3 and 4 linked: nothing to the right of voice 3
    expect(
      moveKeyTarget("right", 3, 0, { ...samples, 3: ["x.wav"] }, new Set([4])),
    ).toBeNull();
  });

  it("does nothing without a sample in the selected slot", () => {
    expect(moveKeyTarget("down", 3, 0, samples, NONE)).toBeNull();
    expect(moveKeyTarget("right", 1, -1, samples, NONE)).toBeNull();
  });
});

function kitWith(
  samples: VoiceSamples,
  linkedVoices: number[] = [],
): KitWithRelations {
  const rows = Object.entries(samples).flatMap(
    ([voice, names]: [string, string[]]) =>
      names.map(
        (filename, slot) =>
          ({
            filename,
            slot_number: slot,
            source_path: `/samples/${filename}`,
            voice_number: Number(voice),
          }) as Sample,
      ),
  );
  return {
    name: "A0",
    samples: rows,
    voices: [1, 2, 3, 4].map((voice_number) => ({
      stereo_mode: linkedVoices.includes(voice_number),
      voice_number,
    })),
  } as unknown as KitWithRelations;
}

/**
 * The hook as the kit editor uses it: the selection in state, and a kit
 * whose samples follow each move once it resolves
 */
function setup({
  editable = true,
  linkedVoices = [] as number[],
  moved = true,
  samples = { 1: voiceOf(1, 2), 2: voiceOf(2, 1), 3: [], 4: [] },
  selectedSampleIdx = 0,
  selectedVoice = 1,
} = {}) {
  const onSampleMove = vi.fn().mockResolvedValue(moved);
  const setSelectedSampleIdx = vi.fn();
  const setSelectedVoice = vi.fn();
  const view = renderHook((p) => useSampleMoveKeys(p), {
    initialProps: {
      isEditable: editable,
      kit: kitWith(samples, linkedVoices),
      onSampleMove,
      samples: samples as VoiceSamples,
      selectedSampleIdx,
      selectedVoice,
      setSelectedSampleIdx,
      setSelectedVoice,
    },
  });
  return { onSampleMove, setSelectedSampleIdx, setSelectedVoice, view };
}

describe("[Q-06] [UC-21] useSampleMoveKeys moves the selected sample (#522)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("Alt+Down moves it through the drag's move and selects it where it went", async () => {
    const { onSampleMove, setSelectedSampleIdx, setSelectedVoice, view } =
      setup();

    await act(() => view.result.current.moveSelectedSample("down"));

    expect(onSampleMove).toHaveBeenCalledWith(1, 0, 1, 1);
    expect(setSelectedVoice).toHaveBeenCalledWith(1);
    expect(setSelectedSampleIdx).toHaveBeenCalledWith(1);
  });

  it("Alt+Right moves it to the next voice", async () => {
    const { onSampleMove, setSelectedSampleIdx, setSelectedVoice, view } =
      setup({ selectedSampleIdx: 1 });

    await act(() => view.result.current.moveSelectedSample("right"));

    // Voice 2 has one sample, so it goes after it
    expect(onSampleMove).toHaveBeenCalledWith(1, 1, 2, 1);
    expect(setSelectedVoice).toHaveBeenCalledWith(2);
    expect(setSelectedSampleIdx).toHaveBeenCalledWith(1);
  });

  it("[UC-28] Alt+Right skips the hidden partner of a stereo pair", async () => {
    const { onSampleMove, view } = setup({ linkedVoices: [1] });

    await act(() => view.result.current.moveSelectedSample("right"));

    expect(onSampleMove).toHaveBeenCalledWith(1, 0, 3, 0);
  });

  it("keeps the selection when the move fails, and main's message says why", async () => {
    const { setSelectedSampleIdx, setSelectedVoice, view } = setup({
      moved: false,
    });

    await act(() => view.result.current.moveSelectedSample("down"));

    expect(setSelectedVoice).not.toHaveBeenCalled();
    expect(setSelectedSampleIdx).not.toHaveBeenCalled();
  });

  it("does nothing in a read-only kit, which can't be dragged in either", async () => {
    const { onSampleMove, view } = setup({ editable: false });

    await act(() => view.result.current.moveSelectedSample("down"));

    expect(onSampleMove).not.toHaveBeenCalled();
  });

  it("does nothing at an edge", async () => {
    const { onSampleMove, view } = setup();

    await act(() => view.result.current.moveSelectedSample("up"));
    await act(() => view.result.current.moveSelectedSample("left"));

    expect(onSampleMove).not.toHaveBeenCalled();
  });

  it("moves once at a time: a repeat before the kit shows the move is dropped", async () => {
    const { onSampleMove, view } = setup();
    let finish: (moved: boolean) => void = () => {};
    onSampleMove.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
    );

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = view.result.current.moveSelectedSample("down");
    });
    await act(() => view.result.current.moveSelectedSample("down"));
    expect(onSampleMove).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish(true);
      await first;
    });
    await act(() => view.result.current.moveSelectedSample("down"));
    expect(onSampleMove).toHaveBeenCalledTimes(2);
  });

  it("moves focus to the moved sample's row when focus was in a sample list", async () => {
    const samples = { 1: voiceOf(1, 2), 2: [], 3: [], 4: [] };
    const { view } = setup({ samples });
    const list = document.createElement("ul");
    list.dataset.testid = "sample-list-voice-1";
    const row = document.createElement("li");
    row.tabIndex = 0;
    list.appendChild(row);
    document.body.appendChild(list);
    row.focus();

    await act(() => view.result.current.moveSelectedSample("down"));

    // The kit shows the move, and the moved sample's row is a new element
    row.remove();
    const movedRow = document.createElement("li");
    movedRow.tabIndex = 0;
    movedRow.dataset.testid = "sample-selected-voice-1";
    list.appendChild(movedRow);
    view.rerender({
      isEditable: true,
      kit: kitWith(samples),
      onSampleMove: vi.fn(),
      samples: { ...samples, 1: ["v1-1.wav", "v1-0.wav"] },
      selectedSampleIdx: 1,
      selectedVoice: 1,
      setSelectedSampleIdx: vi.fn(),
      setSelectedVoice: vi.fn(),
    });

    await waitFor(() => expect(document.activeElement).toBe(movedRow));
  });

  it("leaves focus where it is when it wasn't in a sample list", async () => {
    const samples = { 1: voiceOf(1, 2), 2: [], 3: [], 4: [] };
    const { view } = setup({ samples });
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    const movedRow = document.createElement("li");
    movedRow.tabIndex = 0;
    movedRow.dataset.testid = "sample-selected-voice-1";
    document.body.appendChild(movedRow);

    await act(() => view.result.current.moveSelectedSample("down"));
    view.rerender({
      isEditable: true,
      kit: kitWith(samples),
      onSampleMove: vi.fn(),
      samples: { ...samples, 1: ["v1-1.wav", "v1-0.wav"] },
      selectedSampleIdx: 1,
      selectedVoice: 1,
      setSelectedSampleIdx: vi.fn(),
      setSelectedVoice: vi.fn(),
    });

    expect(document.activeElement).toBe(button);
  });
});

describe("[Q-06] [UC-25] useSampleMoveKeys shows the selected sample's file (#522)", () => {
  it("does what right-clicking its row does", () => {
    const { view } = setup({ selectedSampleIdx: 1 });

    view.result.current.showSelectedSampleFile();

    expect(
      vi.mocked(globalThis.electronAPI.showItemInFolder),
    ).toHaveBeenCalledWith("/samples/v1-1.wav");
  });

  it("does nothing without a sample in the selected slot", () => {
    const { view } = setup({ selectedVoice: 3 });
    vi.mocked(globalThis.electronAPI.showItemInFolder).mockClear();

    view.result.current.showSelectedSampleFile();

    expect(globalThis.electronAPI.showItemInFolder).not.toHaveBeenCalled();
  });
});

describe("[Q-06] [UC-21] [UC-26] a key move undoes like a drag (#522)", () => {
  const voicesBefore = [
    {
      samples: [
        { filename: "v1-0.wav", slot_number: 0, source_path: "/s/v1-0.wav" },
        { filename: "v1-1.wav", slot_number: 1, source_path: "/s/v1-1.wav" },
      ],
      voice: 1,
    },
  ];

  beforeEach(() => {
    vi.mocked(globalThis.electronAPI.moveSampleInKit).mockResolvedValue({
      data: {
        affectedSamples: [],
        movedSample: { filename: "v1-0.wav", source_path: "/s/v1-0.wav" },
        voicesBefore,
      },
      success: true,
    } as unknown as Awaited<
      ReturnType<typeof globalThis.electronAPI.moveSampleInKit>
    >);
    vi.mocked(globalThis.electronAPI.restoreKitVoices).mockResolvedValue({
      success: true,
    } as Awaited<ReturnType<typeof globalThis.electronAPI.restoreKitVoices>>);
  });

  it("records the drag's MOVE_SAMPLE undo, and undoing it restores the voice", async () => {
    const recorded: AnyUndoAction[] = [];
    const samples = { 1: voiceOf(1, 2), 2: [], 3: [], 4: [] };
    const view = renderHook(() => {
      const moveOps = useSampleManagementMoveOps({
        kitName: "A0",
        onAddUndoAction: (action) => recorded.push(action),
        onSamplesChanged: vi.fn().mockResolvedValue(undefined),
        skipUndoRecording: false,
      });
      const keys = useSampleMoveKeys({
        isEditable: true,
        kit: kitWith(samples),
        onSampleMove: moveOps.handleSampleMove,
        samples,
        selectedSampleIdx: 0,
        selectedVoice: 1,
        setSelectedSampleIdx: vi.fn(),
        setSelectedVoice: vi.fn(),
      });
      const undo = useUndoActionHandlers({ kitName: "A0" });
      return { keys, undo };
    });

    await act(() => view.result.current.keys.moveSelectedSample("down"));

    // The same IPC as a drag, which marks the kit modified in main
    expect(globalThis.electronAPI.moveSampleInKit).toHaveBeenCalledWith(
      "A0",
      1,
      0,
      1,
      1,
    );
    expect(recorded).toHaveLength(1);
    const action = recorded[0] as MoveSampleAction;
    expect(action.type).toBe("MOVE_SAMPLE");
    expect(action.data).toMatchObject({
      fromSlot: 0,
      fromVoice: 1,
      toSlot: 1,
      toVoice: 1,
    });

    await view.result.current.undo.executeUndoAction(action);
    expect(globalThis.electronAPI.restoreKitVoices).toHaveBeenCalledWith(
      "A0",
      voicesBefore,
    );
  });
});

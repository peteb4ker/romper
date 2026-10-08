import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createSlotPlaybackStore,
  IDLE_SLOT,
  useSlotPlayback,
} from "../slotPlaybackStore";

const play = (slot: typeof IDLE_SLOT) => ({
  ...slot,
  playTrigger: slot.playTrigger + 1,
});

describe("[Q-01] [UC-29] slotPlaybackStore (#482)", () => {
  it("reads a slot nothing has played as idle", () => {
    const store = createSlotPlaybackStore();
    expect(store.get("1:0")).toBe(IDLE_SLOT);
    expect(IDLE_SLOT).toEqual({
      playing: false,
      playTrigger: 0,
      stopTrigger: 0,
    });
  });

  it("tells only the changed slot's listeners", () => {
    const store = createSlotPlaybackStore();
    const slot0 = vi.fn();
    const slot1 = vi.fn();
    store.subscribe("1:0", slot0);
    store.subscribe("1:1", slot1);

    store.update("1:0", play);

    expect(slot0).toHaveBeenCalledTimes(1);
    expect(slot1).not.toHaveBeenCalled();
    expect(store.get("1:0").playTrigger).toBe(1);
    expect(store.get("1:1")).toBe(IDLE_SLOT);
  });

  it("tells no one, and keeps the same object, when nothing changed", () => {
    const store = createSlotPlaybackStore();
    const listener = vi.fn();
    store.subscribe("1:0", listener);
    store.update("1:0", play);
    const before = store.get("1:0");
    listener.mockClear();

    store.update("1:0", (slot) => ({ ...slot, playing: false }));

    expect(listener).not.toHaveBeenCalled();
    expect(store.get("1:0")).toBe(before);
  });

  it("stops telling a listener once it unsubscribes", () => {
    const store = createSlotPlaybackStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe("1:0", listener);

    unsubscribe();
    store.update("1:0", play);

    expect(listener).not.toHaveBeenCalled();
  });

  it("re-renders a slot's reader only when that slot changes", () => {
    const store = createSlotPlaybackStore();
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useSlotPlayback(store, "2:3");
    });
    renders = 0;

    act(() => store.update("2:4", play));
    expect(renders).toBe(0);

    act(() => store.update("2:3", play));
    expect(renders).toBe(1);
    expect(result.current.playTrigger).toBe(1);
  });
});

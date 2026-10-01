import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getSharedAudioContext (RE-14)", () => {
  let created: Array<{ onstatechange: (() => void) | null; state: string }>;

  beforeEach(() => {
    vi.resetModules();
    created = [];
    globalThis.AudioContext = vi.fn(function () {
      const ctx = { onstatechange: null, state: "running" };
      created.push(ctx);
      return ctx;
    }) as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function load() {
    return (await import("../sharedAudioContext")).getSharedAudioContext;
  }

  it("gives every caller the same context", async () => {
    const getSharedAudioContext = await load();
    const first = getSharedAudioContext();
    expect(getSharedAudioContext()).toBe(first);
    expect(getSharedAudioContext()).toBe(first);
    expect(globalThis.AudioContext).toHaveBeenCalledTimes(1);
  });

  it("opens a new one if the context was closed", async () => {
    const getSharedAudioContext = await load();
    const first = getSharedAudioContext();
    (first as unknown as { state: string }).state = "closed";

    const second = getSharedAudioContext();

    expect(second).not.toBe(first);
    expect(globalThis.AudioContext).toHaveBeenCalledTimes(2);
  });

  it("warns when the OS suspends or interrupts it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const getSharedAudioContext = await load();
    getSharedAudioContext();

    created[0].state = "suspended";
    created[0].onstatechange?.();
    created[0].state = "running";
    created[0].onstatechange?.();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[audio] AudioContext suspended");
  });
});

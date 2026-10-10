import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IpcActivity } from "../ipcActivity.js";

describe("[Q-01] IpcActivity: what the renderer has asked main to do (#812)", () => {
  let activity: IpcActivity;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    activity = new IpcActivity();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is quiet when no call has been made", () => {
    expect(activity.isQuiet(250)).toBe(true);
    expect(activity.exclusiveActive).toBe(false);
  });

  it("is not quiet while a call is in flight, however long", async () => {
    let finish!: () => void;
    const call = activity.track(
      "get-kit",
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    vi.advanceTimersByTime(60_000);
    expect(activity.isQuiet(250)).toBe(false);

    finish();
    await call;
    // Quiet only after the quiet period since the call ended
    expect(activity.isQuiet(250)).toBe(false);
    vi.advanceTimersByTime(249);
    expect(activity.isQuiet(250)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(activity.isQuiet(250)).toBe(true);
  });

  it("returns the handler's own result, sync or not", async () => {
    const promise = Promise.resolve("done");
    expect(activity.track("get-kit", () => promise)).toBe(promise);
    expect(activity.track("get-kit", () => 42)).toBe(42);
    await promise;
  });

  it("counts a sync handler as over when it returns", () => {
    activity.track("get-kit", () => 1);
    vi.advanceTimersByTime(250);
    expect(activity.isQuiet(250)).toBe(true);
  });

  it("stops counting a call that throws or rejects, and passes the failure on", async () => {
    expect(() =>
      activity.track("get-kit", () => {
        throw new Error("sync");
      }),
    ).toThrow("sync");
    await expect(
      activity.track("get-kit", () => Promise.reject(new Error("async"))),
    ).rejects.toThrow("async");

    vi.advanceTimersByTime(250);
    expect(activity.isQuiet(250)).toBe(true);
  });

  it("knows when a write, setup or rescan is in flight, and how many began", async () => {
    let finish!: () => void;
    const write = activity.track(
      "startKitSync",
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    expect(activity.exclusiveActive).toBe(true);
    expect(activity.exclusiveStartCount).toBe(1);

    // Other calls are not exclusive
    activity.track("get-kit", () => 1);
    expect(activity.exclusiveStartCount).toBe(1);

    finish();
    await write;
    expect(activity.exclusiveActive).toBe(false);
    // A step that began before the write can tell one began
    expect(activity.exclusiveStartCount).toBe(1);
    activity.track("rescan-kit", () => 1);
    expect(activity.exclusiveStartCount).toBe(2);
  });
});

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SyncProgressState } from "../../../dialogs/SyncUpdateDialog.types";

import { createSyncProgressStore, useSyncProgress } from "../syncProgressStore";

const progress = (filesCompleted: number): SyncProgressState => ({
  currentFile: `s${filesCompleted}.wav`,
  filesCompleted,
  status: "copying",
  totalFiles: 10,
});

describe("createSyncProgressStore", () => {
  it("starts empty", () => {
    expect(createSyncProgressStore().get()).toBeNull();
  });

  it("stores a value or the result of an updater", () => {
    const store = createSyncProgressStore();

    store.set(progress(1));
    store.set((prev) => (prev ? { ...prev, status: "completed" } : null));

    expect(store.get()).toMatchObject({
      filesCompleted: 1,
      status: "completed",
    });
  });

  it("notifies subscribers on change until they unsubscribe", () => {
    const store = createSyncProgressStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set(progress(1));
    unsubscribe();
    store.set(progress(2));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify when the value is unchanged", () => {
    const store = createSyncProgressStore();
    const value = progress(1);
    store.set(value);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(value);
    store.set((prev) => prev);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("useSyncProgress", () => {
  it("re-renders with each update", () => {
    const store = createSyncProgressStore();
    const { result } = renderHook(() => useSyncProgress(store));
    expect(result.current).toBeNull();

    act(() => store.set(progress(3)));

    expect(result.current?.filesCompleted).toBe(3);
  });
});

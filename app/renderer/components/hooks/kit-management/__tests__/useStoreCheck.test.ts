import type { StoreCheckUpdate } from "@romper/shared/electronApi";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useStoreCheck } from "../useStoreCheck";

const finding = (kitName: string, quarantined: boolean) => ({
  kitName,
  missing: 0,
  quarantined,
  unreadable: quarantined ? 1 : 0,
});

describe("[UC-05] [Q-01] useStoreCheck (#812)", () => {
  let push: (update: StoreCheckUpdate) => void;
  const stopListening = vi.fn<() => void>();
  const onQuarantineFound = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setupElectronAPIMock({
      getStoreCheckStatus: vi.fn().mockResolvedValue({
        data: { kits: [], lastCompletedAt: null, state: "running" },
        success: true,
      }),
      onStoreCheckUpdated: vi.fn((callback) => {
        push = callback;
        return stopListening;
      }),
    });
  });

  const render = (isGridLoaded = true, path: null | string = "/store") =>
    renderHook(
      (props) =>
        useStoreCheck({
          isGridLoaded: props.isGridLoaded,
          localStorePath: props.path,
          onQuarantineFound,
        }),
      { initialProps: { isGridLoaded, path } },
    );

  it("asks for the status once the grid has loaded, not before: the first request starts the check", () => {
    const { rerender } = render(false);
    expect(globalThis.electronAPI.getStoreCheckStatus).not.toHaveBeenCalled();
    expect(globalThis.electronAPI.onStoreCheckUpdated).not.toHaveBeenCalled();

    rerender({ isGridLoaded: true, path: "/store" });

    expect(globalThis.electronAPI.getStoreCheckStatus).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a store", () => {
    render(true, null);
    expect(globalThis.electronAPI.getStoreCheckStatus).not.toHaveBeenCalled();
  });

  it("patches each kit in a push, and no more", () => {
    render();

    act(() => {
      push({ kits: [finding("A1", true)], state: "running" });
    });
    act(() => {
      push({ kits: [finding("A1", false)], state: "running" });
    });

    expect(onQuarantineFound.mock.calls).toEqual([
      ["A1", true],
      ["A1", false],
    ]);
  });

  it("applies what was found before it listened (a reloaded renderer)", async () => {
    vi.mocked(globalThis.electronAPI.getStoreCheckStatus).mockResolvedValue({
      data: {
        kits: [finding("B0", true)],
        lastCompletedAt: null,
        state: "running",
      },
      success: true,
    });

    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(onQuarantineFound).toHaveBeenCalledWith("B0", true);
  });

  it("stops listening when it unmounts, and ignores a status that arrives later", async () => {
    let answer: (value: unknown) => void = () => {};
    vi.mocked(globalThis.electronAPI.getStoreCheckStatus).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }) as never,
    );
    const { unmount } = render();

    unmount();
    expect(stopListening).toHaveBeenCalledTimes(1);
    await act(async () => {
      answer({
        data: {
          kits: [finding("B0", true)],
          lastCompletedAt: null,
          state: "idle",
        },
        success: true,
      });
      await Promise.resolve();
    });

    expect(onQuarantineFound).not.toHaveBeenCalled();
  });

  it("copes with a status that can't be read", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(globalThis.electronAPI.getStoreCheckStatus).mockRejectedValue(
      new Error("no handler"),
    );

    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(onQuarantineFound).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

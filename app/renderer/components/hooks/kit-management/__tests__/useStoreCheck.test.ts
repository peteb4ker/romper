import type { StoreCheckUpdate } from "@romper/shared/electronApi";

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createStoreCheckFinding } from "../../../../../../tests/factories/storeCheck.factory";
import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { storeCheckStore } from "../storeCheckStore";
import { useStoreCheck } from "../useStoreCheck";

const finding = (kitName: string, quarantined: boolean) => ({
  folderMissing: false,
  kitName,
  missing: 0,
  notConnected: [],
  notResponding: [],
  quarantined,
  unavailableVolumes: [],
  unreadable: quarantined ? 1 : 0,
  untracked: [],
});

describe("[UC-05] [Q-01] useStoreCheck (#812)", () => {
  let push: (update: StoreCheckUpdate) => void;
  const stopListening = vi.fn<() => void>();
  const onQuarantineFound = vi.fn();
  const onMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    storeCheckStore.reset();
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
          onMessage,
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

  describe("the notice (#824)", () => {
    const missing = (kitName: string, count = 1) =>
      createStoreCheckFinding({ kitName, missing: count });

    it("keeps each kit's finding for the badge and the status bar item", () => {
      render();

      act(() => {
        push({
          kits: [
            missing("A0", 2),
            createStoreCheckFinding({ kitName: "B1", untracked: ["1 x.wav"] }),
          ],
          state: "running",
        });
      });

      expect(storeCheckStore.getFinding("A0")?.missing).toBe(2);
      expect(storeCheckStore.getSummary().attention).toHaveLength(2);
    });

    it("says once, when the pass ends, how many kits it found missing files in", () => {
      render();

      act(() => {
        push({ kits: [missing("A0")], state: "running" });
        push({ kits: [missing("B1", 3)], state: "running" });
      });
      // Nothing while the pass runs
      expect(onMessage).not.toHaveBeenCalled();

      act(() => {
        push({ kits: [], state: "idle" });
      });
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        "Romper found missing sample files in 2 kits. Open the list from the status bar.",
        "warning",
      );
    });

    it("says nothing when a later pass finds the same problems", () => {
      render();
      act(() => {
        push({ kits: [missing("A0")], state: "running" });
        push({ kits: [], state: "idle" });
      });
      onMessage.mockClear();

      act(() => {
        push({ kits: [missing("A0")], state: "running" });
        push({ kits: [], state: "idle" });
      });

      expect(onMessage).not.toHaveBeenCalled();
    });

    it("says it again for a kit that gets a new missing file", () => {
      render();
      act(() => {
        push({ kits: [missing("A0")], state: "running" });
        push({ kits: [], state: "idle" });
      });
      onMessage.mockClear();

      act(() => {
        push({ kits: [missing("A0", 2), missing("B1")], state: "running" });
        push({ kits: [], state: "idle" });
      });

      expect(onMessage).toHaveBeenCalledWith(
        "Romper found missing sample files in 2 kits. Open the list from the status bar.",
        "warning",
      );
    });

    it("says nothing for a pass that finds nothing, or only a kit's untracked files or a file it can't read", () => {
      render();

      act(() => {
        push({
          kits: [
            createStoreCheckFinding({ kitName: "A0", untracked: ["1 x.wav"] }),
            finding("B1", true),
          ],
          state: "running",
        });
        push({ kits: [], state: "idle" });
      });

      expect(onMessage).not.toHaveBeenCalled();
    });

    it("says it for what the status held when the view mounted, and then not again when it mounts again", async () => {
      vi.mocked(globalThis.electronAPI.getStoreCheckStatus).mockResolvedValue({
        data: { kits: [missing("A0")], lastCompletedAt: 1, state: "idle" },
        success: true,
      });

      const first = render();
      await act(async () => {
        await Promise.resolve();
      });
      expect(onMessage).toHaveBeenCalledTimes(1);
      first.unmount();

      // The view comes back (the About page and back, a reloaded grid)
      render();
      await act(async () => {
        await Promise.resolve();
      });
      expect(onMessage).toHaveBeenCalledTimes(1);
    });

    it("says nothing while the status says the pass is still running", async () => {
      vi.mocked(globalThis.electronAPI.getStoreCheckStatus).mockResolvedValue({
        data: {
          kits: [missing("A0")],
          lastCompletedAt: null,
          state: "running",
        },
        success: true,
      });

      render();
      await act(async () => {
        await Promise.resolve();
      });

      expect(onMessage).not.toHaveBeenCalled();
      expect(storeCheckStore.getFinding("A0")).toBeDefined();
    });

    it("forgets the findings of the store it left", () => {
      const { rerender } = render();
      act(() => {
        push({ kits: [missing("A0")], state: "running" });
      });

      rerender({ isGridLoaded: true, path: "/other" });

      expect(storeCheckStore.getFinding("A0")).toBeUndefined();
    });
  });
});

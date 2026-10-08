import type { ElectronAPI } from "@romper/shared/electronApi";

import { act, renderHook, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import { bpmNotSaved, useBpm } from "../useBpm";
import { REPEAT_FAILURE_MS } from "../useSettingSave";

describe("useBpm", () => {
  let mockUpdateKitBpm: Mock<ElectronAPI["updateKitBpm"]>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get the global electronAPI mock (set up by test setup)
    mockUpdateKitBpm = vi.mocked(globalThis.electronAPI.updateKitBpm);
    // Reset the mock to default behavior
    mockUpdateKitBpm.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("initializes with provided BPM value", () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 140, kitName: "A1" }),
    );

    expect(result.current.bpm).toBe(140);
  });

  it("defaults to 120 BPM when no initial value provided", () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: undefined, kitName: "A1" }),
    );

    expect(result.current.bpm).toBe(120);
  });

  it("updates BPM value when initialBpm changes", () => {
    const { rerender, result } = renderHook(
      ({ initialBpm }) => useBpm({ initialBpm, kitName: "A1" }),
      {
        initialProps: { initialBpm: 120 },
      },
    );

    expect(result.current.bpm).toBe(120);

    rerender({ initialBpm: 150 });
    expect(result.current.bpm).toBe(150);
  });

  it("calls electronAPI.updateKitBpm when setBpm is called with valid value", async () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    expect(mockUpdateKitBpm).toHaveBeenCalledWith("A1", 140);
    expect(result.current.bpm).toBe(140);
  });

  it("clamps BPM values below 30 to 30", async () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(20);
    });

    expect(mockUpdateKitBpm).toHaveBeenCalledWith("A1", 30);
    expect(result.current.bpm).toBe(30); // Should be clamped to 30
  });

  it("clamps BPM values above 180 to 180", async () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(200);
    });

    expect(mockUpdateKitBpm).toHaveBeenCalledWith("A1", 180);
    expect(result.current.bpm).toBe(180); // Should be clamped to 180
  });

  it("reverts BPM on API failure", async () => {
    mockUpdateKitBpm.mockRejectedValue(new Error("API Error"));

    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    await waitFor(() => {
      expect(result.current.bpm).toBe(120); // Should revert to original value
    });
  });

  it("reverts BPM when the DbResult reports failure (no rejection)", async () => {
    // updateKitBpm returns a DbResult and does NOT reject on a DB failure;
    // the hook must inspect result.success rather than only catching.
    mockUpdateKitBpm.mockResolvedValue({
      error: "disk full",
      success: false,
    });

    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    await waitFor(() => {
      expect(result.current.bpm).toBe(120); // reverted, value was not persisted
    });
  });

  it("reverts BPM on API exception", async () => {
    mockUpdateKitBpm.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    await waitFor(() => {
      expect(result.current.bpm).toBe(120); // Should revert to original value
    });
  });

  it("does not call API when kitName is empty", async () => {
    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    expect(mockUpdateKitBpm).not.toHaveBeenCalled();
  });

  it("does not call API when electronAPI is not available", async () => {
    // Temporarily remove electronAPI
    vi.stubGlobal("electronAPI", undefined);

    const { result } = renderHook(() =>
      useBpm({ initialBpm: 120, kitName: "A1" }),
    );

    await act(async () => {
      await result.current.setBpm(140);
    });

    // Restore electronAPI
    vi.unstubAllGlobals();

    expect(mockUpdateKitBpm).not.toHaveBeenCalled();
  });

  describe("[UC-18] stepping to another kit (#565)", () => {
    it("shows the next kit's own BPM when it loaded with the same one as the last", async () => {
      const { rerender, result } = renderHook(
        ({ kitName }) => useBpm({ initialBpm: 120, kitName }),
        { initialProps: { kitName: "A0" } },
      );
      await act(async () => {
        await result.current.setBpm(130);
      });
      expect(result.current.bpm).toBe(130);

      rerender({ kitName: "A1" });

      expect(result.current.bpm).toBe(120);
    });

    it("reports a saved BPM with its kit, so the loaded kit can be patched", async () => {
      const onSaved = vi.fn();
      const { result } = renderHook(() =>
        useBpm({ initialBpm: 120, kitName: "A0", onSaved }),
      );

      await act(async () => {
        await result.current.setBpm(130);
      });

      expect(onSaved).toHaveBeenCalledWith("A0", 130);
    });

    it("reports the kit it saved to when you've stepped on before main answers", async () => {
      let answer: (result: { success: true }) => void = () => {};
      vi.mocked(globalThis.electronAPI.updateKitBpm).mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      const onSaved = vi.fn();
      const { rerender, result } = renderHook(
        ({ kitName }) => useBpm({ initialBpm: 120, kitName, onSaved }),
        { initialProps: { kitName: "A0" } },
      );
      let saving: Promise<void> = Promise.resolve();
      act(() => {
        saving = result.current.setBpm(130);
      });

      rerender({ kitName: "A1" });
      await act(async () => {
        answer({ success: true });
        await saving;
      });

      expect(onSaved).toHaveBeenCalledWith("A0", 130);
      expect(result.current.bpm).toBe(120);
    });

    it("doesn't report a BPM main didn't save", async () => {
      vi.mocked(globalThis.electronAPI.updateKitBpm).mockResolvedValue({
        error: "disk full",
        success: false,
      });
      const onSaved = vi.fn();
      const { result } = renderHook(() =>
        useBpm({ initialBpm: 120, kitName: "A0", onSaved }),
      );

      await act(async () => {
        await result.current.setBpm(130);
      });

      expect(onSaved).not.toHaveBeenCalled();
    });
  });

  describe("[UC-30] [UC-36] a BPM that isn't saved says so (#511)", () => {
    it("gives one message for wheel nudges that all fail, and goes back", async () => {
      vi.mocked(globalThis.electronAPI.updateKitBpm).mockResolvedValue({
        error: "disk full",
        success: false,
      });
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useBpm({ initialBpm: 120, kitName: "A0", onMessage }),
      );

      await act(async () => {
        await Promise.all([
          result.current.setBpm(121),
          result.current.setBpm(122),
          result.current.setBpm(123),
        ]);
      });

      expect(result.current.bpm).toBe(120);
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't save the BPM, so it's back to 120. Try again.",
        "error",
      );
    });

    it("goes back to the last saved BPM, not the one the kit loaded with", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useBpm({ initialBpm: 120, kitName: "A0", onMessage }),
      );

      await act(async () => {
        await result.current.setBpm(125);
      });
      vi.mocked(globalThis.electronAPI.updateKitBpm).mockRejectedValueOnce(
        new Error("IPC gone"),
      );
      await act(async () => {
        await result.current.setBpm(130);
      });

      expect(result.current.bpm).toBe(125);
      expect(onMessage).toHaveBeenCalledWith(bpmNotSaved(125), "error");
    });

    it("says nothing when the BPM is saved", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useBpm({ initialBpm: 120, kitName: "A0", onMessage }),
      );

      await act(async () => {
        await result.current.setBpm(140);
      });

      expect(result.current.bpm).toBe(140);
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("gives one message for nudges that each fail after the last, then another after a pause", async () => {
      vi.mocked(globalThis.electronAPI.updateKitBpm).mockResolvedValue({
        error: "disk full",
        success: false,
      });
      const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useBpm({ initialBpm: 120, kitName: "A0", onMessage }),
      );

      for (const [t, bpm] of [
        [10_000, 121],
        [10_300, 121],
        [10_600, 121],
      ]) {
        now.mockReturnValue(t);
        await act(async () => {
          await result.current.setBpm(bpm);
        });
      }
      expect(onMessage).toHaveBeenCalledTimes(1);

      now.mockReturnValue(10_600 + REPEAT_FAILURE_MS + 1);
      await act(async () => {
        await result.current.setBpm(121);
      });
      expect(onMessage).toHaveBeenCalledTimes(2);
      expect(result.current.bpm).toBe(120);
    });
  });

  describe("[Q-02] a BPM with nowhere to save (#543)", () => {
    it("leaves the BPM as it was when updateKitBpm is missing", async () => {
      vi.stubGlobal("electronAPI", {
        ...globalThis.electronAPI,
        updateKitBpm: undefined,
      });
      const { result } = renderHook(() =>
        useBpm({ initialBpm: 120, kitName: "A0" }),
      );

      await act(async () => {
        await result.current.setBpm(140);
      });

      expect(result.current.bpm).toBe(120);
    });

    it("leaves the BPM as it was when there's no kit", async () => {
      const { result } = renderHook(() =>
        useBpm({ initialBpm: 120, kitName: "" }),
      );

      await act(async () => {
        await result.current.setBpm(140);
      });

      expect(result.current.bpm).toBe(120);
    });

    it("goes back and says so when main gives no answer", async () => {
      vi.mocked(globalThis.electronAPI.updateKitBpm).mockResolvedValue(
        undefined as never,
      );
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useBpm({ initialBpm: 120, kitName: "A0", onMessage }),
      );

      await act(async () => {
        await result.current.setBpm(140);
      });

      expect(result.current.bpm).toBe(120);
      expect(onMessage).toHaveBeenCalledWith(bpmNotSaved(120), "error");
    });
  });
});

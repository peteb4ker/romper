import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useVoiceAlias } from "../useVoiceAlias";

describe("useVoiceAlias", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-setup electronAPI mock after clearAllMocks
    setupElectronAPIMock();

    // Mock electronAPI using centralized mocks
    vi.mocked(window.electronAPI.updateVoiceAlias).mockResolvedValue({
      success: true,
    });

    // Mock console.error
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("[UC-27] updateVoiceAlias", () => {
    it("updates voice alias successfully", async () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate }),
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick Drum",
      );
      expect(onUpdate).toHaveBeenCalled();
    });

    it("does not call API when electronAPI is not available", async () => {
      (window as unknown).electronAPI = undefined;
      const onUpdate = vi.fn();

      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate }),
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("does not call API when updateVoiceAlias method is not available", async () => {
      (window as unknown).electronAPI = {};
      const onUpdate = vi.fn();

      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate }),
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("does not call API when kitName is empty", async () => {
      const onUpdate = vi.fn();

      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "", onUpdate }),
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("handles API failure gracefully", async () => {
      vi.mocked(window.electronAPI.updateVoiceAlias).mockResolvedValue({
        error: "Database error",
        success: false,
      });

      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate }),
      );

      let saved: boolean | undefined;
      await act(async () => {
        saved = await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick Drum",
      );
      expect(saved).toBe(false);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("handles API exception gracefully", async () => {
      vi.mocked(window.electronAPI.updateVoiceAlias).mockRejectedValue(
        new Error("Network error"),
      );

      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate }),
      );

      await act(async () => {
        await expect(
          result.current.updateVoiceAlias(1, "Kick Drum"),
        ).resolves.toBe(false);
      });

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("works without onUpdate callback", async () => {
      const { result } = renderHook(() => useVoiceAlias({ kitName: "A0" }));

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick Drum",
      );
      // Should not throw when onUpdate is undefined
    });
  });

  describe("[UC-27] [UC-36] a voice name that isn't saved (RE-91)", () => {
    it("says so when main refuses the name", async () => {
      vi.mocked(window.electronAPI.updateVoiceAlias).mockResolvedValue({
        error: "SQLITE_BUSY: database is locked",
        success: false,
      });
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onMessage }),
      );

      await act(async () => {
        await result.current.updateVoiceAlias(2, "Snare");
      });

      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't save the name for voice 2. Try again.",
        "error",
      );
      expect(onMessage.mock.calls[0][0]).not.toMatch(/SQLITE|Error:/);
    });

    it("says so when the save throws", async () => {
      vi.mocked(window.electronAPI.updateVoiceAlias).mockRejectedValue(
        new Error("IPC channel closed"),
      );
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onMessage }),
      );

      await act(async () => {
        await expect(result.current.updateVoiceAlias(2, "Snare")).resolves.toBe(
          false,
        );
      });

      expect(onMessage).toHaveBeenCalledWith(
        "Couldn't save the name for voice 2. Try again.",
        "error",
      );
    });

    it("says nothing when the name is saved", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onMessage }),
      );

      await act(async () => {
        await expect(result.current.updateVoiceAlias(2, "Snare")).resolves.toBe(
          true,
        );
      });

      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  describe("dependency updates", () => {
    it("updates callback when kitName changes", async () => {
      const onUpdate = vi.fn();
      const { rerender, result } = renderHook(
        ({ kitName }) => useVoiceAlias({ kitName, onUpdate }),
        {
          initialProps: { kitName: "A0" },
        },
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick Drum",
      );

      // Clear previous calls
      vi.clearAllMocks();

      // Change kitName
      rerender({ kitName: "B0" });

      await act(async () => {
        await result.current.updateVoiceAlias(2, "Snare Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "B0",
        2,
        "Snare Drum",
      );
    });

    it("updates callback when onUpdate changes", async () => {
      const onUpdate1 = vi.fn();
      const onUpdate2 = vi.fn();

      const { rerender, result } = renderHook(
        ({ onUpdate }) => useVoiceAlias({ kitName: "A0", onUpdate }),
        {
          initialProps: { onUpdate: onUpdate1 },
        },
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(onUpdate1).toHaveBeenCalled();
      expect(onUpdate2).not.toHaveBeenCalled();

      // Clear previous calls
      vi.clearAllMocks();

      // Change onUpdate callback
      rerender({ onUpdate: onUpdate2 });

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(onUpdate1).not.toHaveBeenCalled();
      expect(onUpdate2).toHaveBeenCalled();
    });
  });

  describe("hook return interface", () => {
    it("returns correct interface structure", () => {
      const { result } = renderHook(() => useVoiceAlias({ kitName: "A0" }));

      expect(result.current).toHaveProperty("updateVoiceAlias");
      expect(typeof result.current.updateVoiceAlias).toBe("function");
    });

    it("maintains stable function reference", () => {
      const { rerender, result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0" }),
      );

      const firstUpdateVoiceAlias = result.current.updateVoiceAlias;

      rerender();

      const secondUpdateVoiceAlias = result.current.updateVoiceAlias;

      expect(firstUpdateVoiceAlias).toBe(secondUpdateVoiceAlias);
    });
  });

  describe("edge cases", () => {
    it("handles empty voice alias", async () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate }),
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "",
      );
      expect(onUpdate).toHaveBeenCalled();
    });

    it("handles voice number 0", async () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate }),
      );

      await act(async () => {
        await result.current.updateVoiceAlias(0, "Base Voice");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        0,
        "Base Voice",
      );
      expect(onUpdate).toHaveBeenCalled();
    });

    it("handles special characters in voice alias", async () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate }),
      );

      const specialAlias = "Kick & Snare (808)";

      await act(async () => {
        await result.current.updateVoiceAlias(1, specialAlias);
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        specialAlias,
      );
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});

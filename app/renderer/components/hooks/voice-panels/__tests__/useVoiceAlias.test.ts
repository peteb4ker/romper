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

  describe("updateVoiceAlias", () => {
    it("updates voice alias successfully", async () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate })
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick Drum"
      );
      expect(onUpdate).toHaveBeenCalled();
    });

    it("does not call API when electronAPI is not available", async () => {
      (window as any).electronAPI = undefined;
      const onUpdate = vi.fn();

      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate })
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("does not call API when updateVoiceAlias method is not available", async () => {
      (window as any).electronAPI = {};
      const onUpdate = vi.fn();

      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate })
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("does not call API when kitName is empty", async () => {
      const onUpdate = vi.fn();

      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "", onUpdate })
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
        useVoiceAlias({ kitName: "A0", onUpdate })
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick Drum"
      );
      expect(onUpdate).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "Failed to update voice alias:",
        "Database error"
      );
    });

    it("handles API exception gracefully", async () => {
      const apiError = new Error("Network error");
      vi.mocked(window.electronAPI.updateVoiceAlias).mockRejectedValue(
        apiError
      );

      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate })
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick Drum"
      );
      expect(onUpdate).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "Failed to update voice alias:",
        apiError
      );
    });

    it("works without onUpdate callback", async () => {
      const { result } = renderHook(() => useVoiceAlias({ kitName: "A0" }));

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick Drum"
      );
      // Should not throw when onUpdate is undefined
    });
  });

  describe("dependency updates", () => {
    it("updates callback when kitName changes", async () => {
      const onUpdate = vi.fn();
      const { rerender, result } = renderHook(
        ({ kitName }) => useVoiceAlias({ kitName, onUpdate }),
        {
          initialProps: { kitName: "A0" },
        }
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "Kick Drum");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        "Kick Drum"
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
        "Snare Drum"
      );
    });

    it("updates callback when onUpdate changes", async () => {
      const onUpdate1 = vi.fn();
      const onUpdate2 = vi.fn();

      const { rerender, result } = renderHook(
        ({ onUpdate }) => useVoiceAlias({ kitName: "A0", onUpdate }),
        {
          initialProps: { onUpdate: onUpdate1 },
        }
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
        useVoiceAlias({ kitName: "A0" })
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
        useVoiceAlias({ kitName: "A0", onUpdate })
      );

      await act(async () => {
        await result.current.updateVoiceAlias(1, "");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        ""
      );
      expect(onUpdate).toHaveBeenCalled();
    });

    it("handles voice number 0", async () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate })
      );

      await act(async () => {
        await result.current.updateVoiceAlias(0, "Base Voice");
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        0,
        "Base Voice"
      );
      expect(onUpdate).toHaveBeenCalled();
    });

    it("handles special characters in voice alias", async () => {
      const onUpdate = vi.fn();
      const { result } = renderHook(() =>
        useVoiceAlias({ kitName: "A0", onUpdate })
      );

      const specialAlias = "Kick & Snare (808)";

      await act(async () => {
        await result.current.updateVoiceAlias(1, specialAlias);
      });

      expect(window.electronAPI.updateVoiceAlias).toHaveBeenCalledWith(
        "A0",
        1,
        specialAlias
      );
      expect(onUpdate).toHaveBeenCalled();
    });
  });
});

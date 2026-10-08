import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as hmr from "../../../../utils/hmrStateManager";
import { useHmrSelectedKit } from "../useHmrSelectedKit";

// The real module, with isHmrAvailable replaceable so a test can play a
// production build (no import.meta.hot)
vi.mock("../../../../utils/hmrStateManager", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../utils/hmrStateManager")>();
  return {
    ...actual,
    isHmrAvailable: vi.fn(actual.isHmrAvailable),
    restoreSelectedKitIfExists: vi.fn(actual.restoreSelectedKitIfExists),
  };
});

const kits = [{ name: "A0" }, { name: "B1" }];

interface Props {
  kits: Array<{ name: string }>;
  selectedKit: null | string;
}

function renderWith(initial: Props, setSelectedKit = vi.fn()) {
  const view = renderHook(
    (props: Props) => useHmrSelectedKit({ ...props, setSelectedKit }),
    { initialProps: initial },
  );
  return { ...view, setSelectedKit };
}

describe("[Q-07] useHmrSelectedKit", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("after a live reload", () => {
    it("reopens the saved kit once the kits have loaded", () => {
      hmr.saveSelectedKitState("B1");

      // The reloaded view starts with no kits and no kit open
      const { rerender, setSelectedKit } = renderWith({
        kits: [],
        selectedKit: null,
      });
      expect(hmr.restoreSelectedKitIfExists).not.toHaveBeenCalled();
      expect(setSelectedKit).not.toHaveBeenCalled();

      rerender({ kits, selectedKit: null });

      expect(hmr.restoreSelectedKitIfExists).toHaveBeenCalledTimes(1);
      expect(setSelectedKit).toHaveBeenCalledWith("B1");
    });

    it("doesn't reopen it when the user has just navigated", () => {
      vi.useFakeTimers();
      hmr.saveSelectedKitState("B1");
      hmr.markExplicitNavigation();
      vi.advanceTimersByTime(500);

      const { setSelectedKit } = renderWith({ kits, selectedKit: null });

      expect(hmr.restoreSelectedKitIfExists).toHaveBeenCalledTimes(1);
      expect(setSelectedKit).not.toHaveBeenCalled();
    });

    it("tries only once, so a later kit refresh doesn't reopen it", () => {
      vi.useFakeTimers();
      hmr.saveSelectedKitState("B1");
      hmr.markExplicitNavigation();

      const { rerender, setSelectedKit } = renderWith({
        kits,
        selectedKit: null,
      });
      vi.advanceTimersByTime(2000);
      rerender({ kits: [...kits, { name: "C2" }], selectedKit: null });

      expect(hmr.restoreSelectedKitIfExists).toHaveBeenCalledTimes(1);
      expect(setSelectedKit).not.toHaveBeenCalled();
    });
  });

  describe("while the app runs", () => {
    it("saves the open kit", () => {
      const { rerender } = renderWith({ kits, selectedKit: null });

      rerender({ kits, selectedKit: "A0" });

      expect(hmr.getSavedSelectedKit()).toBe("A0");
    });

    it("forgets the kit when the user closes it", () => {
      const { rerender, setSelectedKit } = renderWith({
        kits,
        selectedKit: null,
      });
      rerender({ kits, selectedKit: "A0" });

      rerender({ kits, selectedKit: null });
      expect(hmr.getSavedSelectedKit()).toBeNull();

      // So the next reload leaves the kit browser open
      renderWith({ kits: [], selectedKit: null }, setSelectedKit).rerender({
        kits,
        selectedKit: null,
      });
      expect(setSelectedKit).not.toHaveBeenCalled();
    });
  });

  describe("in a production build (no HMR)", () => {
    beforeEach(() => {
      vi.mocked(hmr.isHmrAvailable).mockReturnValue(false);
    });

    afterEach(() => {
      // Back to the real check (true under Vitest's jsdom environment)
      vi.mocked(hmr.isHmrAvailable).mockReset();
    });

    it("neither saves nor restores", () => {
      hmr.saveSelectedKitState("B1");

      const { rerender, setSelectedKit } = renderWith({
        kits: [],
        selectedKit: null,
      });
      rerender({ kits, selectedKit: null });
      rerender({ kits, selectedKit: "A0" });

      expect(hmr.restoreSelectedKitIfExists).not.toHaveBeenCalled();
      expect(setSelectedKit).not.toHaveBeenCalled();
      expect(hmr.getSavedSelectedKit()).toBe("B1");
    });
  });
});

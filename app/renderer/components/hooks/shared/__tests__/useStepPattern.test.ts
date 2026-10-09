import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { STEPS_NOT_SAVED, useStepPattern } from "../useStepPattern";

// Mock the step pattern constants
vi.mock("../stepPatternConstants", () => ({
  createDefaultStepPattern: vi.fn(() => [
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 1, 0, 0],
    [0, 0, 1, 1],
  ]),
  ensureValidStepPattern: vi.fn((pattern) => {
    if (!pattern) {
      return [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ];
    }
    return pattern;
  }),
}));

describe("useStepPattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-setup electronAPI mock after clearAllMocks
    setupElectronAPIMock();

    // Mock electronAPI using centralized mocks
    vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
      success: true,
    });

    // Mock console.error
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("initialization", () => {
    it("initializes with null pattern when no initial pattern provided", () => {
      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });

    it("initializes with provided initial pattern", () => {
      const initialPattern = [
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ];

      const { result } = renderHook(() =>
        useStepPattern({
          initialPattern,
          kitName: "A0",
        }),
      );

      expect(result.current.stepPattern).toEqual(initialPattern);
    });

    it("updates pattern when initialPattern prop changes", () => {
      const initialPattern1 = [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
      ];

      const initialPattern2 = [
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ];

      const { rerender, result } = renderHook(
        ({ initialPattern }) =>
          useStepPattern({ initialPattern, kitName: "A0" }),
        {
          initialProps: { initialPattern: initialPattern1 },
        },
      );

      expect(result.current.stepPattern).toEqual(initialPattern1);

      rerender({ initialPattern: initialPattern2 });

      expect(result.current.stepPattern).toEqual(initialPattern2);
    });
  });

  describe("updateStepPattern", () => {
    it("updates step pattern successfully", async () => {
      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "A0",
        newPattern,
      );
      expect(result.current.stepPattern).toEqual(newPattern);
    });

    it("does not call API when electronAPI is not available", async () => {
      vi.stubGlobal("electronAPI", undefined);

      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should remain at default pattern since API call was skipped
      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });

    it("does not call API when updateStepPattern method is not available", async () => {
      vi.stubGlobal("electronAPI", {
        ...globalThis.electronAPI,
        updateStepPattern: undefined,
      });

      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should remain at default pattern since API call was skipped
      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });

    it("does not call API when kitName is empty", async () => {
      const { result } = renderHook(() => useStepPattern({ kitName: "" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).not.toHaveBeenCalled();
      // Should remain at default pattern since API call was skipped
      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });

    it("reverts to initial pattern when API call fails", async () => {
      const initialPattern = [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
      ];

      vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
        error: "Database error",
        success: false,
      });

      const { result } = renderHook(() =>
        useStepPattern({
          initialPattern,
          kitName: "A0",
        }),
      );

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "A0",
        newPattern,
      );

      // Should revert to initial pattern after failure
      expect(result.current.stepPattern).toEqual(initialPattern);
      expect(console.error).not.toHaveBeenCalled();
    });

    it("reverts to initial pattern when API call throws exception", async () => {
      const initialPattern = [
        [1, 0, 1, 0],
        [0, 1, 0, 1],
      ];

      const apiError = new Error("Network error");
      vi.mocked(window.electronAPI.updateStepPattern).mockRejectedValue(
        apiError,
      );

      const { result } = renderHook(() =>
        useStepPattern({
          initialPattern,
          kitName: "A0",
        }),
      );

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "A0",
        newPattern,
      );

      // Should revert to initial pattern after exception
      expect(result.current.stepPattern).toEqual(initialPattern);
      expect(console.error).not.toHaveBeenCalled();
    });

    it("reverts to default pattern when no initial pattern and API fails", async () => {
      vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
        error: "Database error",
        success: false,
      });

      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should revert to default pattern (from ensureValidStepPattern)
      expect(result.current.stepPattern).toEqual([
        [1, 0, 1, 0],
        [0, 1, 0, 1],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
      ]);
    });
  });

  describe("dependency updates", () => {
    it("updates callback when kitName changes", async () => {
      const { rerender, result } = renderHook(
        ({ kitName }) => useStepPattern({ kitName }),
        {
          initialProps: { kitName: "A0" },
        },
      );

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "A0",
        newPattern,
      );

      // Clear previous calls
      vi.clearAllMocks();

      // Change kitName
      rerender({ kitName: "B0" });

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "B0",
        newPattern,
      );
    });

    it("updates callback when initialPattern changes", async () => {
      const initialPattern1 = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
      ];

      const initialPattern2 = [
        [0, 0, 1, 0],
        [0, 0, 0, 1],
      ];

      vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
        error: "Test error",
        success: false,
      });

      const { rerender, result } = renderHook(
        ({ initialPattern }) =>
          useStepPattern({ initialPattern, kitName: "A0" }),
        {
          initialProps: { initialPattern: initialPattern1 },
        },
      );

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should revert to first initial pattern
      expect(result.current.stepPattern).toEqual(initialPattern1);

      // Change initial pattern
      rerender({ initialPattern: initialPattern2 });

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      // Should revert to second initial pattern
      expect(result.current.stepPattern).toEqual(initialPattern2);
    });
  });

  describe("onSaved callback", () => {
    it("[Q-01] [UC-30] passes on the kit main returned with the save (#452)", async () => {
      const edited = { name: "A0", step_pattern: [[1]] };
      vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
        data: edited as never,
        success: true,
      });
      const onSaved = vi.fn();
      const { result } = renderHook(() =>
        useStepPattern({ kitName: "A0", onSaved }),
      );

      await act(async () => {
        await result.current.setStepPattern([[1]]);
      });

      expect(onSaved).toHaveBeenCalledWith(edited);
    });

    it("calls onSaved after successful save", async () => {
      const onSaved = vi.fn();
      const { result } = renderHook(() =>
        useStepPattern({ kitName: "A0", onSaved }),
      );

      const newPattern = [
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ];

      await act(async () => {
        await result.current.setStepPattern(newPattern);
      });

      expect(window.electronAPI.updateStepPattern).toHaveBeenCalledWith(
        "A0",
        newPattern,
      );
      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("does not call onSaved when API returns failure", async () => {
      vi.mocked(window.electronAPI.updateStepPattern).mockResolvedValue({
        error: "Database error",
        success: false,
      });

      const onSaved = vi.fn();
      const initialPattern = [[1, 0]];
      const { result } = renderHook(() =>
        useStepPattern({
          initialPattern,
          kitName: "A0",
          onSaved,
        }),
      );

      await act(async () => {
        await result.current.setStepPattern([[0, 1]]);
      });

      expect(onSaved).not.toHaveBeenCalled();
    });

    it("does not call onSaved when API throws exception", async () => {
      vi.mocked(window.electronAPI.updateStepPattern).mockRejectedValue(
        new Error("Network error"),
      );

      const onSaved = vi.fn();
      const initialPattern = [[1, 0]];
      const { result } = renderHook(() =>
        useStepPattern({
          initialPattern,
          kitName: "A0",
          onSaved,
        }),
      );

      await act(async () => {
        await result.current.setStepPattern([[0, 1]]);
      });

      expect(onSaved).not.toHaveBeenCalled();
    });
  });

  describe("hook return interface", () => {
    it("returns correct interface structure", () => {
      const { result } = renderHook(() => useStepPattern({ kitName: "A0" }));

      expect(result.current).toHaveProperty("stepPattern");
      expect(result.current).toHaveProperty("setStepPattern");
      expect(typeof result.current.setStepPattern).toBe("function");
    });

    it("maintains stable function reference", () => {
      const { rerender, result } = renderHook(() =>
        useStepPattern({ kitName: "A0" }),
      );

      const firstSetStepPattern = result.current.setStepPattern;

      rerender();

      const secondSetStepPattern = result.current.setStepPattern;

      expect(firstSetStepPattern).toBe(secondSetStepPattern);
    });
  });

  describe("[UC-30] [UC-36] a step edit that isn't saved says so (#511)", () => {
    const saved = [
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const edit = (n: number) => [
      [1, ...Array.from({ length: 3 }, (_, i) => (i < n ? 1 : 0))],
      [0, 0, 0, 0],
    ];

    it("puts the saved steps back and tells the user once when main refuses", async () => {
      vi.mocked(globalThis.electronAPI.updateStepPattern).mockResolvedValue({
        error: "disk full",
        success: false,
      });
      const onMessage = vi.fn();
      const onSaved = vi.fn();
      const { result } = renderHook(() =>
        useStepPattern({
          initialPattern: saved,
          kitName: "A0",
          onMessage,
          onSaved,
        }),
      );

      await act(async () => {
        await result.current.setStepPattern(edit(1));
      });

      expect(result.current.stepPattern).toEqual(saved);
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(STEPS_NOT_SAVED, "error");
      expect(STEPS_NOT_SAVED).toBe(
        "Couldn't save the steps, so they're back as they were. Try again.",
      );
      expect(onSaved).not.toHaveBeenCalled();
    });

    it("tells the user when the save throws", async () => {
      vi.mocked(globalThis.electronAPI.updateStepPattern).mockRejectedValue(
        new Error("IPC gone"),
      );
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useStepPattern({ initialPattern: saved, kitName: "A0", onMessage }),
      );

      await act(async () => {
        await result.current.setStepPattern(edit(2));
      });

      expect(result.current.stepPattern).toEqual(saved);
      expect(onMessage).toHaveBeenCalledWith(STEPS_NOT_SAVED, "error");
      expect(String(onMessage.mock.calls[0][0])).not.toMatch(/IPC gone|Error/);
    });

    it("gives one message for several quick edits that all fail", async () => {
      vi.mocked(globalThis.electronAPI.updateStepPattern).mockResolvedValue({
        error: "disk full",
        success: false,
      });
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useStepPattern({ initialPattern: saved, kitName: "A0", onMessage }),
      );

      await act(async () => {
        await Promise.all([
          result.current.setStepPattern(edit(1)),
          result.current.setStepPattern(edit(2)),
          result.current.setStepPattern(edit(3)),
        ]);
      });

      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(result.current.stepPattern).toEqual(saved);
    });

    it("goes back to the last saved steps, not the ones the kit loaded with", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useStepPattern({ initialPattern: saved, kitName: "A0", onMessage }),
      );

      await act(async () => {
        await result.current.setStepPattern(edit(1));
      });
      vi.mocked(globalThis.electronAPI.updateStepPattern).mockResolvedValueOnce(
        {
          error: "disk full",
          success: false,
        },
      );
      await act(async () => {
        await result.current.setStepPattern(edit(3));
      });

      expect(result.current.stepPattern).toEqual(edit(1));
      expect(onMessage).toHaveBeenCalledTimes(1);
    });

    it("says nothing when the steps are saved", async () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() =>
        useStepPattern({ initialPattern: saved, kitName: "A0", onMessage }),
      );

      await act(async () => {
        await result.current.setStepPattern(edit(1));
      });

      expect(result.current.stepPattern).toEqual(edit(1));
      expect(onMessage).not.toHaveBeenCalled();
    });
  });

  // A kit that comes back while a step edit is saving (another save's, or
  // an older read) doesn't take that edit off screen (#778)
  describe("[UC-30] [Q-01] a step still saving stays on screen (#778)", () => {
    type Answer = { data?: never; error?: string; success: boolean };
    const off = [[0, 0, 0, 0]];
    const withA = [[127, 0, 0, 0]];
    const withAB = [[127, 127, 0, 0]];

    // Each save waits until the test answers it
    function deferSaves() {
      const answers: ((answer: Answer) => void)[] = [];
      vi.mocked(globalThis.electronAPI.updateStepPattern).mockImplementation(
        () =>
          new Promise((resolve) => {
            answers.push(resolve);
          }),
      );
      return answers;
    }

    function renderSteps(onMessage = vi.fn()) {
      return renderHook(
        ({ initialPattern, kitName }) =>
          useStepPattern({ initialPattern, kitName, onMessage }),
        { initialProps: { initialPattern: off, kitName: "A0" } },
      );
    }

    it("keeps the second toggle on when the first save's kit comes back first", async () => {
      const answers = deferSaves();
      const { rerender, result } = renderSteps();

      let first: Promise<boolean> | undefined;
      let second: Promise<boolean> | undefined;
      act(() => {
        first = result.current.setStepPattern(withA);
      });
      act(() => {
        second = result.current.setStepPattern(withAB);
      });
      await act(async () => {
        answers[0]({ data: { step_pattern: withA } as never, success: true });
        await first;
      });
      // The kit as the first save left it: A, not B
      rerender({ initialPattern: [[127, 0, 0, 0]], kitName: "A0" });
      expect(result.current.stepPattern).toEqual(withAB);

      await act(async () => {
        answers[1]({ success: true });
        await second;
      });
      rerender({ initialPattern: [[127, 127, 0, 0]], kitName: "A0" });
      expect(result.current.stepPattern).toEqual(withAB);
    });

    it("keeps both toggles when the saves answer out of order", async () => {
      const answers = deferSaves();
      const { rerender, result } = renderSteps();

      let first: Promise<boolean> | undefined;
      let second: Promise<boolean> | undefined;
      act(() => {
        first = result.current.setStepPattern(withA);
        second = result.current.setStepPattern(withAB);
      });
      await act(async () => {
        answers[1]({ success: true });
        await second;
      });
      rerender({ initialPattern: [[127, 127, 0, 0]], kitName: "A0" });
      expect(result.current.stepPattern).toEqual(withAB);

      // A read sent before B lands while A is still saving
      rerender({ initialPattern: [[0, 0, 0, 0]], kitName: "A0" });
      expect(result.current.stepPattern).toEqual(withAB);

      await act(async () => {
        answers[0]({ success: true });
        await first;
      });
      expect(result.current.stepPattern).toEqual(withAB);
    });

    it("puts back only the toggle whose save failed", async () => {
      const answers = deferSaves();
      const onMessage = vi.fn();
      const { rerender, result } = renderSteps(onMessage);

      let first: Promise<boolean> | undefined;
      let second: Promise<boolean> | undefined;
      act(() => {
        first = result.current.setStepPattern(withA);
      });
      act(() => {
        second = result.current.setStepPattern(withAB);
      });
      await act(async () => {
        answers[0]({ success: true });
        await first;
      });
      // A reload sent before either toggle lands while B is saving
      rerender({ initialPattern: [[0, 0, 0, 0]], kitName: "A0" });
      expect(result.current.stepPattern).toEqual(withAB);
      await act(async () => {
        answers[1]({ error: "disk full", success: false });
        await second;
      });

      expect(result.current.stepPattern).toEqual(withA);
      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(STEPS_NOT_SAVED, "error");
    });

    it("keeps a toggle still saving over an older reload, then shows the kit", async () => {
      const answers = deferSaves();
      const { rerender, result } = renderSteps();

      let saving: Promise<boolean> | undefined;
      act(() => {
        saving = result.current.setStepPattern(withA);
      });
      // A reload sent before the toggle, with something else changed
      rerender({ initialPattern: [[0, 0, 0, 127]], kitName: "A0" });
      expect(result.current.stepPattern).toEqual(withA);

      await act(async () => {
        answers[0]({ success: true });
        await saving;
      });
      // The kit the save returned
      rerender({ initialPattern: [[127, 0, 0, 127]], kitName: "A0" });
      expect(result.current.stepPattern).toEqual([[127, 0, 0, 127]]);
    });

    it("shows another kit's steps while this kit's toggle saves", async () => {
      const answers = deferSaves();
      const { rerender, result } = renderSteps();

      let saving: Promise<boolean> | undefined;
      act(() => {
        saving = result.current.setStepPattern(withA);
      });
      rerender({ initialPattern: [[0, 0, 127, 0]], kitName: "A1" });
      expect(result.current.stepPattern).toEqual([[0, 0, 127, 0]]);

      await act(async () => {
        answers[0]({ success: true });
        await saving;
      });
      expect(result.current.stepPattern).toEqual([[0, 0, 127, 0]]);
    });
  });

  // The sequencer's undo history keeps only saved edits (#570)
  describe("[UC-26] resolves to whether the steps were saved", () => {
    const pattern = [[127, 0, 0, 0]];
    const initialPattern = [[0, 0, 0, 0]];

    it("is true once main saves them, false when it refuses", async () => {
      const { result } = renderHook(() =>
        useStepPattern({ initialPattern, kitName: "A0" }),
      );
      vi.mocked(globalThis.electronAPI.updateStepPattern).mockResolvedValueOnce(
        { success: true },
      );
      let saved: boolean | undefined;
      await act(async () => {
        saved = await result.current.setStepPattern(pattern);
      });
      expect(saved).toBe(true);

      vi.mocked(globalThis.electronAPI.updateStepPattern).mockResolvedValueOnce(
        { error: "disk full", success: false },
      );
      await act(async () => {
        saved = await result.current.setStepPattern([[0, 127, 0, 0]]);
      });
      expect(saved).toBe(false);
    });

    it("is false when another kit opened while saving", async () => {
      let answer: (value: { success: boolean }) => void = () => {};
      vi.mocked(globalThis.electronAPI.updateStepPattern).mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve;
        }),
      );
      const { rerender, result } = renderHook(
        ({ kitName }) => useStepPattern({ initialPattern: null, kitName }),
        { initialProps: { kitName: "A0" } },
      );

      let pending: Promise<boolean> | undefined;
      act(() => {
        pending = result.current.setStepPattern(pattern);
      });
      rerender({ kitName: "A1" });
      let saved: boolean | undefined;
      await act(async () => {
        answer({ success: true });
        saved = await pending;
      });

      expect(saved).toBe(false);
    });
  });
});

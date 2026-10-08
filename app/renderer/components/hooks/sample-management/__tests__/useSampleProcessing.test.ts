import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleProcessing } from "../useSampleProcessing";

describe("useSampleProcessing", () => {
  const makeOptions = () => ({
    kitName: "Test Kit",
    onSampleAdd: vi.fn().mockResolvedValue(true),
    voice: 1,
  });

  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(globalThis.electronAPI.getAllSamplesForKit).mockResolvedValue({
      data: [
        { source_path: "/path/sample1.wav", voice_number: 1 },
        { source_path: "/path/sample3.wav", voice_number: 1 },
      ],
      success: true,
    } as never);
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  describe("[Q-07] getCurrentKitSamples", () => {
    it("returns the kit's samples", async () => {
      const { result } = renderHook(() => useSampleProcessing(makeOptions()));

      const samples = await result.current.getCurrentKitSamples();

      expect(globalThis.electronAPI.getAllSamplesForKit).toHaveBeenCalledWith(
        "Test Kit",
      );
      expect(samples).toEqual([
        { source_path: "/path/sample1.wav", voice_number: 1 },
        { source_path: "/path/sample3.wav", voice_number: 1 },
      ]);
    });

    it("returns null without an error when the API is missing", async () => {
      const original = globalThis.electronAPI.getAllSamplesForKit;
      (
        globalThis.electronAPI as { getAllSamplesForKit?: unknown }
      ).getAllSamplesForKit = undefined;
      try {
        const { result } = renderHook(() => useSampleProcessing(makeOptions()));

        expect(await result.current.getCurrentKitSamples()).toBeNull();
        expect(consoleError).not.toHaveBeenCalled();
      } finally {
        globalThis.electronAPI.getAllSamplesForKit = original;
      }
    });

    it("returns null when main can't read the kit, logging the reason as a warning", async () => {
      vi.mocked(globalThis.electronAPI.getAllSamplesForKit).mockResolvedValue({
        error: "API Error",
        success: false,
      });
      const { result } = renderHook(() => useSampleProcessing(makeOptions()));

      expect(await result.current.getCurrentKitSamples()).toBeNull();
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("[SampleProcessing]"),
        "API Error",
      );
    });

    it("returns an empty array when main returns no data", async () => {
      vi.mocked(globalThis.electronAPI.getAllSamplesForKit).mockResolvedValue({
        data: null,
        success: true,
      } as never);
      const { result } = renderHook(() => useSampleProcessing(makeOptions()));

      expect(await result.current.getCurrentKitSamples()).toEqual([]);
    });
  });

  describe("[Q-07] isDuplicateSample", () => {
    it("finds a file already in this voice, without logging", async () => {
      const { result } = renderHook(() => useSampleProcessing(makeOptions()));

      const isDupe = await result.current.isDuplicateSample(
        [
          { source_path: "/path/existing.wav", voice_number: 1 },
          { source_path: "/path/other.wav", voice_number: 2 },
        ],
        "/path/existing.wav",
      );

      expect(isDupe).toBe(true);
      expect(consoleWarn).not.toHaveBeenCalled();
    });

    it("returns false for a new file", async () => {
      const { result } = renderHook(() => useSampleProcessing(makeOptions()));

      const isDupe = await result.current.isDuplicateSample(
        [{ source_path: "/path/existing.wav", voice_number: 1 }],
        "/path/new.wav",
      );

      expect(isDupe).toBe(false);
    });

    it("ignores the same file in another voice", async () => {
      const { result } = renderHook(() => useSampleProcessing(makeOptions()));

      const isDupe = await result.current.isDuplicateSample(
        [{ source_path: "/path/sample.wav", voice_number: 2 }],
        "/path/sample.wav",
      );

      expect(isDupe).toBe(false);
    });
  });

  describe("[UC-19] [Q-07] processAssignment", () => {
    it("adds the file to the slot and resolves true when it was added", async () => {
      const options = makeOptions();
      const { result } = renderHook(() => useSampleProcessing(options));

      const added = await result.current.processAssignment("/path/new.wav", 1);

      expect(added).toBe(true);
      expect(options.onSampleAdd).toHaveBeenCalledWith(1, 1, "/path/new.wav");
    });

    it("resolves false when the add is refused", async () => {
      const options = makeOptions();
      options.onSampleAdd.mockResolvedValue(false);
      const { result } = renderHook(() => useSampleProcessing(options));

      const added = await result.current.processAssignment("/path/new.wav", 1);

      expect(added).toBe(false);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("resolves false when nothing can add samples", async () => {
      const { result } = renderHook(() =>
        useSampleProcessing({ ...makeOptions(), onSampleAdd: undefined }),
      );

      expect(await result.current.processAssignment("/path/new.wav", 1)).toBe(
        false,
      );
    });

    it("lets an unexpected failure reach the drop, which reports it", async () => {
      const options = makeOptions();
      options.onSampleAdd.mockRejectedValue(new Error("boom"));
      const { result } = renderHook(() => useSampleProcessing(options));

      await expect(
        result.current.processAssignment("/path/new.wav", 1),
      ).rejects.toThrow("boom");
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  it("[Q-07] returns only what the drop uses", () => {
    const { result } = renderHook(() => useSampleProcessing(makeOptions()));

    expect(Object.keys(result.current).sort()).toEqual([
      "getCurrentKitSamples",
      "isDuplicateSample",
      "processAssignment",
    ]);
  });
});

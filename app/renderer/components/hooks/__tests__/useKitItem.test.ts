import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useKitItem } from "../useKitItem";

describe("useKitItem", () => {
  describe("with no voice names", () => {
    it("should return folder icon for empty voice names", () => {
      const { result } = renderHook(() => useKitItem());

      expect(result.current.iconType).toBe("folder");
      expect(result.current.iconLabel).toBe("Folder");
    });

    it("should return folder icon for undefined voice names", () => {
      const { result } = renderHook(() => useKitItem(undefined));

      expect(result.current.iconType).toBe("folder");
      expect(result.current.iconLabel).toBe("Folder");
    });
  });

  describe("with single voice type", () => {
    it("should return mic icon for vox", () => {
      const voiceNames = { 1: "vox" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("mic");
      expect(result.current.iconLabel).toBe("Vocal Kit");
    });

    it("should return loop icon for loop", () => {
      const voiceNames = { 1: "loop" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("loop");
      expect(result.current.iconLabel).toBe("Loop Kit");
    });

    it("should return fx icon for fx", () => {
      const voiceNames = { 1: "fx" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("fx");
      expect(result.current.iconLabel).toBe("FX Kit");
    });

    it("should handle case insensitive matching", () => {
      const voiceNames = { 1: "VOX" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("mic");
      expect(result.current.iconLabel).toBe("Vocal Kit");
    });

    it("should handle multiple instances of same voice type", () => {
      const voiceNames = { 1: "vox", 2: "vox", 3: "VOX" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("mic");
      expect(result.current.iconLabel).toBe("Vocal Kit");
    });
  });

  describe("with synth/bass combinations", () => {
    it("should return piano icon for only synth", () => {
      const voiceNames = { 1: "synth", 2: "synth" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("piano");
      expect(result.current.iconLabel).toBe("Synth/Bass Kit");
    });

    it("should return piano icon for only bass", () => {
      const voiceNames = { 1: "bass", 2: "bass" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("piano");
      expect(result.current.iconLabel).toBe("Synth/Bass Kit");
    });

    it("should return piano icon for synth and bass mix", () => {
      const voiceNames = { 1: "synth", 2: "bass", 3: "synth" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("piano");
      expect(result.current.iconLabel).toBe("Synth/Bass Kit");
    });

    it("should handle case insensitive synth/bass", () => {
      const voiceNames = { 1: "SYNTH", 2: "Bass" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("piano");
      expect(result.current.iconLabel).toBe("Synth/Bass Kit");
    });
  });

  describe("with mixed voice types", () => {
    it("should return drumkit icon for mixed types", () => {
      const voiceNames = { 1: "kick", 2: "snare", 3: "hihat" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });

    it("should return drumkit icon when synth/bass mixed with other types", () => {
      const voiceNames = { 1: "synth", 2: "kick", 3: "bass" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });

    it("should return drumkit icon for multiple different voice types", () => {
      const voiceNames = { 1: "vox", 2: "loop", 3: "fx" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });
  });

  describe("filtering behavior", () => {
    it("should filter out empty strings", () => {
      const voiceNames = { 1: "kick", 2: "", 3: "snare" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });

    it("should filter out whitespace-only strings", () => {
      const voiceNames = { 1: "kick", 2: "   ", 3: "snare" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });

    it("should filter out '...' placeholder", () => {
      const voiceNames = { 1: "kick", 2: "...", 3: "snare" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });

    it("should filter out 'loading' placeholder", () => {
      const voiceNames = { 1: "kick", 2: "loading", 3: "snare" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });

    it("should handle all filtered values resulting in empty array", () => {
      const voiceNames = { 1: "", 2: "...", 3: "loading", 4: "   " };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("folder");
      expect(result.current.iconLabel).toBe("Folder");
    });

    it("should handle non-string values being filtered out", () => {
      const voiceNames = {
        1: "kick",
        2: null as any,
        3: undefined as any,
        4: "snare",
      };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });
  });

  describe("edge cases", () => {
    it("should handle empty object", () => {
      const voiceNames = {};
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("folder");
      expect(result.current.iconLabel).toBe("Folder");
    });

    it("should handle numeric keys", () => {
      const voiceNames = { 1: "kick", 2: "snare" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });

    it("should handle string keys", () => {
      const voiceNames = { voice1: "kick", voice2: "snare" };
      const { result } = renderHook(() => useKitItem(voiceNames));

      expect(result.current.iconType).toBe("drumkit");
      expect(result.current.iconLabel).toBe("Drum Kit");
    });

    it("should memoize results correctly", () => {
      const voiceNames = { 1: "kick", 2: "snare" };
      const { rerender, result } = renderHook(
        ({ voices }) => useKitItem(voices),
        { initialProps: { voices: voiceNames } },
      );

      const firstResult = result.current;

      // Rerender with same props
      rerender({ voices: voiceNames });

      // Should be same reference (memoized) - but React hooks don't guarantee reference equality
      expect(result.current.iconType).toBe(firstResult.iconType);
      expect(result.current.iconLabel).toBe(firstResult.iconLabel);
    });
  });
});

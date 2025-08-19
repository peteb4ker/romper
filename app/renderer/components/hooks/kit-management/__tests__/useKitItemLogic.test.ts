import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useKitItem } from "../useKitItem";

describe("useKitItem", () => {
  it("returns folder iconType and label if no voiceNames", () => {
    const { result } = renderHook(() => useKitItem(undefined));
    expect(result.current.iconType).toBe("folder");
    expect(result.current.iconLabel).toBe("Folder");
  });
  it("returns correct iconType/label for vocal kit", () => {
    const { result } = renderHook(() =>
      useKitItem({ 1: "vox", 2: "vox", 3: "vox", 4: "vox" })
    );
    expect(result.current.iconType).toBe("mic");
    expect(result.current.iconLabel).toBe("Vocal Kit");
  });
  it("returns correct iconType/label for loop kit", () => {
    const { result } = renderHook(() =>
      useKitItem({ 1: "loop", 2: "loop", 3: "loop", 4: "loop" })
    );
    expect(result.current.iconType).toBe("loop");
    expect(result.current.iconLabel).toBe("Loop Kit");
  });
  it("returns correct iconType/label for fx kit", () => {
    const { result } = renderHook(() =>
      useKitItem({ 1: "fx", 2: "fx", 3: "fx", 4: "fx" })
    );
    expect(result.current.iconType).toBe("fx");
    expect(result.current.iconLabel).toBe("FX Kit");
  });
  it("returns correct iconType/label for synth/bass kit", () => {
    const { result } = renderHook(() =>
      useKitItem({ 1: "synth", 2: "bass", 3: "synth", 4: "bass" })
    );
    expect(result.current.iconType).toBe("piano");
    expect(result.current.iconLabel).toBe("Synth/Bass Kit");
  });
  it("returns drumkit iconType/label for mixed or other", () => {
    const { result } = renderHook(() =>
      useKitItem({ 1: "kick", 2: "snare", 3: "hat", 4: "perc" })
    );
    expect(result.current.iconType).toBe("drumkit");
    expect(result.current.iconLabel).toBe("Drum Kit");
  });
});

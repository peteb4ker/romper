import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSlotRendering } from "../useSlotRendering";

describe("useSlotRendering", () => {
  const defaultProps = {
    defaultToMonoSamples: false,
    dragOverSlot: null,
    dropZone: null,
    isActive: true,
    isStereoDragTarget: false,
    samples: ["kick.wav", "snare.wav", "", ""],
    selectedIdx: 0,
    stereoDragSlotNumber: undefined,
    voice: 1,
  };

  describe("calculateRenderSlots", () => {
    it("calculates correct slots for samples with gaps", () => {
      const { result } = renderHook(() => useSlotRendering(defaultProps));

      const { nextAvailableSlot, slotsToRender } =
        result.current.calculateRenderSlots();

      expect(nextAvailableSlot).toBe(2); // First empty slot after snare.wav
      expect(slotsToRender).toBe(12); // Always 12 slots for fixed height UI
    });

    it("handles empty samples array", () => {
      const { result } = renderHook(() =>
        useSlotRendering({ ...defaultProps, samples: [] }),
      );

      const { nextAvailableSlot, slotsToRender } =
        result.current.calculateRenderSlots();

      expect(nextAvailableSlot).toBe(0);
      expect(slotsToRender).toBe(12); // Always 12 slots for fixed height UI
    });

    it("limits slots to maximum of 12", () => {
      const fullSamples = Array(15).fill("sample.wav");
      const { result } = renderHook(() =>
        useSlotRendering({ ...defaultProps, samples: fullSamples }),
      );

      const { slotsToRender } = result.current.calculateRenderSlots();

      expect(slotsToRender).toBe(12); // Always 12 slots maximum, excess samples not shown
    });

    it("handles samples with empty strings correctly", () => {
      const samplesWithEmptyStrings = ["kick.wav", "", "hat.wav", ""];
      const { result } = renderHook(() =>
        useSlotRendering({
          ...defaultProps,
          samples: samplesWithEmptyStrings,
        }),
      );

      const { nextAvailableSlot, slotsToRender } =
        result.current.calculateRenderSlots();

      expect(nextAvailableSlot).toBe(3); // After hat.wav at index 2
      expect(slotsToRender).toBe(12); // Always 12 slots for fixed height UI
    });

    it("shows exactly 12 slots when voice has 12 samples", () => {
      const fullSamples = Array(12).fill("sample.wav");
      const { result } = renderHook(() =>
        useSlotRendering({ ...defaultProps, samples: fullSamples }),
      );

      const { slotsToRender } = result.current.calculateRenderSlots();

      expect(slotsToRender).toBe(12); // 12 filled samples, no empty slot shown when at limit
    });
  });

  describe("getSlotStyling", () => {
    it("returns basic styling for normal slot", () => {
      const { result } = renderHook(() => useSlotRendering(defaultProps));

      const styling = result.current.getSlotStyling(0, "kick.wav");

      expect(styling.slotBaseClass).toBe(
        "truncate flex items-center gap-2 mb-1 min-h-[28px]",
      );
      expect(styling.dragOverClass).toBe("");
      expect(styling.isDragOver).toBe(false);
      expect(styling.isDropZone).toBe(false);
      expect(styling.isStereoHighlight).toBe(false);
    });

    it("applies drag over styling", () => {
      const { result } = renderHook(() =>
        useSlotRendering({ ...defaultProps, dragOverSlot: 0 }),
      );

      const styling = result.current.getSlotStyling(0, "kick.wav");

      expect(styling.isDragOver).toBe(true);
      expect(styling.dragOverClass).toContain("bg-orange-100");
    });

    it("applies drop zone styling for insert mode", () => {
      const { result } = renderHook(() =>
        useSlotRendering({
          ...defaultProps,
          dropZone: { mode: "insert", slot: 0 },
        }),
      );

      const styling = result.current.getSlotStyling(0, "kick.wav");

      expect(styling.isDropZone).toBe(true);
      expect(styling.dragOverClass).toContain("bg-green-100");
      expect(styling.dropHintTitle).toBe(
        "Insert sample here (other samples will shift down)",
      );
    });

    it("applies drop zone styling for append mode", () => {
      const { result } = renderHook(() =>
        useSlotRendering({
          ...defaultProps,
          dropZone: { mode: "append", slot: 0 },
        }),
      );

      const styling = result.current.getSlotStyling(0, "kick.wav");

      expect(styling.isDropZone).toBe(true);
      expect(styling.dragOverClass).toContain("bg-blue-100");
      expect(styling.dropHintTitle).toBe("Add sample to end of voice");
    });

    it("applies drop zone styling for blocked mode", () => {
      const { result } = renderHook(() =>
        useSlotRendering({
          ...defaultProps,
          dropZone: { mode: "blocked", slot: 0 },
        }),
      );

      const styling = result.current.getSlotStyling(0, "kick.wav");

      expect(styling.isDropZone).toBe(true);
      expect(styling.dragOverClass).toContain("bg-red-100");
      expect(styling.dropHintTitle).toBe("Voice is full (12 samples maximum)");
    });

    it("applies stereo highlight styling", () => {
      const { result } = renderHook(() =>
        useSlotRendering({
          ...defaultProps,
          isStereoDragTarget: true,
          stereoDragSlotNumber: 0,
        }),
      );

      const styling = result.current.getSlotStyling(0, "kick.wav");

      expect(styling.isStereoHighlight).toBe(true);
      expect(styling.dragOverClass).toContain("bg-purple-100");
      expect(styling.dropHintTitle).toBe("Left channel of stereo pair");
    });

    it("shows right channel hint for voice > 1", () => {
      const { result } = renderHook(() =>
        useSlotRendering({
          ...defaultProps,
          isStereoDragTarget: true,
          stereoDragSlotNumber: 0,
          voice: 2,
        }),
      );

      const styling = result.current.getSlotStyling(0, "kick.wav");

      expect(styling.dropHintTitle).toBe("Right channel of stereo pair");
    });
  });

  describe("getSampleSlotClassName", () => {
    it("applies selected styling when slot is selected and active", () => {
      const { result } = renderHook(() => useSlotRendering(defaultProps));

      const className = result.current.getSampleSlotClassName(
        0,
        "base-class",
        "",
      );

      expect(className).toContain("bg-blue-100");
      expect(className).toContain("font-bold");
      expect(className).toContain("ring-2");
    });

    it("does not apply selected styling when not active", () => {
      const { result } = renderHook(() =>
        useSlotRendering({ ...defaultProps, isActive: false }),
      );

      const className = result.current.getSampleSlotClassName(
        0,
        "base-class",
        "",
      );

      expect(className).not.toContain("bg-blue-100");
      expect(className).not.toContain("font-bold");
    });

    it("does not apply selected styling when different slot is selected", () => {
      const { result } = renderHook(() =>
        useSlotRendering({ ...defaultProps, selectedIdx: 1 }),
      );

      const className = result.current.getSampleSlotClassName(
        0,
        "base-class",
        "",
      );

      expect(className).not.toContain("bg-blue-100");
      expect(className).not.toContain("font-bold");
    });

    it("includes drag over class when provided", () => {
      const { result } = renderHook(() => useSlotRendering(defaultProps));

      const className = result.current.getSampleSlotClassName(
        0,
        "base-class",
        " drag-over-class",
      );

      expect(className).toContain("drag-over-class");
    });
  });

  describe("getSampleSlotTitle", () => {
    const sampleData = {
      source_path: "/path/to/kick.wav",
    };

    it("returns basic slot title without sample data", () => {
      const { result } = renderHook(() => useSlotRendering(defaultProps));

      const title = result.current.getSampleSlotTitle(
        1,
        undefined,
        false,
        false,
        false,
        "",
      );

      expect(title).toBe("Slot 1");
    });

    it("includes source path in title when sample data is available", () => {
      const { result } = renderHook(() => useSlotRendering(defaultProps));

      const title = result.current.getSampleSlotTitle(
        1,
        sampleData,
        false,
        false,
        false,
        "",
      );

      expect(title).toBe("Slot 1\nSource: /path/to/kick.wav");
    });

    it("returns drop hint title when dragging over", () => {
      const { result } = renderHook(() => useSlotRendering(defaultProps));

      const title = result.current.getSampleSlotTitle(
        1,
        sampleData,
        true,
        false,
        false,
        "Custom drop hint",
      );

      expect(title).toBe("Custom drop hint");
    });

    it("returns drop hint title when stereo highlighting", () => {
      const { result } = renderHook(() => useSlotRendering(defaultProps));

      const title = result.current.getSampleSlotTitle(
        1,
        sampleData,
        false,
        true,
        false,
        "Stereo hint",
      );

      expect(title).toBe("Stereo hint");
    });

    it("returns drop hint title when in drop zone", () => {
      const { result } = renderHook(() => useSlotRendering(defaultProps));

      const title = result.current.getSampleSlotTitle(
        1,
        sampleData,
        false,
        false,
        true,
        "Drop zone hint",
      );

      expect(title).toBe("Drop zone hint");
    });
  });
});

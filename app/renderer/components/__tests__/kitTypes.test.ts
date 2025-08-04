import { describe, expect, it } from "vitest";

import type {
  KitDetailsProps,
  KitSamplePlanSlot,
  SampleData,
  VoiceSamples,
} from "../kitTypes";

describe("kitTypes", () => {
  describe("KitDetailsProps interface", () => {
    it("should allow valid KitDetailsProps objects", () => {
      const props: KitDetailsProps = {
        kitName: "Test Kit",
        onBack: () => {},
      };
      expect(props.kitName).toBe("Test Kit");
      expect(typeof props.onBack).toBe("function");
    });

    it("should allow optional properties", () => {
      const props: KitDetailsProps = {
        kitIndex: 5,
        kitName: "Test Kit",
        kits: [],
        onAddUndoAction: () => {},
        onBack: () => {},
        onNextKit: () => {},
        onPrevKit: () => {},
        onRequestSamplesReload: async () => {},
        samples: null,
      };
      expect(props.kitIndex).toBe(5);
      expect(props.kits).toEqual([]);
      expect(typeof props.onAddUndoAction).toBe("function");
      expect(typeof props.onNextKit).toBe("function");
      expect(typeof props.onPrevKit).toBe("function");
      expect(typeof props.onRequestSamplesReload).toBe("function");
      expect(props.samples).toBeNull();
    });
  });

  describe("KitSamplePlanSlot interface", () => {
    it("should allow valid KitSamplePlanSlot objects", () => {
      const slot: KitSamplePlanSlot = {
        source: "/path/to/source.wav",
        target: "/path/to/target.wav",
        voice: 1,
      };
      expect(slot.source).toBe("/path/to/source.wav");
      expect(slot.target).toBe("/path/to/target.wav");
      expect(slot.voice).toBe(1);
    });

    it("should allow optional properties", () => {
      const slot: KitSamplePlanSlot = {
        meta: { duration: 1.5, tempo: 120 },
        source: "/path/to/source.wav",
        target: "/path/to/target.wav",
        voice: 2,
        voiceType: "kick",
      };
      expect(slot.meta).toEqual({ duration: 1.5, tempo: 120 });
      expect(slot.voiceType).toBe("kick");
    });

    it("should enforce voice number range (1-4)", () => {
      const slot1: KitSamplePlanSlot = {
        source: "test.wav",
        target: "test.wav",
        voice: 1,
      };
      const slot4: KitSamplePlanSlot = {
        source: "test.wav",
        target: "test.wav",
        voice: 4,
      };
      expect(slot1.voice).toBe(1);
      expect(slot4.voice).toBe(4);
    });
  });

  describe("SampleData interface", () => {
    it("should allow valid SampleData objects", () => {
      const sample: SampleData = {
        filename: "sample.wav",
        source_path: "/path/to/sample.wav",
      };
      expect(sample.filename).toBe("sample.wav");
      expect(sample.source_path).toBe("/path/to/sample.wav");
    });

    it("should allow optional and additional properties", () => {
      const sample: SampleData = {
        // Additional properties via index signature
        duration: 2.5,
        filename: "stereo.wav",
        is_stereo: true,
        sampleRate: 44100,
        source_path: "/path/to/stereo.wav",
      };
      expect(sample.filename).toBe("stereo.wav");
      expect(sample.is_stereo).toBe(true);
      expect(sample.source_path).toBe("/path/to/stereo.wav");
      expect(sample.duration).toBe(2.5);
      expect(sample.sampleRate).toBe(44100);
    });
  });

  describe("VoiceSamples interface", () => {
    it("should allow valid VoiceSamples objects", () => {
      const voices: VoiceSamples = {
        1: ["kick.wav", "snare.wav"],
        2: ["hihat.wav"],
        3: [],
        4: ["cymbal.wav", "crash.wav", "ride.wav"],
      };
      expect(voices[1]).toEqual(["kick.wav", "snare.wav"]);
      expect(voices[2]).toEqual(["hihat.wav"]);
      expect(voices[3]).toEqual([]);
      expect(voices[4]).toEqual(["cymbal.wav", "crash.wav", "ride.wav"]);
    });

    it("should support numeric keys", () => {
      const voices: VoiceSamples = {};
      voices[1] = ["sample1.wav"];
      voices[2] = ["sample2.wav"];
      voices[3] = ["sample3.wav"];
      voices[4] = ["sample4.wav"];

      expect(Object.keys(voices).map(Number)).toEqual([1, 2, 3, 4]);
      expect(voices[1]).toEqual(["sample1.wav"]);
      expect(voices[4]).toEqual(["sample4.wav"]);
    });
  });
});

import { describe, expect, it } from "vitest";

import type { BaseKitItemProps, KitItemRenderProps } from "../kitItemUtils";

import { extractVoiceNames } from "../kitItemUtils";

type MockKitWithRelations = {
  voices?: MockVoice[];
};

// Mock the KitWithRelations type structure
type MockVoice = {
  voice_alias: null | string;
  voice_number: number;
};

describe("kitItemUtils", () => {
  describe("BaseKitItemProps interface", () => {
    it("should allow valid BaseKitItemProps objects", () => {
      const props: BaseKitItemProps = {
        isValid: true,
        kit: "A1",
        onDuplicate: () => {},
        onSelect: () => {},
      };
      expect(props.isValid).toBe(true);
      expect(props.kit).toBe("A1");
      expect(typeof props.onDuplicate).toBe("function");
      expect(typeof props.onSelect).toBe("function");
    });

    it("should allow optional properties", () => {
      const props: BaseKitItemProps = {
        isValid: false,
        kit: "B2",
        kitData: null,
        onDuplicate: () => {},
        onSelect: () => {},
        sampleCounts: [2, 3, 1, 0],
      };
      expect(props.kitData).toBeNull();
      expect(props.sampleCounts).toEqual([2, 3, 1, 0]);
    });
  });

  describe("KitItemRenderProps interface", () => {
    it("should allow valid KitItemRenderProps objects", () => {
      const props: KitItemRenderProps = {
        "data-kit": "C3",
        isSelected: true,
      };
      expect(props["data-kit"]).toBe("C3");
      expect(props.isSelected).toBe(true);
    });

    it("should allow empty props", () => {
      const props: KitItemRenderProps = {};
      expect(props["data-kit"]).toBeUndefined();
      expect(props.isSelected).toBeUndefined();
    });
  });

  describe("extractVoiceNames", () => {
    it("should return undefined for undefined kitData", () => {
      const result = extractVoiceNames(undefined);
      expect(result).toBeUndefined();
    });

    it("should return undefined for null kitData", () => {
      const result = extractVoiceNames(null);
      expect(result).toBeUndefined();
    });

    it("should return undefined for kitData without voices", () => {
      const kitData: MockKitWithRelations = {};
      const result = extractVoiceNames(kitData as unknown);
      expect(result).toBeUndefined();
    });

    it("should extract voice names from kitData with voices", () => {
      const kitData: MockKitWithRelations = {
        voices: [
          { voice_alias: "Kick", voice_number: 1 },
          { voice_alias: "Snare", voice_number: 2 },
          { voice_alias: "Hi-Hat", voice_number: 3 },
          { voice_alias: "Cymbal", voice_number: 4 },
        ],
      };
      const result = extractVoiceNames(kitData as unknown);
      expect(result).toEqual({
        1: "Kick",
        2: "Snare",
        3: "Hi-Hat",
        4: "Cymbal",
      });
    });

    it("should filter out voices with null alias", () => {
      const kitData: MockKitWithRelations = {
        voices: [
          { voice_alias: "Kick", voice_number: 1 },
          { voice_alias: null, voice_number: 2 },
          { voice_alias: "Hi-Hat", voice_number: 3 },
          { voice_alias: null, voice_number: 4 },
        ],
      };
      const result = extractVoiceNames(kitData as unknown);
      expect(result).toEqual({
        1: "Kick",
        3: "Hi-Hat",
      });
    });

    it("should return empty object for voices with all null aliases", () => {
      const kitData: MockKitWithRelations = {
        voices: [
          { voice_alias: null, voice_number: 1 },
          { voice_alias: null, voice_number: 2 },
          { voice_alias: null, voice_number: 3 },
          { voice_alias: null, voice_number: 4 },
        ],
      };
      const result = extractVoiceNames(kitData as unknown);
      expect(result).toEqual({});
    });

    it("should handle empty voices array", () => {
      const kitData: MockKitWithRelations = {
        voices: [],
      };
      const result = extractVoiceNames(kitData as unknown);
      expect(result).toEqual({});
    });

    it("should handle mixed voice numbers", () => {
      const kitData: MockKitWithRelations = {
        voices: [
          { voice_alias: "Second", voice_number: 2 },
          { voice_alias: "Fourth", voice_number: 4 },
          { voice_alias: "First", voice_number: 1 },
        ],
      };
      const result = extractVoiceNames(kitData as unknown);
      expect(result).toEqual({
        1: "First",
        2: "Second",
        4: "Fourth",
      });
    });
  });
});

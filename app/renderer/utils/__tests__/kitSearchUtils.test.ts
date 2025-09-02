import type { KitWithRelations } from "@romper/shared/db/schema";

import { describe, expect, it } from "vitest";

import type { SearchMatchDetails } from "../../components/shared/kitItemUtils";

import {
  checkKitBasicFields,
  checkKitSamples,
  checkKitVoices,
  filterKitsWithSearch,
} from "../kitSearchUtils";

describe("kitSearchUtils", () => {
  const mockKit: KitWithRelations = {
    alias: "Custom Kit",
    bank: {
      artist: "Test Artist",
      letter: "A",
      rtf_filename: "test.rtf",
      scanned_at: null,
    },
    bank_letter: "A",
    bpm: 120,
    editable: false,
    is_favorite: false,
    locked: false,
    modified_since_sync: false,
    name: "A0",
    samples: [
      {
        filename: "kick_001.wav",
        id: 1,
        is_stereo: false,
        kit_name: "A0",
        slot_number: 0,
        source_path: "/path/to/kick_001.wav",
        voice_number: 1,
        wav_bit_depth: null,
        wav_bitrate: null,
        wav_channels: null,
        wav_sample_rate: null,
      },
      {
        filename: "snare_002.wav",
        id: 2,
        is_stereo: false,
        kit_name: "A0",
        slot_number: 1,
        source_path: "/path/to/snare_002.wav",
        voice_number: 2,
        wav_bit_depth: null,
        wav_bitrate: null,
        wav_channels: null,
        wav_sample_rate: null,
      },
    ],
    step_pattern: null,
    voices: [
      { id: 1, kit_name: "A0", voice_alias: "Kick", voice_number: 1 },
      { id: 2, kit_name: "A0", voice_alias: "Snare", voice_number: 2 },
    ],
  };

  describe("checkKitBasicFields", () => {
    it("should match kit name", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitBasicFields(mockKit, "a0", matchDetails);

      expect(matchDetails.matchedOn).toContain("name");
    });

    it("should match kit alias", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitBasicFields(mockKit, "custom", matchDetails);

      expect(matchDetails.matchedOn).toContain("alias");
      expect(matchDetails.matchedAlias).toBe("Custom Kit");
    });

    it("should match artist from bank", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitBasicFields(mockKit, "test artist", matchDetails);

      expect(matchDetails.matchedOn).toContain("artist");
      expect(matchDetails.matchedArtist).toBe("Test Artist");
    });

    it("should match lowercase search terms", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitBasicFields(mockKit, "custom", matchDetails);

      expect(matchDetails.matchedOn).toContain("alias");
    });

    it("should not match when no fields match", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitBasicFields(mockKit, "xyz", matchDetails);

      expect(matchDetails.matchedOn).toHaveLength(0);
    });
  });

  describe("checkKitVoices", () => {
    it("should match voice aliases", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitVoices(mockKit, "kick", matchDetails);

      expect(matchDetails.matchedOn).toContain("voice:Kick");
      expect(matchDetails.matchedVoices).toContain("Kick");
    });

    it("should match lowercase search terms", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitVoices(mockKit, "snare", matchDetails);

      expect(matchDetails.matchedOn).toContain("voice:Snare");
      expect(matchDetails.matchedVoices).toContain("Snare");
    });

    it("should handle kit without voices", () => {
      const kitWithoutVoices = { ...mockKit, voices: undefined };
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitVoices(kitWithoutVoices, "kick", matchDetails);

      expect(matchDetails.matchedOn).toHaveLength(0);
      expect(matchDetails.matchedVoices).toHaveLength(0);
    });
  });

  describe("checkKitSamples", () => {
    it("should match sample filenames from kit.samples", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitSamples(mockKit, "kick", matchDetails, {});

      expect(matchDetails.matchedOn).toContain("sample:kick_001.wav");
      expect(matchDetails.matchedSamples).toContain("kick_001.wav");
    });

    it("should match sample filenames from allKitSamples data", () => {
      const allKitSamples = {
        A0: {
          voice1: [{ filename: "hihat_003.wav" }],
        },
      };
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitSamples(mockKit, "hihat", matchDetails, allKitSamples);

      expect(matchDetails.matchedOn).toContain("sample:hihat_003.wav");
      expect(matchDetails.matchedSamples).toContain("hihat_003.wav");
    });

    it("should match lowercase search terms", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitSamples(mockKit, "kick", matchDetails, {});

      expect(matchDetails.matchedOn).toContain("sample:kick_001.wav");
    });

    it("should handle multiple matches", () => {
      const matchDetails: SearchMatchDetails = {
        matchedOn: [],
        matchedSamples: [],
        matchedVoices: [],
      };

      checkKitSamples(mockKit, "00", matchDetails, {});

      expect(matchDetails.matchedSamples).toContain("kick_001.wav");
      expect(matchDetails.matchedSamples).toContain("snare_002.wav");
      expect(matchDetails.matchedSamples).toHaveLength(2);
    });
  });

  describe("filterKitsWithSearch", () => {
    const mockKits: KitWithRelations[] = [mockKit];

    it("should return all kits when query is empty", () => {
      const results = filterKitsWithSearch(mockKits, "");

      expect(results).toHaveLength(1);
      expect(results[0].searchMatch).toBeUndefined();
    });

    it("should return all kits when query is too short", () => {
      const results = filterKitsWithSearch(mockKits, "a");

      expect(results).toHaveLength(1);
      expect(results[0].searchMatch).toBeUndefined();
    });

    it("should filter kits and add search match details", () => {
      const results = filterKitsWithSearch(mockKits, "custom");

      expect(results).toHaveLength(1);
      expect(results[0].searchMatch).toBeDefined();
      expect(results[0].searchMatch?.matchedOn).toContain("alias");
      expect(results[0].searchMatch?.matchedAlias).toBe("Custom Kit");
    });

    it("should return empty array when no matches found", () => {
      const results = filterKitsWithSearch(mockKits, "xyz");

      expect(results).toHaveLength(0);
    });

    it("should be case insensitive", () => {
      const results = filterKitsWithSearch(mockKits, "CUSTOM");

      expect(results).toHaveLength(1);
      expect(results[0].searchMatch?.matchedAlias).toBe("Custom Kit");
    });

    it("should sort results by kit name", () => {
      const kitB: KitWithRelations = {
        ...mockKit,
        alias: "Custom Beat", // Will match "custom"
        name: "B0",
      };
      const kitC: KitWithRelations = {
        ...mockKit,
        alias: "Custom Chorus", // Will match "custom"
        name: "C0",
      };
      const kits = [kitC, mockKit, kitB]; // Original mockKit has alias "Custom Kit"

      // Search for "custom" which should match all three aliases
      const results = filterKitsWithSearch(kits, "custom");

      expect(results).toHaveLength(3);
      // Results should be sorted alphabetically by name
      expect(results.map((kit) => kit.name)).toEqual(["A0", "B0", "C0"]);
    });

    it("should handle complex search with multiple match types", () => {
      const results = filterKitsWithSearch(mockKits, "kick", { A0: {} });

      expect(results).toHaveLength(1);
      expect(results[0].searchMatch?.matchedOn).toContain(
        "sample:kick_001.wav",
      );
      expect(results[0].searchMatch?.matchedOn).toContain("voice:Kick");
      expect(results[0].searchMatch?.matchedSamples).toContain("kick_001.wav");
      expect(results[0].searchMatch?.matchedVoices).toContain("Kick");
    });
  });
});

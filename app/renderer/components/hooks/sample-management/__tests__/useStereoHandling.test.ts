import type { Sample, Voice } from "@romper/shared/db/schema";

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useStereoHandling } from "../useStereoHandling";

describe("useStereoHandling", () => {
  // Mock voice data
  const mockVoices: Voice[] = [
    { id: 1, kit_name: "A0", stereo_mode: false, voice_number: 1 },
    { id: 2, kit_name: "A0", stereo_mode: false, voice_number: 2 },
    { id: 3, kit_name: "A0", stereo_mode: false, voice_number: 3 },
    { id: 4, kit_name: "A0", stereo_mode: false, voice_number: 4 },
  ];

  // Mock sample data
  const mockSamples: Sample[] = [
    {
      filename: "kick.wav",
      id: 1,
      kit_name: "A0",
      slot_number: 0,
      source_path: "/path/kick.wav",
      voice_number: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe("canLinkVoices", () => {
    it("should allow linking voice 1 to voice 2", () => {
      const { result } = renderHook(() => useStereoHandling());

      const linkingResult = result.current.canLinkVoices(1, mockVoices, []);

      expect(linkingResult.canLink).toBe(true);
      expect(linkingResult.linkedVoice).toBe(2);
    });

    it("should allow linking voice 2 to voice 3", () => {
      const { result } = renderHook(() => useStereoHandling());

      const linkingResult = result.current.canLinkVoices(2, mockVoices, []);

      expect(linkingResult.canLink).toBe(true);
      expect(linkingResult.linkedVoice).toBe(3);
    });

    it("should allow linking voice 3 to voice 4", () => {
      const { result } = renderHook(() => useStereoHandling());

      const linkingResult = result.current.canLinkVoices(3, mockVoices, []);

      expect(linkingResult.canLink).toBe(true);
      expect(linkingResult.linkedVoice).toBe(4);
    });

    it("should prevent linking voice 4 (no voice 5)", () => {
      const { result } = renderHook(() => useStereoHandling());

      const linkingResult = result.current.canLinkVoices(4, mockVoices, []);

      expect(linkingResult.canLink).toBe(false);
      expect(linkingResult.reason).toBe(
        "Voice 4 cannot be linked - no voice 5 available",
      );
    });

    it("should prevent linking already stereo voice", () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        mockVoices[0],
        { ...mockVoices[1], stereo_mode: true }, // Voice 2 in stereo mode
        ...mockVoices.slice(2),
      ];

      const linkingResult = result.current.canLinkVoices(2, stereoVoices, []);

      expect(linkingResult.canLink).toBe(false);
      expect(linkingResult.reason).toContain("already in stereo mode");
    });

    it("should prevent linking when target voice has any samples", () => {
      const { result } = renderHook(() => useStereoHandling());
      const samplesWithStereo = [
        { ...mockSamples[0], voice_number: 3 }, // Voice 3 has samples
      ];

      const linkingResult = result.current.canLinkVoices(
        2,
        mockVoices,
        samplesWithStereo,
      );

      expect(linkingResult.canLink).toBe(false);
      expect(linkingResult.reason).toContain(
        "has samples — remove them before linking",
      );
    });
  });

  describe("linkVoicesForStereo", () => {
    it("should link voices successfully", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const mockOnVoiceUpdate = vi.fn().mockResolvedValue(undefined);

      const opResult = await result.current.linkVoicesForStereo(
        1,
        mockVoices,
        [],
        mockOnVoiceUpdate,
      );

      expect(opResult.success).toBe(true);
      expect(mockOnVoiceUpdate).toHaveBeenCalledWith(1, { stereo_mode: true });
    });

    it("should fail to link invalid voices", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const mockOnVoiceUpdate = vi.fn();

      const opResult = await result.current.linkVoicesForStereo(
        4,
        mockVoices,
        [],
        mockOnVoiceUpdate,
      );

      expect(opResult.success).toBe(false);
      expect(opResult.error).toBe(
        "Voice 4 cannot be linked - no voice 5 available",
      );
      expect(mockOnVoiceUpdate).not.toHaveBeenCalled();
    });
  });

  describe("unlinkVoices", () => {
    it("should unlink voices successfully", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];
      const mockOnVoiceUpdate = vi.fn().mockResolvedValue(undefined);

      const opResult = await result.current.unlinkVoices(
        1,
        stereoVoices,
        mockOnVoiceUpdate,
      );

      expect(opResult.success).toBe(true);
      expect(mockOnVoiceUpdate).toHaveBeenCalledWith(1, { stereo_mode: false });
    });

    it("should fail to unlink voice not in stereo mode", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const mockOnVoiceUpdate = vi.fn();

      const opResult = await result.current.unlinkVoices(
        1,
        mockVoices,
        mockOnVoiceUpdate,
      );

      expect(opResult.success).toBe(false);
      expect(opResult.error).toBe("Voice 1 is not in stereo mode");
      expect(mockOnVoiceUpdate).not.toHaveBeenCalled();
    });

    it("[UC-28] unlinks a voice that holds 2-channel files (RE-69)", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];
      const mockOnVoiceUpdate = vi.fn().mockResolvedValue(undefined);

      // Stereo is a voice setting: the voice's 2-channel files don't block
      // the unlink; the next write mixes them to mono (RE-29)
      const opResult = await result.current.unlinkVoices(
        1,
        stereoVoices,
        mockOnVoiceUpdate,
      );

      expect(opResult).toEqual({ success: true });
      expect(mockOnVoiceUpdate).toHaveBeenCalledWith(1, { stereo_mode: false });
    });
  });

  describe("getVoiceLinkingStatus", () => {
    it("should return not linked for mono voice", () => {
      const { result } = renderHook(() => useStereoHandling());

      const status = result.current.getVoiceLinkingStatus(1, mockVoices);

      expect(status.isLinked).toBe(false);
      expect(status.isPrimary).toBe(false);
      expect(status.linkedWith).toBeUndefined();
    });

    it("should return primary link status for stereo voice", () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];

      const status = result.current.getVoiceLinkingStatus(1, stereoVoices);

      expect(status.isLinked).toBe(true);
      expect(status.isPrimary).toBe(true);
      expect(status.linkedWith).toBe(2);
    });

    it("should return secondary link status for linked voice", () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];

      const status = result.current.getVoiceLinkingStatus(2, stereoVoices);

      expect(status.isLinked).toBe(true);
      expect(status.isPrimary).toBe(false);
      expect(status.linkedWith).toBe(1);
    });

    it("should handle voice 1 correctly (no previous voice)", () => {
      const { result } = renderHook(() => useStereoHandling());

      const status = result.current.getVoiceLinkingStatus(1, mockVoices);

      expect(status.isLinked).toBe(false);
      expect(status.isPrimary).toBe(false);
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle linkVoicesForStereo errors gracefully", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const mockOnVoiceUpdate = vi
        .fn()
        .mockRejectedValue(new Error("Update failed"));

      const opResult = await result.current.linkVoicesForStereo(
        1,
        mockVoices,
        [],
        mockOnVoiceUpdate,
      );

      expect(opResult.success).toBe(false);
      expect(opResult.error).toBe("Failed to link voices. Please try again.");
    });

    it("should handle unlinkVoices errors gracefully", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];
      const mockOnVoiceUpdate = vi
        .fn()
        .mockRejectedValue(new Error("Update failed"));

      const opResult = await result.current.unlinkVoices(
        1,
        stereoVoices,
        mockOnVoiceUpdate,
      );

      expect(opResult.success).toBe(false);
      expect(opResult.error).toBe("Failed to unlink voices. Please try again.");
    });

    it("should handle missing voice data in canLinkVoices", () => {
      const { result } = renderHook(() => useStereoHandling());
      const incompleteVoices = [mockVoices[0]]; // Missing voice 2

      const linkingResult = result.current.canLinkVoices(
        1,
        incompleteVoices,
        [],
      );

      expect(linkingResult.canLink).toBe(false);
      expect(linkingResult.reason).toBe("Voice data not found");
    });
  });

  describe("Voice linking with existing samples", () => {
    it("should prevent linking when target voice has any samples", () => {
      const { result } = renderHook(() => useStereoHandling());
      const samplesWithStereoInTarget = [
        { ...mockSamples[0], voice_number: 2 }, // Voice 2 has a sample
      ];

      const linkingResult = result.current.canLinkVoices(
        1,
        mockVoices,
        samplesWithStereoInTarget,
      );

      expect(linkingResult.canLink).toBe(false);
      expect(linkingResult.reason).toBe(
        "Voice 2 has samples — remove them before linking",
      );
    });

    it("should prevent linking when target voice has mono samples", () => {
      const { result } = renderHook(() => useStereoHandling());
      const samplesWithMonoInTarget = [
        { ...mockSamples[0], voice_number: 2 }, // Voice 2 has mono sample
      ];

      const linkingResult = result.current.canLinkVoices(
        1,
        mockVoices,
        samplesWithMonoInTarget,
      );

      expect(linkingResult.canLink).toBe(false);
      expect(linkingResult.reason).toBe(
        "Voice 2 has samples — remove them before linking",
      );
    });

    it("should allow linking when secondary voice is empty", () => {
      const { result } = renderHook(() => useStereoHandling());

      const linkingResult = result.current.canLinkVoices(
        1,
        mockVoices,
        [], // No samples anywhere
      );

      expect(linkingResult.canLink).toBe(true);
      expect(linkingResult.linkedVoice).toBe(2);
    });

    it("should prevent linking when target voice is in stereo mode", () => {
      const { result } = renderHook(() => useStereoHandling());
      const voicesWithStereoTarget = [
        mockVoices[0],
        { ...mockVoices[1], stereo_mode: true }, // Voice 2 in stereo mode
        ...mockVoices.slice(2),
      ];

      const linkingResult = result.current.canLinkVoices(
        1,
        voicesWithStereoTarget,
        [],
      );

      expect(linkingResult.canLink).toBe(false);
      expect(linkingResult.reason).toBe("Voice 2 is already in stereo mode");
    });
  });

  describe("Functions without onVoiceUpdate callback", () => {
    it("should handle linkVoicesForStereo without onVoiceUpdate", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const opResult = await result.current.linkVoicesForStereo(
        1,
        mockVoices,
        [],
        undefined, // No callback
      );

      expect(opResult.success).toBe(true);
    });

    it("should handle unlinkVoices without onVoiceUpdate", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];

      const opResult = await result.current.unlinkVoices(
        1,
        stereoVoices,
        undefined, // No callback
      );

      expect(opResult.success).toBe(true);
    });
  });
});

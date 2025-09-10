import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Sample, useStereoHandling, Voice } from "../useStereoHandling";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

import { toast } from "sonner";
const mockToast = vi.mocked(toast);

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
      is_stereo: false,
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

    it("should prevent linking when target voice has stereo samples", () => {
      const { result } = renderHook(() => useStereoHandling());
      const samplesWithStereo = [
        { ...mockSamples[0], is_stereo: true, voice_number: 3 }, // Voice 3 has stereo samples
      ];

      const linkingResult = result.current.canLinkVoices(
        2,
        mockVoices,
        samplesWithStereo,
      );

      expect(linkingResult.canLink).toBe(false);
      expect(linkingResult.reason).toContain(
        "already linked or has stereo samples",
      );
    });
  });

  describe("validateVoiceAssignment", () => {
    it("should accept mono sample to mono voice", () => {
      const { result } = renderHook(() => useStereoHandling());

      const validation = result.current.validateVoiceAssignment(
        1,
        1,
        mockVoices,
        [],
      );

      expect(validation.canAccept).toBe(true);
      expect(validation.voiceMode).toBe("mono");
    });

    it("should accept stereo sample to mono voice (with warning)", () => {
      const { result } = renderHook(() => useStereoHandling());

      const validation = result.current.validateVoiceAssignment(
        1,
        2,
        mockVoices,
        [],
      );

      expect(validation.canAccept).toBe(true);
      expect(validation.voiceMode).toBe("mono");
    });

    it("should reject sample to linked voice", () => {
      const { result } = renderHook(() => useStereoHandling());
      const linkedVoices = [
        { ...mockVoices[0], stereo_mode: true }, // Voice 1 links to voice 2
        ...mockVoices.slice(1),
      ];

      const validation = result.current.validateVoiceAssignment(
        2,
        1,
        linkedVoices,
        [],
      );

      expect(validation.canAccept).toBe(false);
      expect(validation.voiceMode).toBe("linked");
      expect(validation.reason).toContain("linked to stereo voice 1");
    });

    it("should accept stereo sample to stereo voice", () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];

      const validation = result.current.validateVoiceAssignment(
        1,
        2,
        stereoVoices,
        [],
      );

      expect(validation.canAccept).toBe(true);
      expect(validation.voiceMode).toBe("stereo");
    });

    it("should reject mono sample to stereo voice", () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];

      const validation = result.current.validateVoiceAssignment(
        1,
        1,
        stereoVoices,
        [],
      );

      expect(validation.canAccept).toBe(false);
      expect(validation.voiceMode).toBe("stereo");
      expect(validation.requiresConversion).toBe("stereo");
    });
  });

  describe("analyzeSampleAssignment", () => {
    it("should assign mono sample without warning", () => {
      const { result } = renderHook(() => useStereoHandling());

      const assignment = result.current.analyzeSampleAssignment(
        1,
        1,
        mockVoices,
        [],
      );

      expect(assignment.canAssign).toBe(true);
      expect(assignment.assignAsMono).toBe(true);
      expect(assignment.requiresWarning).toBe(false);
    });

    it("should assign stereo sample with linking warning", () => {
      const { result } = renderHook(() => useStereoHandling());

      const assignment = result.current.analyzeSampleAssignment(
        1,
        2,
        mockVoices,
        [],
      );

      expect(assignment.canAssign).toBe(true);
      expect(assignment.assignAsMono).toBe(false);
      expect(assignment.requiresWarning).toBe(true);
      expect(assignment.warningMessage).toContain("will link voices 1 and 2");
    });

    it("should convert stereo to mono for voice 4", () => {
      const { result } = renderHook(() => useStereoHandling());

      const assignment = result.current.analyzeSampleAssignment(
        4,
        2,
        mockVoices,
        [],
      );

      expect(assignment.canAssign).toBe(true);
      expect(assignment.assignAsMono).toBe(true);
      expect(assignment.requiresWarning).toBe(true);
      expect(assignment.warningMessage).toContain("will be converted to mono");
    });

    it("should reject assignment to linked voice", () => {
      const { result } = renderHook(() => useStereoHandling());
      const linkedVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];

      const assignment = result.current.analyzeSampleAssignment(
        2,
        1,
        linkedVoices,
        [],
      );

      expect(assignment.canAssign).toBe(false);
      expect(assignment.requiresWarning).toBe(true);
    });
  });

  describe("linkVoicesForStereo", () => {
    it("should link voices successfully", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const mockOnVoiceUpdate = vi.fn().mockResolvedValue(undefined);

      const success = await result.current.linkVoicesForStereo(
        1,
        mockVoices,
        [],
        mockOnVoiceUpdate,
      );

      expect(success).toBe(true);
      expect(mockOnVoiceUpdate).toHaveBeenCalledWith(1, { stereo_mode: true });
      expect(mockToast.success).toHaveBeenCalledWith("Voices linked", {
        description: "Voice 1 and 2 are now linked for stereo",
        duration: 5000,
      });
    });

    it("should fail to link invalid voices", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const mockOnVoiceUpdate = vi.fn();

      const success = await result.current.linkVoicesForStereo(
        4,
        mockVoices,
        [],
        mockOnVoiceUpdate,
      );

      expect(success).toBe(false);
      expect(mockOnVoiceUpdate).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith("Voice linking failed", {
        description: "Voice 4 cannot be linked - no voice 5 available",
        duration: 5000,
      });
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

      const success = await result.current.unlinkVoices(
        1,
        stereoVoices,
        [],
        mockOnVoiceUpdate,
      );

      expect(success).toBe(true);
      expect(mockOnVoiceUpdate).toHaveBeenCalledWith(1, { stereo_mode: false });
      expect(mockToast.success).toHaveBeenCalledWith("Voices unlinked", {
        description: "Voice 1 converted back to mono mode",
        duration: 5000,
      });
    });

    it("should fail to unlink voice not in stereo mode", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const mockOnVoiceUpdate = vi.fn();

      const success = await result.current.unlinkVoices(
        1,
        mockVoices,
        [],
        mockOnVoiceUpdate,
      );

      expect(success).toBe(false);
      expect(mockOnVoiceUpdate).not.toHaveBeenCalled();
      expect(mockToast.warning).toHaveBeenCalledWith("Voice not linked", {
        description: "Voice 1 is not in stereo mode",
        duration: 5000,
      });
    });

    it("should prevent unlinking voice with stereo samples", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];
      const stereoSamples = [{ ...mockSamples[0], is_stereo: true }];
      const mockOnVoiceUpdate = vi.fn();

      const success = await result.current.unlinkVoices(
        1,
        stereoVoices,
        stereoSamples,
        mockOnVoiceUpdate,
      );

      expect(success).toBe(false);
      expect(mockOnVoiceUpdate).not.toHaveBeenCalled();
      expect(mockToast.warning).toHaveBeenCalledWith(
        "Cannot unlink voice with stereo samples",
        {
          description:
            "Remove stereo samples from voice 1 first, or convert them to mono",
          duration: 7000,
        },
      );
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

      const success = await result.current.linkVoicesForStereo(
        1,
        mockVoices,
        [],
        mockOnVoiceUpdate,
      );

      expect(success).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith("Voice linking failed", {
        description: "Failed to link voices. Please try again.",
        duration: 5000,
      });
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

      const success = await result.current.unlinkVoices(
        1,
        stereoVoices,
        [],
        mockOnVoiceUpdate,
      );

      expect(success).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith("Voice unlinking failed", {
        description: "Failed to unlink voices. Please try again.",
        duration: 5000,
      });
    });

    it("should handle missing voice data in validateVoiceAssignment", () => {
      const { result } = renderHook(() => useStereoHandling());

      const validation = result.current.validateVoiceAssignment(
        99, // Non-existent voice
        1,
        mockVoices,
        [],
      );

      expect(validation.canAccept).toBe(false);
      expect(validation.reason).toBe("Voice not found");
      expect(validation.voiceMode).toBe("mono");
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

  describe("Complex sample assignment scenarios", () => {
    it("should prevent mixing mono and stereo samples in validateVoiceAssignment", () => {
      const { result } = renderHook(() => useStereoHandling());
      const mixedSamples = [
        { ...mockSamples[0], is_stereo: false, voice_number: 1 }, // Existing mono sample
      ];

      const validation = result.current.validateVoiceAssignment(
        1,
        2, // Trying to add stereo sample
        mockVoices,
        mixedSamples,
      );

      expect(validation.canAccept).toBe(false);
      expect(validation.reason).toBe(
        "Cannot mix mono and stereo samples in same voice",
      );
      expect(validation.requiresConversion).toBe("mono");
      expect(validation.voiceMode).toBe("mono");
    });

    it("should allow stereo sample assignment with userLinkedVoices flag", () => {
      const { result } = renderHook(() => useStereoHandling());

      const assignment = result.current.analyzeSampleAssignment(
        1,
        2, // Stereo sample
        mockVoices,
        [],
        true, // User manually linked voices
      );

      expect(assignment.canAssign).toBe(true);
      expect(assignment.assignAsMono).toBe(false);
      expect(assignment.requiresWarning).toBe(false);
    });

    it("should handle stereo sample to already stereo voice", () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];

      const assignment = result.current.analyzeSampleAssignment(
        1,
        2, // Stereo sample
        stereoVoices,
        [],
      );

      expect(assignment.canAssign).toBe(true);
      expect(assignment.assignAsMono).toBe(false);
      expect(assignment.requiresWarning).toBe(false);
    });

    it("should handle conversion recommendation when linking impossible", () => {
      const { result } = renderHook(() => useStereoHandling());
      const conflictedVoices = [
        mockVoices[0],
        { ...mockVoices[1], stereo_mode: true }, // Voice 2 already in stereo mode
        ...mockVoices.slice(2),
      ];

      const validation = result.current.validateVoiceAssignment(
        1,
        2, // Stereo sample to voice that can't link (voice 2 busy)
        conflictedVoices,
        [],
      );

      expect(validation.canAccept).toBe(true);
      expect(validation.requiresConversion).toBe("mono");
      expect(validation.reason).toContain(
        "already linked or has stereo samples",
      );
    });
  });

  describe("Voice linking with existing samples", () => {
    it("should prevent linking when target voice has stereo samples", () => {
      const { result } = renderHook(() => useStereoHandling());
      const samplesWithStereoInTarget = [
        { ...mockSamples[0], is_stereo: true, voice_number: 2 }, // Voice 2 has stereo sample
      ];

      const linkingResult = result.current.canLinkVoices(
        1,
        mockVoices,
        samplesWithStereoInTarget,
      );

      expect(linkingResult.canLink).toBe(false);
      expect(linkingResult.reason).toBe(
        "Voice 2 is already linked or has stereo samples",
      );
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
      expect(linkingResult.reason).toBe(
        "Voice 2 is already linked or has stereo samples",
      );
    });
  });

  describe("Functions without onVoiceUpdate callback", () => {
    it("should handle linkVoicesForStereo without onVoiceUpdate", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const success = await result.current.linkVoicesForStereo(
        1,
        mockVoices,
        [],
        undefined, // No callback
      );

      expect(success).toBe(true);
      expect(mockToast.success).toHaveBeenCalledWith("Voices linked", {
        description: "Voice 1 and 2 are now linked for stereo",
        duration: 5000,
      });
    });

    it("should handle unlinkVoices without onVoiceUpdate", async () => {
      const { result } = renderHook(() => useStereoHandling());
      const stereoVoices = [
        { ...mockVoices[0], stereo_mode: true },
        ...mockVoices.slice(1),
      ];

      const success = await result.current.unlinkVoices(
        1,
        stereoVoices,
        [],
        undefined, // No callback
      );

      expect(success).toBe(true);
      expect(mockToast.success).toHaveBeenCalledWith("Voices unlinked", {
        description: "Voice 1 converted back to mono mode",
        duration: 5000,
      });
    });
  });
});

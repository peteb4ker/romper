import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useStereoHandling } from "../useStereoHandling";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../../../utils/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

import * as SettingsContext from "../../../../utils/SettingsContext";
const mockUseSettings = vi.mocked(SettingsContext.useSettings);

import { toast } from "sonner";
const mockToast = vi.mocked(toast);

describe("useStereoHandling", () => {
  const mockSamples = [
    { filename: "sample1.wav", voice_number: 1 },
    { filename: "sample2.wav", voice_number: 2 },
    { filename: "sample3.wav", voice_number: 3 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    mockUseSettings.mockReturnValue({
      defaultToMonoSamples: true,
    } as any);
  });

  describe("analyzeStereoAssignment", () => {
    describe("with defaultToMonoSamples: true", () => {
      beforeEach(() => {
        mockUseSettings.mockReturnValue({
          defaultToMonoSamples: true,
        } as any);
      });

      it("should assign mono sample as mono", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          1,
          1, // mono
          mockSamples,
        );

        expect(analysis).toEqual({
          assignAsMono: true,
          canAssign: true,
          requiresConfirmation: false,
          targetVoice: 1,
        });
      });

      it("should assign stereo sample as mono when defaultToMonoSamples is true", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          1,
          2, // stereo
          mockSamples,
        );

        expect(analysis).toEqual({
          assignAsMono: true,
          canAssign: true,
          requiresConfirmation: false,
          targetVoice: 1,
        });
      });

      it("should respect forceStereo override", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          1,
          2, // stereo
          [], // no existing samples
          { forceStereo: true },
        );

        expect(analysis).toEqual({
          assignAsMono: false,
          canAssign: true,
          requiresConfirmation: false,
          targetVoice: 1,
        });
      });

      it("should respect forceMono override for stereo file", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          1,
          2, // stereo
          mockSamples,
          { forceMono: true },
        );

        expect(analysis).toEqual({
          assignAsMono: true,
          canAssign: true,
          requiresConfirmation: false,
          targetVoice: 1,
        });
      });
    });

    describe("with defaultToMonoSamples: false", () => {
      beforeEach(() => {
        mockUseSettings.mockReturnValue({
          defaultToMonoSamples: false,
        } as any);
      });

      it("should assign mono sample as mono even when defaultToMonoSamples is false", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          1,
          1, // mono
          mockSamples,
        );

        expect(analysis).toEqual({
          assignAsMono: true,
          canAssign: true,
          requiresConfirmation: false,
          targetVoice: 1,
        });
      });

      it("should assign stereo sample to dual voices when no conflicts", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          4,
          2, // stereo
          [], // no existing samples
        );

        expect(analysis).toEqual({
          assignAsMono: false,
          canAssign: false,
          conflictInfo: {
            existingSamples: [],
            nextVoice: 5,
            targetVoice: 4,
          },
          requiresConfirmation: true,
          targetVoice: 4,
        });
      });

      it("should detect conflict when target voice has samples", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          1,
          2, // stereo
          mockSamples, // voice 1 has samples
        );

        expect(analysis).toEqual({
          assignAsMono: false,
          canAssign: false,
          conflictInfo: {
            existingSamples: [
              {
                samples: ["sample1.wav"],
                voice: 1,
              },
              {
                samples: ["sample2.wav"],
                voice: 2,
              },
            ],
            nextVoice: 2,
            targetVoice: 1,
          },
          requiresConfirmation: true,
          targetVoice: 1,
        });
      });

      it("should detect conflict when next voice has samples", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          1,
          2, // stereo
          [{ filename: "sample2.wav", voice_number: 2 }], // voice 2 has samples
        );

        expect(analysis).toEqual({
          assignAsMono: false,
          canAssign: false,
          conflictInfo: {
            existingSamples: [
              {
                samples: ["sample2.wav"],
                voice: 2,
              },
            ],
            nextVoice: 2,
            targetVoice: 1,
          },
          requiresConfirmation: true,
          targetVoice: 1,
        });
      });

      it("should detect conflict when both target and next voice have samples", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          2,
          2, // stereo
          mockSamples, // voices 2 and 3 have samples
        );

        expect(analysis).toEqual({
          assignAsMono: false,
          canAssign: false,
          conflictInfo: {
            existingSamples: [
              {
                samples: ["sample2.wav"],
                voice: 2,
              },
              {
                samples: ["sample3.wav"],
                voice: 3,
              },
            ],
            nextVoice: 3,
            targetVoice: 2,
          },
          requiresConfirmation: true,
          targetVoice: 2,
        });
      });

      it("should handle voice 4 edge case (no voice 5 available)", () => {
        const { result } = renderHook(() => useStereoHandling());

        const analysis = result.current.analyzeStereoAssignment(
          4,
          2, // stereo
          [], // no existing samples
        );

        expect(analysis).toEqual({
          assignAsMono: false,
          canAssign: false,
          conflictInfo: {
            existingSamples: [],
            nextVoice: 5,
            targetVoice: 4,
          },
          requiresConfirmation: true,
          targetVoice: 4,
        });
      });
    });
  });

  describe("handleStereoConflict", () => {
    it("should handle voice 4 edge case with toast and force mono", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const conflictInfo = {
        existingSamples: [],
        nextVoice: 5,
        targetVoice: 4,
      };

      const options = await result.current.handleStereoConflict(conflictInfo);

      expect(options).toEqual({
        cancel: false,
        forceMono: true,
        replaceExisting: false,
      });
      expect(mockToast.warning).toHaveBeenCalledWith(
        "Stereo assignment to voice 4",
        {
          description:
            "Voice 5 doesn't exist. Sample will be assigned as mono to voice 4.",
          duration: 5000,
        },
      );
    });

    it("should handle existing samples conflict with toast and force mono", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const conflictInfo = {
        existingSamples: [
          { samples: ["sample1.wav"], voice: 1 },
          { samples: ["sample2.wav"], voice: 2 },
        ],
        nextVoice: 2,
        targetVoice: 1,
      };

      const options = await result.current.handleStereoConflict(conflictInfo);

      expect(options).toEqual({
        cancel: false,
        forceMono: true,
        replaceExisting: false,
      });
      expect(mockToast.warning).toHaveBeenCalledWith(
        "Stereo assignment conflict",
        {
          description:
            "voice 1 and voice 2 already have samples. Sample will be assigned as mono to voice 1.",
          duration: 7000,
        },
      );
    });

    it("should handle single voice conflict", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const conflictInfo = {
        existingSamples: [{ samples: ["sample1.wav"], voice: 1 }],
        nextVoice: 2,
        targetVoice: 1,
      };

      const options = await result.current.handleStereoConflict(conflictInfo);

      expect(options).toEqual({
        cancel: false,
        forceMono: true,
        replaceExisting: false,
      });
      expect(mockToast.warning).toHaveBeenCalledWith(
        "Stereo assignment conflict",
        {
          description:
            "voice 1 already have samples. Sample will be assigned as mono to voice 1.",
          duration: 7000,
        },
      );
    });
  });

  describe("applyStereoAssignment", () => {
    const mockOnSampleAdd = vi.fn();
    const testFilePath = "/path/to/sample.wav";

    beforeEach(() => {
      mockOnSampleAdd.mockReset();
    });

    it("should return false when options.cancel is true", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const stereoResult = {
        assignAsMono: false,
        canAssign: true,
        requiresConfirmation: false,
        targetVoice: 1,
      };

      const options = {
        cancel: true,
        forceMono: false,
        replaceExisting: false,
      };

      const success = await result.current.applyStereoAssignment(
        testFilePath,
        stereoResult,
        options,
        mockOnSampleAdd,
      );

      expect(success).toBe(false);
      expect(mockOnSampleAdd).not.toHaveBeenCalled();
    });

    it("should return false when no onSampleAdd handler provided", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const stereoResult = {
        assignAsMono: true,
        canAssign: true,
        requiresConfirmation: false,
        targetVoice: 1,
      };

      const options = {
        cancel: false,
        forceMono: true,
        replaceExisting: false,
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const success = await result.current.applyStereoAssignment(
        testFilePath,
        stereoResult,
        options,
      );

      expect(success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "No sample add handler provided",
      );

      consoleErrorSpy.mockRestore();
    });

    it("should assign as mono when options.forceMono is true", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const stereoResult = {
        assignAsMono: false,
        canAssign: true,
        requiresConfirmation: false,
        targetVoice: 2,
      };

      const options = {
        cancel: false,
        forceMono: true,
        replaceExisting: false,
      };

      mockOnSampleAdd.mockResolvedValue(undefined);

      const success = await result.current.applyStereoAssignment(
        testFilePath,
        stereoResult,
        options,
        mockOnSampleAdd,
      );

      expect(success).toBe(true);
      expect(mockOnSampleAdd).toHaveBeenCalledWith(2, -1, testFilePath, {
        forceMono: true,
      });
    });

    it("should assign as mono when result.assignAsMono is true", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const stereoResult = {
        assignAsMono: true,
        canAssign: true,
        requiresConfirmation: false,
        targetVoice: 3,
      };

      const options = {
        cancel: false,
        forceMono: false,
        replaceExisting: false,
      };

      mockOnSampleAdd.mockResolvedValue(undefined);

      const success = await result.current.applyStereoAssignment(
        testFilePath,
        stereoResult,
        options,
        mockOnSampleAdd,
      );

      expect(success).toBe(true);
      expect(mockOnSampleAdd).toHaveBeenCalledWith(3, -1, testFilePath, {
        forceMono: true,
      });
    });

    it("should assign as stereo and show success toast", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const stereoResult = {
        assignAsMono: false,
        canAssign: true,
        requiresConfirmation: false,
        targetVoice: 2,
      };

      const options = {
        cancel: false,
        forceMono: false,
        replaceExisting: false,
      };

      mockOnSampleAdd.mockResolvedValue(undefined);

      const success = await result.current.applyStereoAssignment(
        testFilePath,
        stereoResult,
        options,
        mockOnSampleAdd,
      );

      expect(success).toBe(true);
      expect(mockOnSampleAdd).toHaveBeenCalledWith(2, -1, testFilePath, {
        forceStereo: true,
      });
      expect(mockToast.success).toHaveBeenCalledWith("Stereo assignment", {
        description: "Stereo sample assigned to voices 2 (left) and 3 (right).",
        duration: 5000,
      });
    });

    it("should handle onSampleAdd errors and show error toast", async () => {
      const { result } = renderHook(() => useStereoHandling());

      const stereoResult = {
        assignAsMono: true,
        canAssign: true,
        requiresConfirmation: false,
        targetVoice: 1,
      };

      const options = {
        cancel: false,
        forceMono: true,
        replaceExisting: false,
      };

      const testError = new Error("Sample add failed");
      mockOnSampleAdd.mockRejectedValue(testError);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const success = await result.current.applyStereoAssignment(
        testFilePath,
        stereoResult,
        options,
        mockOnSampleAdd,
      );

      expect(success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to apply stereo assignment:",
        "Sample add failed",
      );
      expect(mockToast.error).toHaveBeenCalledWith("Assignment failed", {
        description: "Failed to assign sample. Please try again.",
        duration: 5000,
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("return values", () => {
    it("should return all expected functions and values", () => {
      const { result } = renderHook(() => useStereoHandling());

      expect(result.current).toEqual({
        analyzeStereoAssignment: expect.any(Function),
        applyStereoAssignment: expect.any(Function),
        defaultToMonoSamples: true,
        handleStereoConflict: expect.any(Function),
      });
    });

    it("should reflect settings changes", () => {
      mockUseSettings.mockReturnValue({
        defaultToMonoSamples: false,
      } as any);

      const { result } = renderHook(() => useStereoHandling());

      expect(result.current.defaultToMonoSamples).toBe(false);
    });
  });
});

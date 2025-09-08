import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleProcessing } from "../useSampleProcessing";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("../../../../utils/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../useStereoHandling", () => ({
  useStereoHandling: vi.fn(),
}));

describe("useSampleProcessing", () => {
  const mockOptions = {
    kitName: "Test Kit",
    onSampleAdd: vi.fn(),
    onSampleReplace: vi.fn(),
    samples: [
      "sample1.wav",
      "",
      "sample3.wav",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    voice: 1,
  };

  const mockStereoHandling = {
    analyzeStereoAssignment: vi.fn(),
    applyStereoAssignment: vi.fn(),
    handleStereoConflict: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Import and mock the modules
    const { useSettings } = await import("../../../../utils/SettingsContext");
    const { useStereoHandling } = await import("../useStereoHandling");

    vi.mocked(useSettings).mockReturnValue({
      defaultToMonoSamples: true,
    } as unknown);

    vi.mocked(useStereoHandling).mockReturnValue(mockStereoHandling);
    vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
      data: [
        { source_path: "/path/sample1.wav", voice_number: 1 },
        { source_path: "/path/sample3.wav", voice_number: 1 },
      ],
      success: true,
    });
  });

  describe("getCurrentKitSamples", () => {
    it("should fetch and return kit samples", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const samples = await result.current.getCurrentKitSamples();

      expect(window.electronAPI.getAllSamplesForKit).toHaveBeenCalledWith(
        "Test Kit",
      );
      expect(samples).toEqual([
        { source_path: "/path/sample1.wav", voice_number: 1 },
        { source_path: "/path/sample3.wav", voice_number: 1 },
      ]);
    });

    it("should handle missing electronAPI", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = undefined;

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const samples = await result.current.getCurrentKitSamples();

      expect(samples).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Sample management not available",
      );

      consoleErrorSpy.mockRestore();
      (window as unknown).electronAPI = originalAPI;
    });

    it("should handle API call failure", async () => {
      vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
        error: "API Error",
        success: false,
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const samples = await result.current.getCurrentKitSamples();

      expect(samples).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to get samples:",
        "API Error",
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return empty array when no data", async () => {
      vi.mocked(window.electronAPI.getAllSamplesForKit).mockResolvedValue({
        data: null,
        success: true,
      });

      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const samples = await result.current.getCurrentKitSamples();

      expect(samples).toEqual([]);
    });
  });

  describe("isDuplicateSample", () => {
    it("should detect duplicate sample and show toast", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));
      const { toast } = await import("sonner");

      const allSamples = [
        { source_path: "/path/existing.wav", voice_number: 1 },
        { source_path: "/path/other.wav", voice_number: 2 },
      ];

      const isDupe = await result.current.isDuplicateSample(
        allSamples,
        "/path/existing.wav",
      );

      expect(isDupe).toBe(true);
      expect(vi.mocked(toast.warning)).toHaveBeenCalledWith(
        "Duplicate sample",
        {
          description: "Sample already exists in voice 1",
          duration: 5000,
        },
      );
    });

    it("should return false for non-duplicate sample", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));
      const { toast } = await import("sonner");

      const allSamples = [
        { source_path: "/path/existing.wav", voice_number: 1 },
      ];

      const isDupe = await result.current.isDuplicateSample(
        allSamples,
        "/path/new.wav",
      );

      expect(isDupe).toBe(false);
      expect(vi.mocked(toast.warning)).not.toHaveBeenCalled();
    });

    it("should only check samples for current voice", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const allSamples = [
        { source_path: "/path/sample.wav", voice_number: 2 }, // Different voice
      ];

      const isDupe = await result.current.isDuplicateSample(
        allSamples,
        "/path/sample.wav",
      );

      expect(isDupe).toBe(false);
    });
  });

  describe("calculateTargetSlot", () => {
    it("should use slotNumber when provided and >= 0", () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const targetSlot = result.current.calculateTargetSlot(
        "/path/sample.wav",
        2,
        5,
      );

      expect(targetSlot).toBe(2);
    });

    it("should use droppedSlotNumber when slotNumber < 0", () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const targetSlot = result.current.calculateTargetSlot(
        "/path/Test Kit/sample.wav",
        -1,
        3,
      );

      expect(targetSlot).toBe(3);
    });

    it("should find first available slot for external files when slotNumber < 0", () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const targetSlot = result.current.calculateTargetSlot(
        "/external/path/sample.wav", // Not from local store
        -1,
        0, // droppedSlotNumber, but sample[0] is occupied
      );

      expect(targetSlot).toBe(1); // First available slot
    });

    it("should return -1 when no slots available for external files", () => {
      const fullSamples = Array(12).fill("occupied.wav");
      const optionsWithFullSamples = { ...mockOptions, samples: fullSamples };

      const { result } = renderHook(() =>
        useSampleProcessing(optionsWithFullSamples),
      );

      const targetSlot = result.current.calculateTargetSlot(
        "/external/path/sample.wav",
        -1,
        5,
      );

      expect(targetSlot).toBe(-1);
    });

    it("should treat local store samples differently", () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const targetSlot = result.current.calculateTargetSlot(
        "/path/Test Kit/sample.wav", // From local store (contains kitName)
        -1,
        5,
      );

      expect(targetSlot).toBe(5); // Use droppedSlotNumber for local store
    });
  });

  describe("executeAssignment", () => {
    it("should show error when no available slots", async () => {
      const fullSamplesOptions = {
        ...mockOptions,
        samples: Array(12).fill("occupied.wav"), // All slots filled
      };
      const { result } = renderHook(() =>
        useSampleProcessing(fullSamplesOptions),
      );
      const { toast } = await import("sonner");

      await result.current.executeAssignment("/external/sample.wav", [], 0, {
        forceMono: false,
        replaceExisting: false,
      });

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "No available slots",
        {
          description: "Cannot add sample - all slots are filled",
          duration: 5000,
        },
      );
    });

    it("should call onSampleReplace when replacing existing sample", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      await result.current.executeAssignment(
        "/path/Test Kit/new.wav",
        [],
        0, // Slot with existing sample
        { forceMono: false, replaceExisting: true },
      );

      expect(mockOptions.onSampleReplace).toHaveBeenCalledWith(
        1,
        0,
        "/path/Test Kit/new.wav",
      );
      expect(mockOptions.onSampleAdd).not.toHaveBeenCalled();
    });

    it("should call onSampleAdd when adding new sample", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      await result.current.executeAssignment(
        "/path/new.wav",
        [],
        1, // Empty slot
        { forceMono: false, replaceExisting: false },
      );

      expect(mockOptions.onSampleAdd).toHaveBeenCalledWith(
        1,
        1,
        "/path/new.wav",
      );
      expect(mockOptions.onSampleReplace).not.toHaveBeenCalled();
    });

    it("should handle assignment errors", async () => {
      const mockError = new Error("Assignment failed");
      mockOptions.onSampleAdd.mockRejectedValue(mockError);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();
      const { result } = renderHook(() => useSampleProcessing(mockOptions));
      const { toast } = await import("sonner");

      await result.current.executeAssignment("/path/new.wav", [], 1, {
        forceMono: false,
        replaceExisting: false,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to assign sample:",
        "Assignment failed",
      );
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Failed to assign sample",
        {
          description: "Assignment failed",
          duration: 5000,
        },
      );

      consoleErrorSpy.mockRestore();
      mockOptions.onSampleAdd.mockReset();
    });

    it("should handle non-Error exceptions", async () => {
      mockOptions.onSampleAdd.mockRejectedValue("String error");

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();
      const { result } = renderHook(() => useSampleProcessing(mockOptions));
      const { toast } = await import("sonner");

      await result.current.executeAssignment("/path/new.wav", [], 1, {
        forceMono: false,
        replaceExisting: false,
      });

      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        "Failed to assign sample",
        {
          description: "String error",
          duration: 5000,
        },
      );

      consoleErrorSpy.mockRestore();
      mockOptions.onSampleAdd.mockReset();
    });
  });

  describe("processAssignment", () => {
    const mockFormatValidation = {
      metadata: { channels: 2 },
    };

    const mockAllSamples = [
      { source_path: "/path/sample1.wav", voice_number: 1 },
    ];

    const mockModifierKeys = {
      forceMonoDrop: false,
      forceStereoDrop: false,
    };

    beforeEach(() => {
      mockStereoHandling.analyzeStereoAssignment.mockReturnValue({
        assignAsMono: true,
        canAssign: true,
        requiresConfirmation: false,
        targetVoice: 1,
      });

      mockStereoHandling.handleStereoConflict.mockResolvedValue({
        cancel: false,
        forceMono: true,
        replaceExisting: false,
      });

      mockStereoHandling.applyStereoAssignment.mockResolvedValue(true);
    });

    it("should log sample information without modifiers", async () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation();

      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      await result.current.processAssignment(
        "/path/sample.wav",
        mockFormatValidation,
        mockAllSamples,
        mockModifierKeys,
        1,
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Sample has 2 channel(s), defaultToMonoSamples: true",
      );

      consoleLogSpy.mockRestore();
    });

    it("should log sample information with force mono modifier", async () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation();

      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      await result.current.processAssignment(
        "/path/sample.wav",
        mockFormatValidation,
        mockAllSamples,
        { forceMonoDrop: true, forceStereoDrop: false },
        1,
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Sample has 2 channel(s), defaultToMonoSamples: true, override: force mono",
      );

      consoleLogSpy.mockRestore();
    });

    it("should log sample information with force stereo modifier", async () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation();

      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      await result.current.processAssignment(
        "/path/sample.wav",
        mockFormatValidation,
        mockAllSamples,
        { forceMonoDrop: false, forceStereoDrop: true },
        1,
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Sample has 2 channel(s), defaultToMonoSamples: true, override: force stereo",
      );

      consoleLogSpy.mockRestore();
    });

    it("should execute assignment with correct parameters when force mono is used", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const success = await result.current.processAssignment(
        "/path/sample.wav",
        mockFormatValidation,
        mockAllSamples,
        { forceMonoDrop: true, forceStereoDrop: false },
        1,
      );

      expect(success).toBe(true);
      // Verify that executeAssignment was called with forceMono: true
      expect(mockOptions.onSampleAdd).toHaveBeenCalled();
    });

    it("should execute assignment with default settings", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const success = await result.current.processAssignment(
        "/path/sample.wav",
        mockFormatValidation,
        mockAllSamples,
        mockModifierKeys,
        1,
      );

      expect(success).toBe(true);
      expect(mockOptions.onSampleAdd).toHaveBeenCalled();
    });

    it("should execute assignment with force mono setting", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const success = await result.current.processAssignment(
        "/path/sample.wav",
        mockFormatValidation,
        mockAllSamples,
        { forceMonoDrop: true, forceStereoDrop: false },
        1,
      );

      expect(success).toBe(true);
      expect(mockOptions.onSampleAdd).toHaveBeenCalled();
    });

    it("should execute assignment with force stereo setting", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const success = await result.current.processAssignment(
        "/path/sample.wav",
        mockFormatValidation,
        mockAllSamples,
        { forceMonoDrop: false, forceStereoDrop: true },
        1,
      );

      expect(success).toBe(true);
      expect(mockOptions.onSampleAdd).toHaveBeenCalled();
    });

    it("should not apply stereo assignment for mono samples", async () => {
      const monoFormatValidation = {
        metadata: { channels: 1 },
      };

      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      await result.current.processAssignment(
        "/path/sample.wav",
        monoFormatValidation,
        mockAllSamples,
        mockModifierKeys,
        1,
      );

      expect(mockStereoHandling.applyStereoAssignment).not.toHaveBeenCalled();
    });

    it("should not apply stereo assignment when forced mono", async () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      await result.current.processAssignment(
        "/path/sample.wav",
        mockFormatValidation,
        mockAllSamples,
        mockModifierKeys,
        1,
      );

      // mockStereoHandling.analyzeStereoAssignment returns assignAsMono: true by default
      expect(mockStereoHandling.applyStereoAssignment).not.toHaveBeenCalled();
    });

    it("should handle missing metadata channels and default to 1 channel", async () => {
      const noChannelsValidation = {
        metadata: {},
      };

      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation();

      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      const success = await result.current.processAssignment(
        "/path/sample.wav",
        noChannelsValidation,
        mockAllSamples,
        mockModifierKeys,
        1,
      );

      expect(success).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Sample has 1 channel(s), defaultToMonoSamples: true",
      );
      expect(mockOptions.onSampleAdd).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });
  });

  describe("return values", () => {
    it("should return all expected functions", () => {
      const { result } = renderHook(() => useSampleProcessing(mockOptions));

      expect(result.current).toEqual({
        calculateTargetSlot: expect.any(Function),
        executeAssignment: expect.any(Function),
        getCurrentKitSamples: expect.any(Function),
        isDuplicateSample: expect.any(Function),
        processAssignment: expect.any(Function),
      });
    });
  });
});

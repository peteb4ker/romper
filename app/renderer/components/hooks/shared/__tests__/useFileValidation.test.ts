import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFileValidation } from "../useFileValidation";

describe("useFileValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset centralized mocks to default state
    if (window.electronFileAPI) {
      vi.mocked(window.electronFileAPI.getDroppedFilePath).mockResolvedValue(
        "/default/path.wav",
      );
    }

    if (window.electronAPI) {
      vi.mocked(window.electronAPI.validateSampleFormat).mockResolvedValue({
        data: {
          issues: [],
          isValid: true,
          metadata: { channels: 2, sampleRate: 44100 },
        },
        success: true,
      });
    }
  });

  describe("getFilePathFromDrop", () => {
    it("should use electronFileAPI when available", async () => {
      const mockFile = new File(["content"], "test.wav", {
        type: "audio/wav",
      });
      const expectedPath = "/path/to/test.wav";

      vi.mocked(window.electronFileAPI.getDroppedFilePath).mockResolvedValue(
        expectedPath,
      );

      const { result } = renderHook(() => useFileValidation());

      const filePath = await result.current.getFilePathFromDrop(mockFile);

      expect(window.electronFileAPI.getDroppedFilePath).toHaveBeenCalledWith(
        mockFile,
      );
      expect(filePath).toBe(expectedPath);
    });

    it("should fallback to file.path when electronFileAPI not available", async () => {
      const originalAPI = (window as unknown).electronFileAPI;
      (window as unknown).electronFileAPI = undefined;

      const mockFile = {
        name: "test.wav",
        path: "/fallback/path/test.wav",
      } as File;

      const { result } = renderHook(() => useFileValidation());

      const filePath = await result.current.getFilePathFromDrop(mockFile);

      expect(filePath).toBe("/fallback/path/test.wav");

      // Restore
      (window as unknown).electronFileAPI = originalAPI;
    });

    it("should fallback to file.name when file.path not available", async () => {
      const originalAPI = (window as unknown).electronFileAPI;
      (window as unknown).electronFileAPI = undefined;

      const mockFile = {
        name: "test.wav",
      } as File;

      const { result } = renderHook(() => useFileValidation());

      const filePath = await result.current.getFilePathFromDrop(mockFile);

      expect(filePath).toBe("test.wav");

      // Restore
      (window as unknown).electronFileAPI = originalAPI;
    });

    it("should handle electronFileAPI method not available", async () => {
      const originalAPI = window.electronFileAPI;
      (window as unknown).electronFileAPI = {}; // Missing getDroppedFilePath

      const mockFile = {
        name: "test.wav",
        path: "/fallback/path/test.wav",
      } as File;

      const { result } = renderHook(() => useFileValidation());

      const filePath = await result.current.getFilePathFromDrop(mockFile);

      expect(filePath).toBe("/fallback/path/test.wav");

      // Restore
      (window as unknown).electronFileAPI = originalAPI;
    });
  });

  describe("handleValidationIssues", () => {
    it("should reject and show error for critical issues", async () => {
      const { result } = renderHook(() => useFileValidation());

      const validation = {
        issues: [
          { message: "Unsupported extension", type: "extension" },
          { message: "File access denied", type: "fileAccess" },
          { message: "Bitrate warning", type: "bitrate" },
        ],
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const canContinue =
        await result.current.handleValidationIssues(validation);

      expect(canContinue).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Cannot assign sample due to critical format issues:",
        "Unsupported extension, File access denied",
      );

      consoleErrorSpy.mockRestore();
    });

    it("should allow and show warning for non-critical issues", async () => {
      const { result } = renderHook(() => useFileValidation());

      const validation = {
        issues: [
          { message: "High bitrate", type: "bitrate" },
          { message: "Unsupported sample rate", type: "sampleRate" },
        ],
      };

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      const canContinue =
        await result.current.handleValidationIssues(validation);

      expect(canContinue).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Sample has format issues that will require conversion during SD card sync:",
        "High bitrate, Unsupported sample rate",
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle invalidFormat as critical issue", async () => {
      const { result } = renderHook(() => useFileValidation());

      const validation = {
        issues: [{ message: "Invalid audio format", type: "invalidFormat" }],
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const canContinue =
        await result.current.handleValidationIssues(validation);

      expect(canContinue).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it("should handle empty issues array", async () => {
      const { result } = renderHook(() => useFileValidation());

      const validation = {
        issues: [],
      };

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      const canContinue =
        await result.current.handleValidationIssues(validation);

      expect(canContinue).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Sample has format issues that will require conversion during SD card sync:",
        "",
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle mixed critical and non-critical issues", async () => {
      const { result } = renderHook(() => useFileValidation());

      const validation = {
        issues: [
          { message: "Unsupported extension", type: "extension" },
          { message: "High bitrate", type: "bitrate" },
          { message: "File access denied", type: "fileAccess" },
        ],
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const canContinue =
        await result.current.handleValidationIssues(validation);

      expect(canContinue).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("validateDroppedFile", () => {
    const testFilePath = "/path/to/test.wav";

    it("should validate file successfully", async () => {
      const mockValidation = {
        issues: [],
        isValid: true,
        metadata: { channels: 2, sampleRate: 44100 },
      };

      vi.mocked(window.electronAPI.validateSampleFormat).mockResolvedValue({
        data: mockValidation,
        success: true,
      });

      const { result } = renderHook(() => useFileValidation());

      const validation = await result.current.validateDroppedFile(testFilePath);

      expect(window.electronAPI.validateSampleFormat).toHaveBeenCalledWith(
        testFilePath,
      );
      expect(validation).toEqual(mockValidation);
    });

    it("should handle invalid file with resolvable issues", async () => {
      const mockValidation = {
        issues: [{ message: "High bitrate", type: "bitrate" }],
        isValid: false,
        metadata: { channels: 2, sampleRate: 44100 },
      };

      vi.mocked(window.electronAPI.validateSampleFormat).mockResolvedValue({
        data: mockValidation,
        success: true,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const validation = await result.current.validateDroppedFile(testFilePath);

      expect(validation).toEqual(mockValidation);

      consoleWarnSpy.mockRestore();
    });

    it("should return null for invalid file with critical issues", async () => {
      const mockValidation = {
        issues: [{ message: "Unsupported extension", type: "extension" }],
        isValid: false,
        metadata: null,
      };

      vi.mocked(window.electronAPI.validateSampleFormat).mockResolvedValue({
        data: mockValidation,
        success: true,
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const validation = await result.current.validateDroppedFile(testFilePath);

      expect(validation).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it("should return null when electronAPI not available", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = undefined;

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const validation = await result.current.validateDroppedFile(testFilePath);

      expect(validation).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Format validation not available",
      );

      consoleErrorSpy.mockRestore();
      (window as unknown).electronAPI = originalAPI;
    });

    it("should return null when validateSampleFormat method not available", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = {}; // Missing validateSampleFormat

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const validation = await result.current.validateDroppedFile(testFilePath);

      expect(validation).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Format validation not available",
      );

      consoleErrorSpy.mockRestore();
      (window as unknown).electronAPI = originalAPI;
    });

    it("should return null when validation API call fails", async () => {
      vi.mocked(window.electronAPI.validateSampleFormat).mockResolvedValue({
        error: "Validation service unavailable",
        success: false,
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const validation = await result.current.validateDroppedFile(testFilePath);

      expect(validation).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Format validation failed:",
        "Validation service unavailable",
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return null when validation has no data", async () => {
      vi.mocked(window.electronAPI.validateSampleFormat).mockResolvedValue({
        data: null,
        success: true,
      });

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const validation = await result.current.validateDroppedFile(testFilePath);

      expect(validation).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Format validation failed:",
        undefined,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("return values", () => {
    it("should return all expected functions", () => {
      const { result } = renderHook(() => useFileValidation());

      expect(result.current).toEqual({
        getFilePathFromDrop: expect.any(Function),
        handleValidationIssues: expect.any(Function),
        validateDroppedFile: expect.any(Function),
      });
    });
  });
});

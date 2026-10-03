import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rejectionForIssues, useFileValidation } from "../useFileValidation";

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

  describe("[UC-19] rejectionForIssues (RE-40)", () => {
    it("rejects a file that isn't a WAV", () => {
      expect(
        rejectionForIssues([
          { message: "Unsupported extension", type: "extension" },
          { message: "File access denied", type: "fileAccess" },
        ]),
      ).toBe("notWav");
    });

    it("rejects a WAV that can't be read", () => {
      expect(
        rejectionForIssues([{ message: "Cannot read", type: "fileAccess" }]),
      ).toBe("unreadable");
      expect(
        rejectionForIssues([
          { message: "Invalid audio format", type: "invalidFormat" },
        ]),
      ).toBe("unreadable");
    });

    it("accepts issues that are converted at write time", () => {
      expect(
        rejectionForIssues([
          { message: "High bit depth", type: "bitDepth" },
          { message: "Unsupported sample rate", type: "sampleRate" },
        ]),
      ).toBeNull();
      expect(rejectionForIssues([])).toBeNull();
    });
  });

  describe("[UC-19] validateDroppedFile", () => {
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

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(window.electronAPI.validateSampleFormat).toHaveBeenCalledWith(
        testFilePath,
      );
      expect(check).toEqual({ validation: mockValidation });
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

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ validation: mockValidation });
    });

    it("rejects a file with critical issues as not a WAV", async () => {
      const mockValidation = {
        issues: [{ message: "Unsupported extension", type: "extension" }],
        isValid: false,
        metadata: null,
      };

      vi.mocked(window.electronAPI.validateSampleFormat).mockResolvedValue({
        data: mockValidation,
        success: true,
      });

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ rejection: "notWav" });
    });

    it("can't check the file when electronAPI isn't available", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = undefined;

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ rejection: "checkFailed" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[FileValidation] Format validation not available",
      );

      consoleWarnSpy.mockRestore();
      (window as unknown).electronAPI = originalAPI;
    });

    it("can't check the file when validateSampleFormat isn't available", async () => {
      const originalAPI = (window as unknown).electronAPI;
      (window as unknown).electronAPI = {}; // Missing validateSampleFormat

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ rejection: "checkFailed" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[FileValidation] Format validation not available",
      );

      consoleWarnSpy.mockRestore();
      (window as unknown).electronAPI = originalAPI;
    });

    it("can't check the file when the validation call fails", async () => {
      vi.mocked(window.electronAPI.validateSampleFormat).mockResolvedValue({
        error: "Validation service unavailable",
        success: false,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ rejection: "checkFailed" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[FileValidation] Format validation failed:",
        "Validation service unavailable",
      );

      consoleWarnSpy.mockRestore();
    });

    it("can't check the file when validation returns no data", async () => {
      vi.mocked(window.electronAPI.validateSampleFormat).mockResolvedValue({
        data: null,
        success: true,
      });

      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation();

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ rejection: "checkFailed" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[FileValidation] Format validation failed:",
        undefined,
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("return values", () => {
    it("should return all expected functions", () => {
      const { result } = renderHook(() => useFileValidation());

      expect(result.current).toEqual({
        getFilePathFromDrop: expect.any(Function),
        validateDroppedFile: expect.any(Function),
      });
    });
  });
});

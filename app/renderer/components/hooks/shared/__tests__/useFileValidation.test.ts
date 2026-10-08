import type { FormatValidationResult } from "@romper/shared/audioTypes";

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultElectronFileAPIMock } from "../../../../../../tests/mocks/electron/electronFileAPI";
import { rejectionForIssues, useFileValidation } from "../useFileValidation";

/** The getDroppedFilePath mock vitest.setup.ts installs */
const getDroppedFilePath = vi.mocked(
  defaultElectronFileAPIMock.getDroppedFilePath,
);

/** A file dropped from the desktop, with the path Electron gives it */
const droppedFile = (name: string, path?: string) =>
  Object.assign(new File([], name), path === undefined ? {} : { path });

describe("useFileValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset centralized mocks to default state
    getDroppedFilePath.mockResolvedValue("/default/path.wav");

    vi.mocked(globalThis.electronAPI.validateSampleFormat).mockResolvedValue({
      data: {
        issues: [],
        isValid: true,
        metadata: { channels: 2, sampleRate: 44100 },
      },
      success: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getFilePathFromDrop", () => {
    it("should use electronFileAPI when available", async () => {
      const mockFile = new File(["content"], "test.wav", {
        type: "audio/wav",
      });
      const expectedPath = "/path/to/test.wav";

      getDroppedFilePath.mockResolvedValue(expectedPath);

      const { result } = renderHook(() => useFileValidation());

      const filePath = await result.current.getFilePathFromDrop(mockFile);

      expect(getDroppedFilePath).toHaveBeenCalledWith(mockFile);
      expect(filePath).toBe(expectedPath);
    });

    it("should fallback to file.path when electronFileAPI not available", async () => {
      vi.stubGlobal("electronFileAPI", undefined);

      const mockFile = droppedFile("test.wav", "/fallback/path/test.wav");

      const { result } = renderHook(() => useFileValidation());

      const filePath = await result.current.getFilePathFromDrop(mockFile);

      expect(filePath).toBe("/fallback/path/test.wav");
    });

    it("should fallback to file.name when file.path not available", async () => {
      vi.stubGlobal("electronFileAPI", undefined);

      const mockFile = droppedFile("test.wav");

      const { result } = renderHook(() => useFileValidation());

      const filePath = await result.current.getFilePathFromDrop(mockFile);

      expect(filePath).toBe("test.wav");
    });

    it("should handle electronFileAPI method not available", async () => {
      vi.stubGlobal("electronFileAPI", {}); // Missing getDroppedFilePath

      const mockFile = droppedFile("test.wav", "/fallback/path/test.wav");

      const { result } = renderHook(() => useFileValidation());

      const filePath = await result.current.getFilePathFromDrop(mockFile);

      expect(filePath).toBe("/fallback/path/test.wav");
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
      const mockValidation: FormatValidationResult = {
        issues: [],
        isValid: true,
        metadata: { channels: 2, sampleRate: 44100 },
      };

      vi.mocked(globalThis.electronAPI.validateSampleFormat).mockResolvedValue({
        data: mockValidation,
        success: true,
      });

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(globalThis.electronAPI.validateSampleFormat).toHaveBeenCalledWith(
        testFilePath,
      );
      expect(check).toEqual({ validation: mockValidation });
    });

    it("should handle invalid file with resolvable issues", async () => {
      const mockValidation: FormatValidationResult = {
        issues: [{ message: "High bit depth", type: "bitDepth" }],
        isValid: false,
        metadata: { channels: 2, sampleRate: 44100 },
      };

      vi.mocked(globalThis.electronAPI.validateSampleFormat).mockResolvedValue({
        data: mockValidation,
        success: true,
      });

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ validation: mockValidation });
    });

    it("rejects a file with critical issues as not a WAV", async () => {
      const mockValidation: FormatValidationResult = {
        issues: [{ message: "Unsupported extension", type: "extension" }],
        isValid: false,
      };

      vi.mocked(globalThis.electronAPI.validateSampleFormat).mockResolvedValue({
        data: mockValidation,
        success: true,
      });

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ rejection: "notWav" });
    });

    it("can't check the file when electronAPI isn't available", async () => {
      vi.stubGlobal("electronAPI", undefined);

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ rejection: "checkFailed" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[FileValidation] Format validation not available",
      );

      consoleWarnSpy.mockRestore();
    });

    it("can't check the file when validateSampleFormat isn't available", async () => {
      vi.stubGlobal("electronAPI", {
        ...globalThis.electronAPI,
        validateSampleFormat: undefined,
      }); // Missing validateSampleFormat

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useFileValidation());

      const check = await result.current.validateDroppedFile(testFilePath);

      expect(check).toEqual({ rejection: "checkFailed" });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[FileValidation] Format validation not available",
      );

      consoleWarnSpy.mockRestore();
    });

    it("can't check the file when the validation call fails", async () => {
      vi.mocked(globalThis.electronAPI.validateSampleFormat).mockResolvedValue({
        error: "Validation service unavailable",
        success: false,
      });

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

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
      vi.mocked(globalThis.electronAPI.validateSampleFormat).mockResolvedValue({
        success: true,
      });

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

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

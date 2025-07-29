import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSampleManagement } from "../useSampleManagement";

// Mock window.electronAPI
const mockElectronAPI = {
  addSampleToSlot: vi.fn(),
  replaceSampleInSlot: vi.fn(),
  deleteSampleFromSlot: vi.fn(),
};

beforeEach(() => {
  (window as any).electronAPI = mockElectronAPI;
  vi.clearAllMocks();
});

afterEach(() => {
  delete (window as any).electronAPI;
});

describe("useSampleManagement", () => {
  const defaultProps = {
    kitName: "TestKit",
    onSamplesChanged: vi.fn(),
    onMessage: vi.fn(),
  };

  describe("handleSampleAdd", () => {
    it("adds sample successfully", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        success: true,
        data: { sampleId: 123 },
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalledWith(
        "TestKit",
        1,
        0,
        "/path/to/sample.wav",
        undefined,
      );
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample added to voice 1, slot 1",
      });
    });

    it("handles add sample failure", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        success: false,
        error: "File not found",
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "File not found",
      });
    });

    it("handles API not available", async () => {
      const originalMethod = (window as any).electronAPI.addSampleToSlot;
      delete (window as any).electronAPI.addSampleToSlot;

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Sample management not available",
      });

      // Restore for other tests
      (window as any).electronAPI.addSampleToSlot = originalMethod;
    });

    it("handles exceptions", async () => {
      mockElectronAPI.addSampleToSlot.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Failed to add sample: Network error",
      });
    });
  });

  describe("handleSampleReplace", () => {
    it("replaces sample successfully", async () => {
      mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
        success: true,
        data: { sampleId: 456 },
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleReplace(2, 3, "/path/to/new.wav");

      expect(mockElectronAPI.replaceSampleInSlot).toHaveBeenCalledWith(
        "TestKit",
        2,
        3,
        "/path/to/new.wav",
        undefined,
      );
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample replaced in voice 2, slot 4",
      });
    });

    it("handles replace sample failure", async () => {
      mockElectronAPI.replaceSampleInSlot.mockResolvedValue({
        success: false,
        error: "Invalid format",
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleReplace(2, 3, "/path/to/new.wav");

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Invalid format",
      });
    });
  });

  describe("handleSampleDelete", () => {
    it("deletes sample successfully", async () => {
      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleDelete(3, 5);

      expect(mockElectronAPI.deleteSampleFromSlot).toHaveBeenCalledWith(
        "TestKit",
        3,
        5,
      );
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample deleted from voice 3, slot 6",
      });
    });

    it("handles delete sample failure", async () => {
      mockElectronAPI.deleteSampleFromSlot.mockResolvedValue({
        success: false,
        error: "Sample not found",
      });

      const { result } = renderHook(() => useSampleManagement(defaultProps));

      await result.current.handleSampleDelete(3, 5);

      expect(defaultProps.onSamplesChanged).not.toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "error",
        text: "Sample not found",
      });
    });
  });

  describe("without callbacks", () => {
    it("works without onSamplesChanged callback", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        success: true,
        data: { sampleId: 123 },
      });

      const { result } = renderHook(() =>
        useSampleManagement({
          kitName: "TestKit",
          onMessage: defaultProps.onMessage,
        }),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalled();
      expect(defaultProps.onMessage).toHaveBeenCalledWith({
        type: "success",
        text: "Sample added to voice 1, slot 1",
      });
    });

    it("works without onMessage callback", async () => {
      mockElectronAPI.addSampleToSlot.mockResolvedValue({
        success: true,
        data: { sampleId: 123 },
      });

      const { result } = renderHook(() =>
        useSampleManagement({
          kitName: "TestKit",
          onSamplesChanged: defaultProps.onSamplesChanged,
        }),
      );

      await result.current.handleSampleAdd(1, 0, "/path/to/sample.wav");

      expect(mockElectronAPI.addSampleToSlot).toHaveBeenCalled();
      expect(defaultProps.onSamplesChanged).toHaveBeenCalled();
    });
  });
});

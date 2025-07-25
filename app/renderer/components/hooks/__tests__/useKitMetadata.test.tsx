import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsProvider } from "../../../utils/SettingsContext";
import { useKitMetadata } from "../useKitMetadata";

// Mock the SettingsContext
vi.mock("../../../utils/SettingsContext", () => ({
  useSettings: () => ({
    settings: { localStorePath: "/test/path" },
  }),
  SettingsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock window.electronAPI
const mockElectronAPI = {
  getKitMetadata: vi.fn(),
  updateKit: vi.fn(),
  updateVoiceAlias: vi.fn(),
  updateStepPattern: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // @ts-ignore
  window.electronAPI = mockElectronAPI;
});

describe("useKitMetadata", () => {
  const defaultProps = {
    kitName: "A1",
    localStorePath: "/test/path",
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    return <SettingsProvider>{children}</SettingsProvider>;
  };

  it("loads kit metadata successfully", async () => {
    const mockMetadata = {
      id: 1,
      name: "A1",
      alias: "Test Kit",
      artist: "Test Artist",
      editable: false,
      locked: false,
      voices: { 1: "Kick", 2: "Snare", 3: "HiHat", 4: "Cymbal" },
    };

    mockElectronAPI.getKitMetadata.mockResolvedValue({
      success: true,
      data: mockMetadata,
    });

    const { result } = renderHook(() => useKitMetadata(defaultProps), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.kitMetadata).toEqual(mockMetadata);
    expect(result.current.error).toBeNull();
    expect(mockElectronAPI.getKitMetadata).toHaveBeenCalledWith(
      "/test/path",
      "A1",
    );
  });

  it("handles kit not found and creates default metadata", async () => {
    mockElectronAPI.getKitMetadata.mockResolvedValue({
      success: false,
      error: "Kit not found",
    });

    const { result } = renderHook(() => useKitMetadata(defaultProps), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.kitMetadata).toEqual({
      id: 0,
      name: "A1",
      editable: false,
      locked: false,
      voices: { 1: "", 2: "", 3: "", 4: "" },
    });
  });

  it("handles loading errors", async () => {
    mockElectronAPI.getKitMetadata.mockRejectedValue(
      new Error("Database error"),
    );

    const { result } = renderHook(() => useKitMetadata(defaultProps), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Database error");
    expect(result.current.kitMetadata).toBeNull();
  });

  it("updates kit metadata successfully", async () => {
    const mockMetadata = {
      id: 1,
      name: "A1",
      editable: false,
      locked: false,
      voices: { 1: "", 2: "", 3: "", 4: "" },
    };

    mockElectronAPI.getKitMetadata
      .mockResolvedValueOnce({ success: true, data: mockMetadata })
      .mockResolvedValueOnce({
        success: true,
        data: { ...mockMetadata, alias: "Updated Kit" },
      });

    mockElectronAPI.updateKit.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useKitMetadata(defaultProps), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.handleSaveKitLabel("Updated Kit");

    expect(mockElectronAPI.updateKit).toHaveBeenCalledWith("/test/path", "A1", {
      alias: "Updated Kit",
    });
  });

  it("updates voice alias successfully", async () => {
    const mockMetadata = {
      id: 1,
      name: "A1",
      editable: false,
      locked: false,
      voices: { 1: "", 2: "", 3: "", 4: "" },
    };

    mockElectronAPI.getKitMetadata
      .mockResolvedValueOnce({ success: true, data: mockMetadata })
      .mockResolvedValueOnce({
        success: true,
        data: { ...mockMetadata, voices: { 1: "Kick", 2: "", 3: "", 4: "" } },
      });

    mockElectronAPI.updateVoiceAlias.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useKitMetadata(defaultProps), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.handleSaveVoiceName(1, "Kick");

    expect(mockElectronAPI.updateVoiceAlias).toHaveBeenCalledWith(
      "/test/path",
      "A1",
      1,
      "Kick",
    );
  });

  it("updates step pattern successfully", async () => {
    const mockMetadata = {
      id: 1,
      name: "A1",
      editable: false,
      locked: false,
      voices: { 1: "", 2: "", 3: "", 4: "" },
    };

    const stepPattern = [
      [127, 0, 127, 0, 127, 0, 127, 0, 127, 0, 127, 0, 127, 0, 127, 0],
      [0, 127, 0, 127, 0, 127, 0, 127, 0, 127, 0, 127, 0, 127, 0, 127],
      [0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0, 0, 0, 127, 0],
      [0, 0, 0, 0, 127, 0, 0, 0, 0, 0, 0, 0, 127, 0, 0, 0],
    ];

    mockElectronAPI.getKitMetadata
      .mockResolvedValueOnce({ success: true, data: mockMetadata })
      .mockResolvedValueOnce({
        success: true,
        data: { ...mockMetadata, step_pattern: stepPattern },
      });

    mockElectronAPI.updateStepPattern.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useKitMetadata(defaultProps), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.setStepPattern(stepPattern);

    expect(mockElectronAPI.updateStepPattern).toHaveBeenCalledWith(
      "/test/path",
      "A1",
      stepPattern,
    );
  });

  it("initializes step pattern for kit without existing pattern", async () => {
    const mockMetadata = {
      id: 1,
      name: "A1",
      editable: false,
      locked: false,
      voices: { 1: "", 2: "", 3: "", 4: "" },
    };

    mockElectronAPI.getKitMetadata.mockResolvedValue({
      success: true,
      data: mockMetadata,
    });

    const { result } = renderHook(() => useKitMetadata(defaultProps), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Test that step pattern is an array of 4 voices with 16 steps each
    expect(result.current.stepPattern).toHaveLength(4);
    expect(result.current.stepPattern[0]).toHaveLength(16);
    expect(result.current.stepPattern[1]).toHaveLength(16);
    expect(result.current.stepPattern[2]).toHaveLength(16);
    expect(result.current.stepPattern[3]).toHaveLength(16);

    // Each step should be a number (velocity value)
    result.current.stepPattern.forEach((voice) => {
      voice.forEach((step) => {
        expect(typeof step).toBe("number");
      });
    });
  });
});

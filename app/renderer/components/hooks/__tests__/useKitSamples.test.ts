// Test suite for useKitSamples hook
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useKitSamples } from "../useKitSamples";

describe("useKitSamples", () => {
  const kitName = "TestKit";
  const localStorePath = "/sd";
  let getAllSamplesForKit: any;
  let getKitMetadata: any;
  let setKitLabel: any;
  beforeEach(() => {
    getAllSamplesForKit = vi.fn();
    getKitMetadata = vi.fn();
    setKitLabel = vi.fn();
    window.electronAPI = {
      getAllSamplesForKit,
      getKitMetadata,
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("uses propSamples if provided", () => {
    const propSamples = { 1: ["kick.wav"], 2: ["snare.wav"] };
    const { result } = renderHook(() =>
      useKitSamples(
        { kitName, localStorePath, samples: propSamples },
        setKitLabel,
      ),
    );
    expect(result.current.samples).toEqual(propSamples);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("loads samples from database and voice names from metadata", async () => {
    getAllSamplesForKit.mockResolvedValue({
      success: true,
      data: [
        { filename: "1 Kick.wav", voice_number: 1 },
        { filename: "2 Snare.wav", voice_number: 2 },
        { filename: "3 Hat.wav", voice_number: 3 },
        { filename: "4 Tom.wav", voice_number: 4 },
      ],
    });
    getKitMetadata.mockResolvedValue({
      success: true,
      data: {
        voices: { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" },
      },
    });

    const { result, rerender } = renderHook(() =>
      useKitSamples({ kitName, localStorePath }, setKitLabel),
    );

    // Wait for loading to complete
    await waitFor(() => result.current.loading === false, { timeout: 5000 });

    // Force a re-render to ensure we get the latest state
    rerender();

    expect(getAllSamplesForKit).toHaveBeenCalledWith(kitName);
    expect(getKitMetadata).toHaveBeenCalledWith(kitName);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.samples).toEqual({
      1: ["1 Kick.wav"],
      2: ["2 Snare.wav"],
      3: ["3 Hat.wav"],
      4: ["4 Tom.wav"],
    });
    expect(result.current.voiceNames).toEqual({
      1: "Kick",
      2: "Snare",
      3: "Hat",
      4: "Tom",
    });
  });

  it("sets error if database call fails", async () => {
    getAllSamplesForKit.mockResolvedValue({
      success: false,
      error: "Database error",
    });
    const { result, rerender } = renderHook(() =>
      useKitSamples({ kitName, localStorePath }, setKitLabel),
    );
    await waitFor(() => result.current.loading === false, { timeout: 5000 });

    // Force a re-render to ensure we get the latest state
    rerender();

    expect(result.current.error).toBe("Failed to load kit samples.");
    expect(result.current.loading).toBe(false);
  });
});

import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { SettingsContext } from "../../../../utils/SettingsContext";
import { useStereoHandling } from "../useStereoHandling";

// Create a wrapper with SettingsContext
const createWrapper = (defaultToMonoSamples: boolean) => {
  return ({ children }: { children: React.ReactNode }) => (
    <SettingsContext.Provider
      value={{
        confirmDestructiveActions: true,
        defaultToMonoSamples,
        isDarkMode: false,
        isInitialized: true,
        localStorePath: "/test/path",
        localStoreStatus: { isValid: true },
        setConfirmDestructiveActions: vi.fn(),
        setDefaultToMonoSamples: vi.fn(),
        setLocalStorePath: vi.fn(),
        setThemeMode: vi.fn(),
        themeMode: "light",
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

describe("useStereoHandling", () => {
  describe("analyzeStereoAssignment with overrides (Task 7.1.3)", () => {
    it("forces mono when override.forceMono is true", () => {
      const wrapper = createWrapper(false); // Global setting is OFF (stereo by default)
      const { result } = renderHook(() => useStereoHandling(), { wrapper });

      const stereoResult = result.current.analyzeStereoAssignment(
        1, // voice 1
        2, // stereo file (2 channels)
        [], // no existing samples
        { forceMono: true, forceStereo: false } // Override to force mono
      );

      expect(stereoResult.assignAsMono).toBe(true);
      expect(stereoResult.canAssign).toBe(true);
      expect(stereoResult.requiresConfirmation).toBe(false);
    });

    it("forces stereo when override.forceStereo is true", () => {
      const wrapper = createWrapper(true); // Global setting is ON (mono by default)
      const { result } = renderHook(() => useStereoHandling(), { wrapper });

      const stereoResult = result.current.analyzeStereoAssignment(
        1, // voice 1
        2, // stereo file (2 channels)
        [], // no existing samples
        { forceMono: false, forceStereo: true } // Override to force stereo
      );

      expect(stereoResult.assignAsMono).toBe(false);
      expect(stereoResult.canAssign).toBe(true);
      expect(stereoResult.requiresConfirmation).toBe(false);
    });

    it("respects global setting when no override provided", () => {
      const wrapper = createWrapper(true); // Global setting is ON (mono by default)
      const { result } = renderHook(() => useStereoHandling(), { wrapper });

      const stereoResult = result.current.analyzeStereoAssignment(
        1, // voice 1
        2, // stereo file (2 channels)
        [], // no existing samples
        undefined // No override - use global setting
      );

      expect(stereoResult.assignAsMono).toBe(true);
      expect(stereoResult.canAssign).toBe(true);
      expect(stereoResult.requiresConfirmation).toBe(false);
    });

    it("works with mono files regardless of override", () => {
      const wrapper = createWrapper(false); // Global setting is OFF
      const { result } = renderHook(() => useStereoHandling(), { wrapper });

      const stereoResult = result.current.analyzeStereoAssignment(
        1, // voice 1
        1, // mono file (1 channel)
        [], // no existing samples
        { forceMono: false, forceStereo: true } // Try to force stereo on mono file
      );

      expect(stereoResult.assignAsMono).toBe(true); // Should still be mono because file is mono
      expect(stereoResult.canAssign).toBe(true);
      expect(stereoResult.requiresConfirmation).toBe(false);
    });

    it("handles edge case: force stereo to voice 4", () => {
      const wrapper = createWrapper(true); // Global setting is ON (mono by default)
      const { result } = renderHook(() => useStereoHandling(), { wrapper });

      const stereoResult = result.current.analyzeStereoAssignment(
        4, // voice 4 (no voice 5 available)
        2, // stereo file (2 channels)
        [], // no existing samples
        { forceMono: false, forceStereo: true } // Try to force stereo to voice 4
      );

      expect(stereoResult.canAssign).toBe(false);
      expect(stereoResult.requiresConfirmation).toBe(true);
      expect(stereoResult.conflictInfo?.nextVoice).toBe(5); // Voice 5 doesn't exist
    });

    it("handles conflicts with existing samples when forcing stereo", () => {
      const wrapper = createWrapper(true); // Global setting is ON (mono by default)
      const { result } = renderHook(() => useStereoHandling(), { wrapper });

      const existingSamples = [
        { filename: "existing.wav", voice_number: 2 }, // Voice 2 has existing sample
      ];

      const stereoResult = result.current.analyzeStereoAssignment(
        1, // voice 1
        2, // stereo file (2 channels)
        existingSamples,
        { forceMono: false, forceStereo: true } // Force stereo would need voices 1 and 2
      );

      expect(stereoResult.canAssign).toBe(false);
      expect(stereoResult.requiresConfirmation).toBe(true);
      expect(stereoResult.conflictInfo).toBeDefined();
      expect(stereoResult.conflictInfo?.nextVoice).toBe(2);
    });
  });
});

import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../tests/mocks/electron/electronAPI";
import { SettingsProvider, useSettings } from "../SettingsContext";

// Mock electronAPI
const mockElectronAPI = {
  getLocalStoreStatus: vi.fn(),
  readSettings: vi.fn(),
  setSetting: vi.fn(),
};

// Mock matchMedia
const mockMatchMedia = vi.fn((query: string) => ({
  addEventListener: vi.fn(),
  matches: query === "(prefers-color-scheme: dark)",
  media: query,
  removeEventListener: vi.fn(),
}));

describe("SettingsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-setup electronAPI mock after clearAllMocks
    setupElectronAPIMock();

    // Setup window mocks using centralized mocks
    Object.assign(window.electronAPI, mockElectronAPI);
    window.matchMedia = mockMatchMedia as any;

    // Mock document.documentElement.classList
    document.documentElement.classList.toggle = vi.fn();

    // Mock console methods
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Default mock implementations
    mockElectronAPI.readSettings.mockResolvedValue({
      confirmDestructiveActions: true,
      darkMode: false,
      defaultToMonoSamples: true,
      localStorePath: "/test/path",
      sdCardPath: "/test/sd/card",
      themeMode: "light",
    });

    mockElectronAPI.setSetting.mockResolvedValue(undefined);

    mockElectronAPI.getLocalStoreStatus.mockResolvedValue({
      hasLocalStore: true,
      isValid: true,
      localStorePath: "/test/path",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("SettingsProvider initialization", () => {
    it("initializes with settings from electronAPI", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      // Wait for the full initialization cycle to complete
      await act(async () => {
        // Wait for multiple frames to ensure all async operations complete
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current).not.toBe(null);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.localStorePath).toBe("/test/path");
      expect(result.current.themeMode).toBe("light");
      expect(result.current.isDarkMode).toBe(false);
      expect(result.current.defaultToMonoSamples).toBe(true);
      expect(result.current.confirmDestructiveActions).toBe(true);
    });

    it("handles initialization errors gracefully", async () => {
      mockElectronAPI.readSettings.mockRejectedValue(new Error("Read failed"));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current).not.toBe(null);
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.error).toBe("Read failed");
    });

    it("applies default values when settings are missing", async () => {
      mockElectronAPI.readSettings.mockResolvedValue({});

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current).not.toBe(null);
      expect(result.current.localStorePath).toBe(null);
      expect(result.current.themeMode).toBe("system");
      expect(result.current.defaultToMonoSamples).toBe(true);
      expect(result.current.confirmDestructiveActions).toBe(true);
    });
  });

  describe("Settings updates", () => {
    it("updates local store path", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await act(async () => {
        await result.current.setLocalStorePath("/new/path");
      });

      expect(mockElectronAPI.setSetting).toHaveBeenCalledWith(
        "localStorePath",
        "/new/path"
      );
      expect(result.current.localStorePath).toBe("/new/path");
    });

    it("updates theme mode and applies dark class", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await act(async () => {
        await result.current.setThemeMode("dark");
      });

      expect(result.current.themeMode).toBe("dark");
      expect(result.current.isDarkMode).toBe(true);
      expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
        "dark",
        true
      );
    });

    it("handles system theme preference", async () => {
      mockMatchMedia.mockReturnValue({
        addEventListener: vi.fn(),
        matches: true, // System prefers dark
        media: "(prefers-color-scheme: dark)",
        removeEventListener: vi.fn(),
      });

      mockElectronAPI.readSettings.mockResolvedValue({
        themeMode: "system",
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current).not.toBe(null);
      expect(result.current.themeMode).toBe("system");
      expect(result.current.isDarkMode).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("handles setSetting errors", async () => {
      mockElectronAPI.setSetting.mockRejectedValue(new Error("Save failed"));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      await act(async () => {
        await result.current.setDefaultToMonoSamples(false);
      });

      expect(result.current).not.toBe(null);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to update defaultToMonoSamples setting:",
        expect.any(Error)
      );
    });

    it("clears error state", async () => {
      mockElectronAPI.readSettings.mockRejectedValue(new Error("Init failed"));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <SettingsProvider>{children}</SettingsProvider>
      );

      const { result } = renderHook(() => useSettings(), { wrapper });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(result.current).not.toBe(null);
      expect(result.current.error).toBe("Init failed");

      act(() => {
        result.current.clearError();
      });

      expect(result.current).not.toBe(null);
      expect(result.current.error).toBe(null);
    });
  });

  describe("useSettings hook", () => {
    it("throws error when used outside SettingsProvider", () => {
      expect(() => {
        renderHook(() => useSettings());
      }).toThrow("useSettings must be used within a SettingsProvider");
    });
  });
});

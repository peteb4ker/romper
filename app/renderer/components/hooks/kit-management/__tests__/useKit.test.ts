import type { KitWithRelations } from "@romper/shared/db/schema";

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMockKitWithRelations } from "../../../../../../tests/factories/kit.factory";
import { createMockVoice } from "../../../../../../tests/factories/voice.factory";
import { setupElectronAPIMock } from "../../../../../../tests/mocks/electron/electronAPI";
import { useKit } from "../useKit";

// Mock window.electronAPI
const mockElectronAPI = {
  getKit: vi.fn(),
  updateKit: vi.fn(),
};

beforeEach(() => {
  setupElectronAPIMock(mockElectronAPI);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useKit", () => {
  const mockKit: KitWithRelations = createMockKitWithRelations({
    alias: "Test Alias",
    bank_letter: "T",
    editable: true,
    name: "TestKit",
    voices: [
      createMockVoice({
        id: 1,
        kit_name: "TestKit",
        voice_alias: "Kick",
        voice_number: 1,
      }),
      createMockVoice({
        id: 2,
        kit_name: "TestKit",
        voice_alias: "Snare",
        voice_number: 2,
      }),
      createMockVoice({
        id: 3,
        kit_name: "TestKit",
        voice_alias: "Hat",
        voice_number: 3,
      }),
      createMockVoice({
        id: 4,
        kit_name: "TestKit",
        voice_alias: "Tom",
        voice_number: 4,
      }),
    ],
  });

  describe("loadKit", () => {
    it("loads kit data successfully", async () => {
      mockElectronAPI.getKit.mockResolvedValue({
        data: mockKit,
        success: true,
      });

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      await waitFor(() => {
        expect(result.current.kit).toEqual(mockKit);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(null);
      });

      expect(mockElectronAPI.getKit).toHaveBeenCalledWith("TestKit");
    });

    it("handles loading errors", async () => {
      mockElectronAPI.getKit.mockRejectedValue(new Error("Database error"));

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      await waitFor(() => {
        expect(result.current.kit).toBe(null);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe("Database error");
      });
    });

    it("handles empty kitName", async () => {
      const { result } = renderHook(() => useKit({ kitName: "" }));

      expect(result.current.kit).toBe(null);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(mockElectronAPI.getKit).not.toHaveBeenCalled();
    });
  });

  describe("updateKitAlias", () => {
    it("updates kit alias successfully", async () => {
      mockElectronAPI.getKit.mockResolvedValue({
        data: mockKit,
        success: true,
      });
      mockElectronAPI.updateKit.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.kit).toEqual(mockKit);
      });

      // Update alias
      await result.current.updateKitAlias("New Alias");

      expect(mockElectronAPI.updateKit).toHaveBeenCalledWith("TestKit", {
        alias: "New Alias",
      });
      // Should reload kit after update
      expect(mockElectronAPI.getKit).toHaveBeenCalledTimes(2);
    });

    it("handles update errors", async () => {
      mockElectronAPI.getKit.mockResolvedValue({
        data: mockKit,
        success: true,
      });
      mockElectronAPI.updateKit.mockResolvedValue({
        error: "Update failed",
        success: false,
      });

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      await waitFor(() => {
        expect(result.current.kit).toEqual(mockKit);
      });

      await result.current.updateKitAlias("New Alias");

      await waitFor(() => {
        expect(result.current.error).toBe("Update failed");
      });
    });
  });

  describe("toggleEditableMode - Task 5.1.2", () => {
    it("toggles editable mode from false to true", async () => {
      const editableKit = { ...mockKit, editable: false };
      mockElectronAPI.getKit.mockResolvedValue({
        data: editableKit,
        success: true,
      });
      mockElectronAPI.updateKit.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      await waitFor(() => {
        expect(result.current.kit?.editable).toBe(false);
      });

      await result.current.toggleEditableMode();

      expect(mockElectronAPI.updateKit).toHaveBeenCalledWith("TestKit", {
        editable: true,
      });
      // Should reload kit after toggle
      expect(mockElectronAPI.getKit).toHaveBeenCalledTimes(2);
    });

    it("toggles editable mode from true to false", async () => {
      const editableKit = { ...mockKit, editable: true };
      mockElectronAPI.getKit.mockResolvedValue({
        data: editableKit,
        success: true,
      });
      mockElectronAPI.updateKit.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      await waitFor(() => {
        expect(result.current.kit?.editable).toBe(true);
      });

      await result.current.toggleEditableMode();

      expect(mockElectronAPI.updateKit).toHaveBeenCalledWith("TestKit", {
        editable: false,
      });
    });

    it("handles toggle errors", async () => {
      mockElectronAPI.getKit.mockResolvedValue({
        data: mockKit,
        success: true,
      });
      mockElectronAPI.updateKit.mockResolvedValue({
        error: "Toggle failed",
        success: false,
      });

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      await waitFor(() => {
        expect(result.current.kit).toEqual(mockKit);
      });

      await result.current.toggleEditableMode();

      await waitFor(() => {
        expect(result.current.error).toBe("Toggle failed");
      });
    });

    it("does nothing when electronAPI is not available", async () => {
      vi.stubGlobal("electronAPI", undefined);

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      await result.current.toggleEditableMode();

      // No API calls should be made
      expect(mockElectronAPI.updateKit).not.toHaveBeenCalled();
    });

    it("does nothing when kitName is empty", async () => {
      mockElectronAPI.getKit.mockResolvedValue({
        data: mockKit,
        success: true,
      });

      const { result } = renderHook(() => useKit({ kitName: "" }));

      await result.current.toggleEditableMode();

      expect(mockElectronAPI.updateKit).not.toHaveBeenCalled();
    });

    it("does nothing when kit is null", async () => {
      mockElectronAPI.getKit.mockResolvedValue({
        data: null,
        success: true,
      });

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      await waitFor(() => {
        expect(result.current.kit).toBe(null);
      });

      await result.current.toggleEditableMode();

      expect(mockElectronAPI.updateKit).not.toHaveBeenCalled();
    });
  });

  describe("reloadKit", () => {
    it("provides reloadKit function that reloads kit data", async () => {
      mockElectronAPI.getKit.mockResolvedValue({
        data: mockKit,
        success: true,
      });

      const { result } = renderHook(() => useKit({ kitName: "TestKit" }));

      await waitFor(() => {
        expect(result.current.kit).toEqual(mockKit);
      });

      // Call reloadKit
      await result.current.reloadKit();

      // Should call getKit again
      expect(mockElectronAPI.getKit).toHaveBeenCalledTimes(2);
    });
  });
});

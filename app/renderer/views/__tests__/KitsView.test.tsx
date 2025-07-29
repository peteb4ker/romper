// Test suite for KitsView component
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import KitsView from "../KitsView";
import { TestSettingsProvider } from "./TestSettingsProvider";

describe("KitsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup IntersectionObserver mock
    const mockObserver = {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };

    global.IntersectionObserver = vi.fn(() => mockObserver);
    Object.defineProperty(window, "IntersectionObserver", {
      writable: true,
      configurable: true,
      value: global.IntersectionObserver,
    });

    // Mock all electronAPI methods for database-first architecture
    window.electronAPI = {
      // Database operations
      getKits: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            name: "A0",
            bank_letter: "A",
            alias: null,
            artist: null,
            editable: false,
            locked: false,
            step_pattern: null,
            modified_since_sync: false,
          },
          {
            name: "A1",
            bank_letter: "A",
            alias: null,
            artist: null,
            editable: false,
            locked: false,
            step_pattern: null,
            modified_since_sync: false,
          },
        ],
      }),
      getAllSamplesForKit: vi.fn().mockImplementation((kitName: string) => {
        return Promise.resolve({
          success: true,
          data: [
            { filename: "1 Kick.wav", voice_number: 1, slot_number: 0 },
            { filename: "2 Snare.wav", voice_number: 2, slot_number: 0 },
            { filename: "3 Hat.wav", voice_number: 3, slot_number: 0 },
            { filename: "4 Tom.wav", voice_number: 4, slot_number: 0 },
          ],
        });
      }),

      // Legacy methods removed - now using database
      getAudioBuffer: vi
        .fn()
        .mockResolvedValue({ slice: () => new ArrayBuffer(8) }),

      // Other required methods
      selectSdCard: vi.fn().mockResolvedValue("/sd"),
      getUserHomeDir: vi.fn().mockResolvedValue("/mock/home"),
      readSettings: vi
        .fn()
        .mockResolvedValue({ localStorePath: "/mock/local/store" }),
      setSetting: vi.fn().mockResolvedValue(undefined),
      getSetting: vi.fn().mockResolvedValue("/mock/local/store"),
      createKit: vi.fn().mockResolvedValue(undefined),
      copyKit: vi.fn().mockResolvedValue(undefined),
      selectLocalStorePath: vi.fn().mockResolvedValue("/mock/custom/path"),
      getLocalStoreStatus: vi
        .fn()
        .mockResolvedValue({ isValid: true, hasLocalStore: true }),
      scanBanks: vi.fn().mockResolvedValue({
        success: true,
        data: { updatedBanks: 2 },
      }),
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up DOM and reset modules
    cleanup();
  });
  it("renders KitBrowser with kits", async () => {
    render(
      <TestSettingsProvider>
        <KitsView />
      </TestSettingsProvider>,
    );
    // There may be multiple elements with the same kit label, so use findAllByText
    const kitA0s = await screen.findAllByText("A0");
    const kitA1s = await screen.findAllByText("A1");
    expect(kitA0s.length).toBeGreaterThan(0);
    expect(kitA1s.length).toBeGreaterThan(0);
  });
});

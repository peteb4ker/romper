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
    // Ensure we have a proper window object
    if (typeof window === "undefined") {
      global.window = {} as any;
    }

    // Mock all electronAPI methods outside of the test body for isolation
    window.electronAPI = {
      listFilesInRoot: vi.fn().mockImplementation((path: string) => {
        // When called with the local store path, return kit folders
        if (path === "/mock/local/store") {
          return Promise.resolve(["A0", "A1"]);
        }
        // When called with specific kit paths, return WAV files
        return Promise.resolve([
          "1 Kick.wav",
          "2 Snare.wav",
          "3 Hat.wav",
          "4 Tom.wav",
        ]);
      }),
      readRampleLabels: vi.fn().mockResolvedValue({
        kits: {
          A0: {
            label: "A0",
            // Directly mock the result of inference logic:
            voiceNames: { 1: "Kick", 2: "Snare", 3: "Hat", 4: "Tom" },
          },
          A1: { label: "A1", voiceNames: {} },
        },
      }),
      getAudioBuffer: vi
        .fn()
        .mockResolvedValue({ slice: () => new ArrayBuffer(8) }),
      writeRampleLabels: vi.fn().mockResolvedValue(undefined),
      // Add other required methods that might be missing
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

  it("calls listFilesInRoot only once per render cycle", async () => {
    // Render the component
    render(
      <TestSettingsProvider>
        <KitsView />
      </TestSettingsProvider>,
    );

    // Wait for initial rendering and data loading to complete
    await waitFor(() => {
      expect(window.electronAPI.listFilesInRoot).toHaveBeenCalledWith(
        "/mock/local/store",
      );
    });

    // Store the current call count
    const initialCallCount =
      window.electronAPI.listFilesInRoot.mock.calls.length;

    // Force a component update by changing a prop in a parent component
    // This is simulated by waiting a bit and checking if more calls were made
    await new Promise((resolve) => setTimeout(resolve, 500));

    // The call count should not have increased from the initial calls
    // We check that no additional calls have been made, which would indicate an infinite loop
    expect(window.electronAPI.listFilesInRoot.mock.calls.length).toBe(
      initialCallCount,
    );
  });
});

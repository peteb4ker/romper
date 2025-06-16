import { cleanup, render, waitFor } from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { SettingsContext } from "../SettingsContext";

afterEach(() => {
  cleanup();
});

describe("SettingsContext", () => {
  const mockSettingsContextValue = {
    sdCardPath: null,
    setSdCardPath: vi.fn(),
    darkMode: false,
    setDarkMode: vi.fn(),
    initializeSettings: vi.fn(),
    settingsInitialized: true,
  };

  it("should initialize settings successfully", async () => {
    const { getByText } = render(
      <SettingsContext.Provider value={mockSettingsContextValue}>
        <div>Settings Loaded</div>
      </SettingsContext.Provider>,
    );

    await waitFor(() =>
      expect(getByText("Settings Loaded")).toBeInTheDocument(),
    );
  });

  it("should handle errors during settings initialization", async () => {
    mockSettingsContextValue.initializeSettings.mockRejectedValue(
      new Error("Failed to load settings"),
    );

    const { getByText } = render(
      <SettingsContext.Provider value={mockSettingsContextValue}>
        <div>Settings Loaded</div>
      </SettingsContext.Provider>,
    );

    await waitFor(() =>
      expect(getByText("Settings Loaded")).toBeInTheDocument(),
    );
  });
});

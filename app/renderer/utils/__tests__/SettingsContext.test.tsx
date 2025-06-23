import { cleanup, render, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { SettingsProvider, useSettings } from "../SettingsContext";

// Mock electron API
const mockElectronAPI = {
  readSettings: vi.fn(),
  setSetting: vi.fn(),
  getLocalStoreStatus: vi.fn(),
};

beforeEach(() => {
  // @ts-ignore
  window.electronAPI = mockElectronAPI;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("SettingsContext", () => {
  const TestComponent = () => {
    const { isInitialized, localStorePath, darkMode, error } = useSettings();
    
    return (
      <div>
        <div data-testid="initialized">{isInitialized ? "initialized" : "loading"}</div>
        <div data-testid="localStorePath">{localStorePath || "null"}</div>
        <div data-testid="darkMode">{darkMode ? "dark" : "light"}</div>
        <div data-testid="error">{error || "no-error"}</div>
      </div>
    );
  };

  it("should initialize settings successfully", async () => {
    mockElectronAPI.readSettings.mockResolvedValue({
      localStorePath: "/test/path",
      darkMode: true,
    });
    mockElectronAPI.getLocalStoreStatus.mockResolvedValue({
      hasLocalStore: true,
      localStorePath: "/test/path",
      isValid: true,
    });

    const { getByTestId } = render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(getByTestId("initialized")).toHaveTextContent("initialized");
      expect(getByTestId("localStorePath")).toHaveTextContent("/test/path");
      expect(getByTestId("darkMode")).toHaveTextContent("dark");
      expect(getByTestId("error")).toHaveTextContent("no-error");
    });
  });

  it("should handle initialization errors", async () => {
    mockElectronAPI.readSettings.mockRejectedValue(new Error("Failed to load settings"));

    const { getByTestId } = render(
      <SettingsProvider>
        <TestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(getByTestId("initialized")).toHaveTextContent("initialized");
      expect(getByTestId("error")).toHaveTextContent("Failed to load settings");
    });
  });

  it("should update settings correctly", async () => {
    mockElectronAPI.readSettings.mockResolvedValue({
      localStorePath: null,
      darkMode: false,
    });
    mockElectronAPI.setSetting.mockResolvedValue(undefined);

    const UpdateTestComponent = () => {
      const { setLocalStorePath, setDarkMode, localStorePath, darkMode } = useSettings();
      
      return (
        <div>
          <div data-testid="localStorePath">{localStorePath || "null"}</div>
          <div data-testid="darkMode">{darkMode ? "dark" : "light"}</div>
          <button onClick={() => setLocalStorePath("/new/path")}>Update Path</button>
          <button onClick={() => setDarkMode(true)}>Enable Dark Mode</button>
        </div>
      );
    };

    const { getByTestId, getByText } = render(
      <SettingsProvider>
        <UpdateTestComponent />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(getByTestId("localStorePath")).toHaveTextContent("null");
      expect(getByTestId("darkMode")).toHaveTextContent("light");
    });

    // Test updating local store path
    getByText("Update Path").click();
    await waitFor(() => {
      expect(mockElectronAPI.setSetting).toHaveBeenCalledWith("localStorePath", "/new/path");
    });

    // Test updating dark mode
    getByText("Enable Dark Mode").click();
    await waitFor(() => {
      expect(mockElectronAPI.setSetting).toHaveBeenCalledWith("darkMode", true);
    });
  });
});

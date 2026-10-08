import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../tests/mocks/electron/electronAPI";
import { useSettings } from "../../../utils/SettingsContext";
import PreferencesDialog from "../PreferencesDialog";

// Mock the useSettings hook
vi.mock("../../../utils/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

vi.mock("../../hooks/shared/useMessageApi", () => ({
  useMessageApi: () => ({ showMessage: vi.fn() }),
}));

const mockUseSettings = vi.mocked(useSettings);

describe("[UC-35] PreferencesDialog", () => {
  const mockSetThemeMode = vi.fn();
  const mockSetConfirmDestructiveActions = vi.fn();
  const mockSetLocalStorePath = vi.fn();
  const mockOnClose = vi.fn();

  const defaultSettingsContext = {
    clearError: vi.fn(),
    confirmDestructiveActions: true,
    error: null,
    isDarkMode: false,
    isInitialized: true,
    isLoading: false,
    localStorePath: "/test/path",
    localStoreStatus: null,
    refreshLocalStoreStatus: vi.fn(),
    setConfirmDestructiveActions: mockSetConfirmDestructiveActions,
    setLocalStorePath: mockSetLocalStorePath,
    setThemeMode: mockSetThemeMode,
    themeMode: "system" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetThemeMode.mockResolvedValue(true);
    mockSetConfirmDestructiveActions.mockResolvedValue(true);
    mockUseSettings.mockReturnValue(defaultSettingsContext);
    setupElectronAPIMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Dialog rendering", () => {
    it("renders nothing when not open", () => {
      const { container } = render(
        <PreferencesDialog isOpen={false} onClose={mockOnClose} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders dialog when open", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      const preferences = screen.getAllByText("Preferences");
      expect(preferences.length).toBeGreaterThan(0);
    });

    it("displays all preference sections", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Use navigation buttons to check for sections (getAllBy handles duplicates from React strict mode)
      const sampleMgmt = screen.getAllByRole("button", {
        name: "Sample Management",
      });
      const appearance = screen.getAllByRole("button", { name: "Appearance" });
      const advanced = screen.getAllByRole("button", { name: "Advanced" });

      expect(sampleMgmt.length).toBeGreaterThan(0);
      expect(appearance.length).toBeGreaterThan(0);
      expect(advanced.length).toBeGreaterThan(0);
    });
  });

  describe("Theme preferences", () => {
    it("displays current theme mode", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // First need to navigate to Appearance tab
      const appearanceTab = screen.getAllByRole("button", {
        name: "Appearance",
      })[0];
      fireEvent.click(appearanceTab);

      // Check that the theme options are displayed
      const systemText = screen.getAllByText("System");
      const lightText = screen.getAllByText("Light");
      const darkText = screen.getAllByText("Dark");

      expect(systemText.length).toBeGreaterThan(0);
      expect(lightText.length).toBeGreaterThan(0);
      expect(darkText.length).toBeGreaterThan(0);
    });

    it("updates theme mode to light", async () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Navigate to Appearance tab
      const appearanceTab = screen.getAllByRole("button", {
        name: "Appearance",
      })[0];
      fireEvent.click(appearanceTab);

      // Wait for the appearance content to be visible, then find the light theme option
      await screen.findByText("Light");

      // The theme buttons are the ones with the theme names as siblings
      const lightSpan = screen
        .getAllByText("Light")
        .find((el) => el.tagName === "SPAN");
      const lightButton = lightSpan?.parentElement?.querySelector("button");

      if (lightButton) {
        fireEvent.click(lightButton);
        expect(mockSetThemeMode).toHaveBeenCalledWith("light");
      } else {
        throw new Error("Could not find Light theme button");
      }
    });

    it("updates theme mode to dark", async () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Navigate to Appearance tab
      const appearanceTab = screen.getAllByRole("button", {
        name: "Appearance",
      })[0];
      fireEvent.click(appearanceTab);

      // Wait for the appearance content to be visible, then find the dark theme option
      await screen.findByText("Dark");

      // The theme buttons are the ones with the theme names as siblings
      const darkSpan = screen
        .getAllByText("Dark")
        .find((el) => el.tagName === "SPAN");
      const darkButton = darkSpan?.parentElement?.querySelector("button");

      if (darkButton) {
        fireEvent.click(darkButton);
        expect(mockSetThemeMode).toHaveBeenCalledWith("dark");
      } else {
        throw new Error("Could not find Dark theme button");
      }
    });

    it("updates theme mode to system", async () => {
      mockUseSettings.mockReturnValue({
        ...defaultSettingsContext,
        themeMode: "dark",
      });

      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Navigate to Appearance tab
      const appearanceTab = screen.getAllByRole("button", {
        name: "Appearance",
      })[0];
      fireEvent.click(appearanceTab);

      // Wait for the appearance content to be visible, then find the system theme option
      await screen.findByText("System");

      // The theme buttons are the ones with the theme names as siblings
      const systemSpan = screen
        .getAllByText("System")
        .find((el) => el.tagName === "SPAN");
      const systemButton = systemSpan?.parentElement?.querySelector("button");

      if (systemButton) {
        fireEvent.click(systemButton);
        expect(mockSetThemeMode).toHaveBeenCalledWith("system");
      } else {
        throw new Error("Could not find System theme button");
      }
    });
  });

  describe("Confirmation preferences", () => {
    it("displays current destructive actions setting", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      const checkboxes = screen.getAllByRole("checkbox");
      const checkbox = checkboxes[0]; // First checkbox is for destructive actions

      expect(checkbox).toBeChecked();
    });

    it("toggles destructive actions setting", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      const checkboxes = screen.getAllByRole("checkbox");
      const checkbox = checkboxes[0]; // First checkbox is for destructive actions

      fireEvent.click(checkbox);

      expect(mockSetConfirmDestructiveActions).toHaveBeenCalledWith(false);
    });
  });

  describe("Dialog interactions", () => {
    it("closes dialog when Done button is clicked", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      const doneButtons = screen.getAllByText("Done");
      fireEvent.click(doneButtons[0]);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("closes dialog when clicking outside", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Click the backdrop (the outermost div with fixed positioning)
      const backdrop = document.querySelector(".fixed.inset-0") as HTMLElement;
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("does not close when clicking dialog content", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Click inside the dialog content area
      const dialogContent = document.querySelector(
        ".bg-surface-2",
      ) as HTMLElement;
      fireEvent.click(dialogContent);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Keyboard interactions", () => {
    it("closes dialog on Escape key", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("closes dialog on Escape key via backdrop keyDown handler", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Find the backdrop div and trigger keyDown on it
      const backdrop = document.querySelector(".fixed.inset-0") as HTMLElement;
      fireEvent.keyDown(backdrop, { key: "Escape" });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("[UC-06] Advanced tab functionality", () => {
    it("navigates to advanced tab and shows advanced settings", () => {
      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Navigate to Advanced tab
      const advancedTab = screen.getAllByRole("button", {
        name: "Advanced",
      })[0];
      fireEvent.click(advancedTab);

      // Check that advanced tab content is visible (Local Store section)
      const localStoreHeadings = screen.getAllByText("Local Store");
      expect(localStoreHeadings.length).toBeGreaterThan(0);
    });

    it("handles successful local store path selection", async () => {
      // Override the centralized mock for this test
      vi.mocked(window.electronAPI.selectExistingLocalStore).mockResolvedValue({
        error: null,
        path: "/new/test/path",
        success: true,
      });

      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Navigate to Advanced tab
      const advancedTab = screen.getAllByRole("button", {
        name: "Advanced",
      })[0];
      fireEvent.click(advancedTab);

      // Wait for the advanced tab content to render and find Change button
      await waitFor(() => {
        const changeButtons = screen.getAllByRole("button", {
          name: "Change...",
        });
        expect(changeButtons.length).toBeGreaterThan(0);
      });

      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      const changeButton = changeButtons[0];
      fireEvent.click(changeButton);

      // Wait for async operation to complete
      await waitFor(() => {
        expect(window.electronAPI.selectExistingLocalStore).toHaveBeenCalled();
      });

      expect(mockSetLocalStorePath).toHaveBeenCalledWith("/new/test/path");
    });

    it("handles failed local store path selection", async () => {
      // Override the centralized mock for this test
      vi.mocked(window.electronAPI.selectExistingLocalStore).mockResolvedValue({
        error: null,
        path: null,
        success: false,
      });

      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Navigate to Advanced tab
      const advancedTab = screen.getAllByRole("button", {
        name: "Advanced",
      })[0];
      fireEvent.click(advancedTab);

      // Wait for the advanced tab content to render and find Change button
      await waitFor(() => {
        const changeButtons = screen.getAllByRole("button", {
          name: "Change...",
        });
        expect(changeButtons.length).toBeGreaterThan(0);
      });

      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      const changeButton = changeButtons[0];
      fireEvent.click(changeButton);

      // Wait for async operation to complete
      await waitFor(() => {
        expect(window.electronAPI.selectExistingLocalStore).toHaveBeenCalled();
      });

      expect(mockSetLocalStorePath).not.toHaveBeenCalled();
    });

    it("handles electron API error gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      // Override the centralized mock for this test
      vi.mocked(window.electronAPI.selectExistingLocalStore).mockRejectedValue(
        new Error("Permission denied"),
      );

      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Navigate to Advanced tab
      const advancedTab = screen.getAllByRole("button", {
        name: "Advanced",
      })[0];
      fireEvent.click(advancedTab);

      // Wait for the advanced tab content to render and find Change button
      await waitFor(() => {
        const changeButtons = screen.getAllByRole("button", {
          name: "Change...",
        });
        expect(changeButtons.length).toBeGreaterThan(0);
      });

      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      const changeButton = changeButtons[0];
      fireEvent.click(changeButton);

      // Wait for async operation and error logging
      await waitFor(() => {
        expect(window.electronAPI.selectExistingLocalStore).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to choose a local store:",
          expect.any(Error),
        );
      });

      expect(mockSetLocalStorePath).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("handles missing electron API gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Override the centralized mock to simulate missing API method
      vi.mocked(window.electronAPI.selectExistingLocalStore).mockRejectedValue(
        new Error("selectExistingLocalStore is not a function"),
      );

      render(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

      // Navigate to Advanced tab
      const advancedTab = screen.getAllByRole("button", {
        name: "Advanced",
      })[0];
      fireEvent.click(advancedTab);

      // Wait for the advanced tab content to render and find Change button
      await waitFor(() => {
        const changeButtons = screen.getAllByRole("button", {
          name: "Change...",
        });
        expect(changeButtons.length).toBeGreaterThan(0);
      });

      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      const changeButton = changeButtons[0];
      fireEvent.click(changeButton);

      // Wait for error to be logged due to missing API method
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to choose a local store:",
          expect.any(Error),
        );
      });

      expect(mockSetLocalStorePath).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    describe("[UC-05] a folder that can't be used (RE-78)", () => {
      // Earlier tests leave their dialogs mounted, so look only in this one
      const renderOpen = () => {
        const view = render(
          <PreferencesDialog isOpen={true} onClose={mockOnClose} />,
        );
        return { ...view, ui: within(view.container) };
      };
      const clickChange = async (ui: ReturnType<typeof within>) => {
        fireEvent.click(ui.getByRole("button", { name: "Advanced" }));
        fireEvent.click(await ui.findByRole("button", { name: "Change..." }));
      };

      it("says why main refused the folder, and keeps the store", async () => {
        vi.mocked(
          globalThis.electronAPI.selectExistingLocalStore,
        ).mockResolvedValue({
          error:
            "This directory does not contain a valid Romper database (.romperdb folder).",
          path: null,
          success: false,
        });
        const { ui } = renderOpen();

        await clickChange(ui);

        expect(await ui.findByRole("alert")).toHaveTextContent(
          "does not contain a valid Romper database",
        );
        expect(mockSetLocalStorePath).not.toHaveBeenCalled();
      });

      it("says so when the new path can't be saved", async () => {
        vi.mocked(
          globalThis.electronAPI.selectExistingLocalStore,
        ).mockResolvedValue({ error: null, path: "/other", success: true });
        mockSetLocalStorePath.mockResolvedValue(false);
        const { ui } = renderOpen();

        await clickChange(ui);

        expect(await ui.findByRole("alert")).toHaveTextContent(
          "Couldn't save the local store setting",
        );
        expect(mockSetLocalStorePath).toHaveBeenCalledWith("/other");
      });

      it("says nothing when the picker is cancelled or the change saves", async () => {
        vi.mocked(globalThis.electronAPI.selectExistingLocalStore)
          .mockResolvedValueOnce({
            error: "Selection cancelled",
            path: null,
            success: false,
          })
          .mockResolvedValueOnce({
            error: null,
            path: "/other",
            success: true,
          });
        mockSetLocalStorePath.mockResolvedValue(true);
        const { ui } = renderOpen();

        await clickChange(ui);
        await waitFor(() =>
          expect(
            globalThis.electronAPI.selectExistingLocalStore,
          ).toHaveBeenCalledTimes(1),
        );
        fireEvent.click(await ui.findByRole("button", { name: "Change..." }));

        await waitFor(() =>
          expect(mockSetLocalStorePath).toHaveBeenCalledWith("/other"),
        );
        expect(ui.queryByRole("alert")).toBeNull();
      });

      it("clears the message when Preferences closes", async () => {
        vi.mocked(
          globalThis.electronAPI.selectExistingLocalStore,
        ).mockResolvedValue({
          error: "Not a store",
          path: null,
          success: false,
        });
        const { rerender, ui } = renderOpen();
        await clickChange(ui);
        expect(await ui.findByRole("alert")).toBeInTheDocument();

        rerender(<PreferencesDialog isOpen={false} onClose={mockOnClose} />);
        rerender(<PreferencesDialog isOpen={true} onClose={mockOnClose} />);

        expect(ui.getByRole("button", { name: "Change..." })).toBeVisible();
        expect(ui.queryByRole("alert")).toBeNull();
      });
    });
  });
});

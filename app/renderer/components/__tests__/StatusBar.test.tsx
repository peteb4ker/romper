import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StatusBar from "../StatusBar";

// Mock the useSettings hook
const mockSetThemeMode = vi.fn();
const mockSettings = {
  isDarkMode: false,
  localStorePath: "/test/path",
  setThemeMode: mockSetThemeMode,
  themeMode: "light" as "dark" | "light" | "system",
};

vi.mock("../../utils/SettingsContext", () => ({
  useSettings: () => mockSettings,
}));

// Mock react-icons
vi.mock("react-icons/fi", () => ({
  FiDatabase: () => <div data-testid="database-icon" />,
  FiMonitor: () => <div data-testid="monitor-icon" />,
  FiMoon: () => <div data-testid="moon-icon" />,
  FiSun: () => <div data-testid="sun-icon" />,
}));

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.themeMode = "light";
    mockSettings.isDarkMode = false;
    mockSettings.localStorePath = "/test/path";
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      render(<StatusBar />);
      expect(screen.getByText("/test/path")).toBeInTheDocument();
    });

    it("should display local store path", () => {
      render(<StatusBar />);
      expect(screen.getByText("/test/path")).toBeInTheDocument();
    });

    it("should display 'Not configured' when no localStorePath", () => {
      mockSettings.localStorePath = null;
      render(<StatusBar />);
      expect(screen.getByText("Not configured")).toBeInTheDocument();
    });

    it("should display 'Not configured' when empty localStorePath", () => {
      mockSettings.localStorePath = "";
      render(<StatusBar />);
      expect(screen.getByText("Not configured")).toBeInTheDocument();
    });
  });

  describe("progress bar", () => {
    it("should not show progress bar when progress is null", () => {
      render(<StatusBar progress={null} />);
      expect(screen.queryByTestId("progress-bar")).not.toBeInTheDocument();
    });

    it("should show progress bar when progress is provided", () => {
      render(<StatusBar progress={50} />);
      expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
    });

    it("should display correct progress width", () => {
      render(<StatusBar progress={75} />);
      const progressBar = screen.getByTestId("progress-bar");
      const progressFill = progressBar.querySelector(".bg-blue-500");
      expect(progressFill).toHaveStyle({ width: "75%" });
    });

    it("should handle progress greater than 100", () => {
      render(<StatusBar progress={150} />);
      const progressBar = screen.getByTestId("progress-bar");
      const progressFill = progressBar.querySelector(".bg-blue-500");
      expect(progressFill).toHaveStyle({ width: "100%" });
    });

    it("should handle negative progress", () => {
      render(<StatusBar progress={-10} />);
      const progressBar = screen.getByTestId("progress-bar");
      const progressFill = progressBar.querySelector(".bg-blue-500");
      expect(progressFill).toHaveStyle({ width: "0%" });
    });

    it("should handle zero progress", () => {
      render(<StatusBar progress={0} />);
      const progressBar = screen.getByTestId("progress-bar");
      const progressFill = progressBar.querySelector(".bg-blue-500");
      expect(progressFill).toHaveStyle({ width: "0%" });
    });
  });

  describe("theme toggle", () => {
    it("should show moon icon in light mode", () => {
      mockSettings.themeMode = "light";
      mockSettings.isDarkMode = false;
      render(<StatusBar />);
      expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
    });

    it("should show sun icon in dark mode", () => {
      mockSettings.themeMode = "dark";
      mockSettings.isDarkMode = true;
      render(<StatusBar />);
      expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
    });

    it("should show monitor icon in system mode", () => {
      mockSettings.themeMode = "system";
      render(<StatusBar />);
      expect(screen.getByTestId("monitor-icon")).toBeInTheDocument();
    });

    it("should cycle from light to dark on click", () => {
      mockSettings.themeMode = "light";
      render(<StatusBar />);
      const themeButton = screen.getByRole("button", {
        name: /toggle theme mode/i,
      });

      fireEvent.click(themeButton);
      expect(mockSetThemeMode).toHaveBeenCalledWith("dark");
    });

    it("should cycle from dark to system on click", () => {
      mockSettings.themeMode = "dark";
      render(<StatusBar />);
      const themeButton = screen.getByRole("button", {
        name: /toggle theme mode/i,
      });

      fireEvent.click(themeButton);
      expect(mockSetThemeMode).toHaveBeenCalledWith("system");
    });

    it("should cycle from system to light on click", () => {
      mockSettings.themeMode = "system";
      render(<StatusBar />);
      const themeButton = screen.getByRole("button", {
        name: /toggle theme mode/i,
      });

      fireEvent.click(themeButton);
      expect(mockSetThemeMode).toHaveBeenCalledWith("light");
    });

    it("should show correct title for light mode", () => {
      mockSettings.themeMode = "light";
      render(<StatusBar />);
      const themeButton = screen.getByRole("button", {
        name: /toggle theme mode/i,
      });
      expect(themeButton).toHaveAttribute("title", "Current: light");
    });

    it("should show correct title for dark mode", () => {
      mockSettings.themeMode = "dark";
      render(<StatusBar />);
      const themeButton = screen.getByRole("button", {
        name: /toggle theme mode/i,
      });
      expect(themeButton).toHaveAttribute("title", "Current: dark");
    });

    it("should show correct title for system mode with light preference", () => {
      mockSettings.themeMode = "system";
      mockSettings.isDarkMode = false;
      render(<StatusBar />);
      const themeButton = screen.getByRole("button", {
        name: /toggle theme mode/i,
      });
      expect(themeButton).toHaveAttribute("title", "Current: system (light)");
    });

    it("should show correct title for system mode with dark preference", () => {
      mockSettings.themeMode = "system";
      mockSettings.isDarkMode = true;
      render(<StatusBar />);
      const themeButton = screen.getByRole("button", {
        name: /toggle theme mode/i,
      });
      expect(themeButton).toHaveAttribute("title", "Current: system (dark)");
    });
  });

  describe("links", () => {
    it("should render Rample Manual link", () => {
      render(<StatusBar />);
      const manualLink = screen.getByRole("link", { name: "Rample Manual" });
      expect(manualLink).toHaveAttribute(
        "href",
        "https://squarp.net/rample/manual/",
      );
      expect(manualLink).toHaveAttribute("target", "_blank");
      expect(manualLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should render About link", () => {
      render(<StatusBar />);
      const aboutLink = screen.getByRole("link", { name: "About" });
      expect(aboutLink).toHaveAttribute("href", "/about");
    });
  });

  describe("styling", () => {
    it("should have correct CSS classes", () => {
      const { container } = render(<StatusBar />);
      const statusBar = container.firstChild;
      expect(statusBar).toHaveClass("fixed");
      expect(statusBar).toHaveClass("bottom-0");
      expect(statusBar).toHaveClass("left-0");
      expect(statusBar).toHaveClass("w-full");
      expect(statusBar).toHaveClass("bg-gray-200");
      expect(statusBar).toHaveClass("dark:bg-slate-800");
    });

    it("should have database icon", () => {
      render(<StatusBar />);
      expect(screen.getByTestId("database-icon")).toBeInTheDocument();
    });
  });

  describe("edge cases", () => {
    it("should handle undefined progress", () => {
      render(<StatusBar progress={undefined} />);
      expect(screen.queryByTestId("progress-bar")).not.toBeInTheDocument();
    });
  });
});

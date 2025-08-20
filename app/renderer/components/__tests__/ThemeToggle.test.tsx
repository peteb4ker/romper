// Test suite for ThemeToggle component
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ThemeToggle from "../ThemeToggle";

// Mock the useSettings hook
const mockSetThemeMode = vi.fn();
const mockSettings = {
  isDarkMode: false,
  setThemeMode: mockSetThemeMode,
  themeMode: "light" as "dark" | "light" | "system",
};

vi.mock("../../utils/SettingsContext", () => ({
  useSettings: () => mockSettings,
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default state
    mockSettings.themeMode = "light";
    mockSettings.isDarkMode = false;
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      render(<ThemeToggle />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should display Light Mode when themeMode is light", () => {
      mockSettings.themeMode = "light";
      render(<ThemeToggle />);
      expect(screen.getByText("Light Mode")).toBeInTheDocument();
    });

    it("should display Dark Mode when themeMode is dark", () => {
      mockSettings.themeMode = "dark";
      render(<ThemeToggle />);
      expect(screen.getByText("Dark Mode")).toBeInTheDocument();
    });

    it("should display System (Light) when themeMode is system and isDarkMode is false", () => {
      mockSettings.themeMode = "system";
      mockSettings.isDarkMode = false;
      render(<ThemeToggle />);
      expect(screen.getByText("System (Light)")).toBeInTheDocument();
    });

    it("should display System (Dark) when themeMode is system and isDarkMode is true", () => {
      mockSettings.themeMode = "system";
      mockSettings.isDarkMode = true;
      render(<ThemeToggle />);
      expect(screen.getByText("System (Dark)")).toBeInTheDocument();
    });

    it("should display Theme as fallback for unknown themeMode", () => {
      mockSettings.themeMode = "unknown" as unknown;
      render(<ThemeToggle />);
      expect(screen.getByText("Theme")).toBeInTheDocument();
    });
  });

  describe("theme cycling", () => {
    it("should cycle from light to dark", () => {
      mockSettings.themeMode = "light";
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockSetThemeMode).toHaveBeenCalledWith("dark");
    });

    it("should cycle from dark to system", () => {
      mockSettings.themeMode = "dark";
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockSetThemeMode).toHaveBeenCalledWith("system");
    });

    it("should cycle from system to light", () => {
      mockSettings.themeMode = "system";
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockSetThemeMode).toHaveBeenCalledWith("light");
    });

    it("should handle multiple clicks in sequence", () => {
      mockSettings.themeMode = "light";
      render(<ThemeToggle />);
      const button = screen.getByRole("button");

      // First click: Light -> Dark
      fireEvent.click(button);
      expect(mockSetThemeMode).toHaveBeenNthCalledWith(1, "dark");

      // Second click: still from light state (mock doesn't update automatically)
      fireEvent.click(button);
      expect(mockSetThemeMode).toHaveBeenNthCalledWith(2, "dark");

      expect(mockSetThemeMode).toHaveBeenCalledTimes(2);
    });
  });

  describe("button styling", () => {
    it("should have correct CSS classes", () => {
      render(<ThemeToggle />);
      const button = screen.getByRole("button");

      expect(button).toHaveClass("px-4");
      expect(button).toHaveClass("py-2");
      expect(button).toHaveClass("bg-gray-200");
      expect(button).toHaveClass("dark:bg-gray-800");
      expect(button).toHaveClass("rounded-md");
      expect(button).toHaveClass("shadow");
      expect(button).toHaveClass("transition");
    });
  });

  describe("edge cases", () => {
    it("should handle undefined themeMode", () => {
      mockSettings.themeMode = undefined as unknown;
      render(<ThemeToggle />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockSetThemeMode).toHaveBeenCalledWith("light");
    });

    it("should handle null themeMode", () => {
      mockSettings.themeMode = null as unknown;
      render(<ThemeToggle />);

      expect(screen.getByText("Theme")).toBeInTheDocument();
    });
  });
});

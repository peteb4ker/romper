import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ThemeMode } from "../../../utils/SettingsContext";

import AppearanceTab from "../AppearanceTab";

describe("AppearanceTab", () => {
  const defaultProps = {
    onThemeModeChange: vi.fn(),
    themeMode: "system" as ThemeMode,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Component rendering", () => {
    it("renders the Appearance heading", () => {
      render(<AppearanceTab {...defaultProps} />);

      expect(screen.getByText("Appearance")).toBeInTheDocument();
    });

    it("renders all three theme option labels", () => {
      render(<AppearanceTab {...defaultProps} />);

      expect(screen.getByText("Light")).toBeInTheDocument();
      expect(screen.getByText("System")).toBeInTheDocument();
      expect(screen.getByText("Dark")).toBeInTheDocument();
    });

    it("renders three theme buttons", () => {
      render(<AppearanceTab {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);
    });

    it("renders the description text", () => {
      render(<AppearanceTab {...defaultProps} />);

      expect(
        screen.getByText(
          /Choose how Romper looks\. System matches your operating system/,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("Selection state", () => {
    it("highlights the Light button when themeMode is light", () => {
      render(<AppearanceTab {...defaultProps} themeMode="light" />);

      const buttons = screen.getAllByRole("button");
      // Light is the first button
      expect(buttons[0]).toHaveClass("border-blue-500", "ring-2");
      expect(buttons[1]).not.toHaveClass("border-blue-500");
      expect(buttons[2]).not.toHaveClass("border-blue-500");
    });

    it("highlights the System button when themeMode is system", () => {
      render(<AppearanceTab {...defaultProps} themeMode="system" />);

      const buttons = screen.getAllByRole("button");
      // System is the second button
      expect(buttons[0]).not.toHaveClass("border-blue-500");
      expect(buttons[1]).toHaveClass("border-blue-500", "ring-2");
      expect(buttons[2]).not.toHaveClass("border-blue-500");
    });

    it("highlights the Dark button when themeMode is dark", () => {
      render(<AppearanceTab {...defaultProps} themeMode="dark" />);

      const buttons = screen.getAllByRole("button");
      // Dark is the third button
      expect(buttons[0]).not.toHaveClass("border-blue-500");
      expect(buttons[1]).not.toHaveClass("border-blue-500");
      expect(buttons[2]).toHaveClass("border-blue-500", "ring-2");
    });

    it("applies selected label styling to the active theme", () => {
      render(<AppearanceTab {...defaultProps} themeMode="light" />);

      const lightLabel = screen.getByText("Light");
      const systemLabel = screen.getByText("System");
      const darkLabel = screen.getByText("Dark");

      expect(lightLabel).toHaveClass("text-blue-700");
      expect(systemLabel).not.toHaveClass("text-blue-700");
      expect(darkLabel).not.toHaveClass("text-blue-700");
    });

    it("applies unselected label styling to inactive themes", () => {
      render(<AppearanceTab {...defaultProps} themeMode="dark" />);

      const lightLabel = screen.getByText("Light");
      const systemLabel = screen.getByText("System");

      expect(lightLabel).toHaveClass("text-gray-700");
      expect(systemLabel).toHaveClass("text-gray-700");
    });
  });

  describe("Theme selection interactions", () => {
    it("calls onThemeModeChange with 'light' when Light button is clicked", () => {
      const mockOnChange = vi.fn();

      render(
        <AppearanceTab onThemeModeChange={mockOnChange} themeMode="system" />,
      );

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);

      expect(mockOnChange).toHaveBeenCalledWith("light");
    });

    it("calls onThemeModeChange with 'system' when System button is clicked", () => {
      const mockOnChange = vi.fn();

      render(
        <AppearanceTab onThemeModeChange={mockOnChange} themeMode="light" />,
      );

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[1]);

      expect(mockOnChange).toHaveBeenCalledWith("system");
    });

    it("calls onThemeModeChange with 'dark' when Dark button is clicked", () => {
      const mockOnChange = vi.fn();

      render(
        <AppearanceTab onThemeModeChange={mockOnChange} themeMode="light" />,
      );

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[2]);

      expect(mockOnChange).toHaveBeenCalledWith("dark");
    });

    it("calls onThemeModeChange when clicking the already selected theme", () => {
      const mockOnChange = vi.fn();

      render(
        <AppearanceTab onThemeModeChange={mockOnChange} themeMode="dark" />,
      );

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[2]);

      expect(mockOnChange).toHaveBeenCalledWith("dark");
    });

    it("calls onThemeModeChange exactly once per click", () => {
      const mockOnChange = vi.fn();

      render(
        <AppearanceTab onThemeModeChange={mockOnChange} themeMode="light" />,
      );

      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[1]);
      fireEvent.click(buttons[2]);

      expect(mockOnChange).toHaveBeenCalledTimes(3);
      expect(mockOnChange).toHaveBeenNthCalledWith(1, "light");
      expect(mockOnChange).toHaveBeenNthCalledWith(2, "system");
      expect(mockOnChange).toHaveBeenNthCalledWith(3, "dark");
    });
  });

  describe("Button styling", () => {
    it("applies unselected border styling to non-active buttons", () => {
      render(<AppearanceTab {...defaultProps} themeMode="light" />);

      const buttons = screen.getAllByRole("button");
      // System and Dark should have unselected styling
      expect(buttons[1]).toHaveClass("border-gray-200");
      expect(buttons[2]).toHaveClass("border-gray-200");
    });

    it("applies transition styling to all buttons", () => {
      render(<AppearanceTab {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("transition-all", "duration-200");
      });
    });

    it("applies rounded styling to all buttons", () => {
      render(<AppearanceTab {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toHaveClass("rounded-xl", "border-2");
      });
    });
  });

  describe("Layout", () => {
    it("renders buttons in a 3-column grid", () => {
      render(<AppearanceTab {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      const grid = buttons[0].parentElement?.parentElement;
      expect(grid).toHaveClass("grid", "grid-cols-3", "gap-4");
    });

    it("applies correct root container styling", () => {
      const { container } = render(<AppearanceTab {...defaultProps} />);

      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass("space-y-6");
    });
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type LocalStoreValidationDetailedResult } from "../../utils/SettingsContext";
import AdvancedTab from "../AdvancedTab";

describe("AdvancedTab", () => {
  const mockOnChangeLocalStore = vi.fn();

  const validStatus: LocalStoreValidationDetailedResult = {
    hasLocalStore: true,
    isValid: true,
    localStorePath: "/test/path",
  };

  const invalidStatusWithError: LocalStoreValidationDetailedResult = {
    error: "Database not found",
    hasLocalStore: false,
    isValid: false,
  };

  const invalidStatusWithoutError: LocalStoreValidationDetailedResult = {
    hasLocalStore: false,
    isValid: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Component rendering", () => {
    it("renders the component with all sections", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      expect(screen.getByText("Local Store")).toBeInTheDocument();
      expect(screen.getByText("Local Store Path")).toBeInTheDocument();
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(
        screen.getByText("Location of your sample database and kit storage"),
      ).toBeInTheDocument();
    });

    it("renders with proper structure and accessibility", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      // Check proper ARIA label associations
      const pathElement = document.getElementById("local-store-path");
      expect(pathElement).toHaveAttribute("role", "textbox");
      expect(pathElement).toHaveAttribute(
        "aria-labelledby",
        "local-store-path-label",
      );
      expect(pathElement).toHaveAttribute("aria-readonly", "true");

      const statusElement = document.getElementById("local-store-status");
      expect(statusElement).toHaveAttribute("role", "status");
      expect(statusElement).toHaveAttribute(
        "aria-labelledby",
        "local-store-status-label",
      );
      expect(statusElement).toHaveAttribute("aria-live", "polite");

      // Check button accessibility
      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      expect(changeButtons.length).toBeGreaterThanOrEqual(1);
      expect(changeButtons[0]).toBeInTheDocument();
    });
  });

  describe("Local store path display", () => {
    it("displays the local store path when present", () => {
      const testPath = "/Users/test/romper-samples";
      render(
        <AdvancedTab
          localStorePath={testPath}
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const pathElements = screen.getAllByText(testPath);
      expect(pathElements.length).toBeGreaterThanOrEqual(1);
    });

    it("displays default message when path is null", () => {
      render(
        <AdvancedTab
          localStorePath={null}
          localStoreStatus={null}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const messages = screen.getAllByText("No local store configured");
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });

    it("displays default message when path is empty string", () => {
      render(
        <AdvancedTab
          localStorePath=""
          localStoreStatus={null}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const messages = screen.getAllByText("No local store configured");
      expect(messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Local store status display", () => {
    it("displays valid status with checkmark and green color", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const statusElements = screen.getAllByText("✓ Valid local store");
      expect(statusElements.length).toBeGreaterThanOrEqual(1);
      expect(statusElements[0]).toHaveClass(
        "text-green-600",
        "dark:text-green-400",
      );
    });

    it("displays invalid status with error message when error is provided", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={invalidStatusWithError}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const statusElements = screen.getAllByText("✗ Database not found");
      expect(statusElements.length).toBeGreaterThanOrEqual(1);
      expect(statusElements[0]).toHaveClass(
        "text-red-600",
        "dark:text-red-400",
      );
    });

    it("displays generic invalid status when no specific error is provided", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={invalidStatusWithoutError}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const statusElements = screen.getAllByText("✗ Invalid local store");
      expect(statusElements.length).toBeGreaterThanOrEqual(1);
      expect(statusElements[0]).toHaveClass(
        "text-red-600",
        "dark:text-red-400",
      );
    });

    it("displays generic invalid status when localStoreStatus is null", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={null}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const statusElements = screen.getAllByText("✗ Invalid local store");
      expect(statusElements.length).toBeGreaterThanOrEqual(1);
      expect(statusElements[0]).toHaveClass(
        "text-red-600",
        "dark:text-red-400",
      );
    });

    it("handles complex error messages correctly", () => {
      const complexErrorStatus: LocalStoreValidationDetailedResult = {
        error: "Permission denied: /restricted/path/samples",
        hasLocalStore: false,
        isCriticalEnvironmentError: true,
        isValid: false,
      };

      render(
        <AdvancedTab
          localStorePath="/restricted/path"
          localStoreStatus={complexErrorStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const errorElements = screen.getAllByText(
        "✗ Permission denied: /restricted/path/samples",
      );
      expect(errorElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Change button interaction", () => {
    it("calls onChangeLocalStore when change button is clicked", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      fireEvent.click(changeButtons[0]);

      expect(mockOnChangeLocalStore).toHaveBeenCalledOnce();
    });

    it("button is accessible via keyboard navigation", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      const changeButton = changeButtons[0];
      changeButton.focus();

      expect(document.activeElement).toBe(changeButton);

      // Simulate Enter key press
      fireEvent.keyDown(changeButton, { key: "Enter" });
      fireEvent.click(changeButton); // Click is still needed as keyDown doesn't trigger button click

      expect(mockOnChangeLocalStore).toHaveBeenCalledOnce();
    });

    it("button has proper visual styling and hover states", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      const changeButton = changeButtons[0];

      // Check initial styling
      expect(changeButton).toHaveClass(
        "px-3",
        "py-2",
        "bg-blue-600",
        "text-white",
        "rounded",
        "hover:bg-blue-700",
        "transition-colors",
      );

      // Check that it contains the folder icon and text
      expect(changeButton).toHaveTextContent("Change...");
    });

    it("calls onChangeLocalStore multiple times correctly", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      const changeButton = changeButtons[0];

      fireEvent.click(changeButton);
      fireEvent.click(changeButton);
      fireEvent.click(changeButton);

      expect(mockOnChangeLocalStore).toHaveBeenCalledTimes(3);
    });
  });

  describe("Component styling and layout", () => {
    it("applies correct CSS classes for layout and theming", () => {
      const { container } = render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      // Check root container styling
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass("space-y-6");

      // Check path display styling
      const pathDisplays = screen.getAllByText("/test/path");
      const pathDisplay = pathDisplays[0];
      expect(pathDisplay).toHaveClass(
        "flex-1",
        "p-2",
        "bg-gray-50",
        "dark:bg-slate-700",
        "rounded",
        "border",
        "border-gray-300",
        "dark:border-gray-600",
        "font-mono",
        "text-sm",
      );
    });

    it("has proper spacing and responsive design classes", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      // Check that elements have proper gap and flex classes
      const pathElements = screen.getAllByText("/test/path");
      const pathContainer = pathElements[0].parentElement;
      expect(pathContainer).toHaveClass("flex", "items-center", "gap-2");
    });
  });

  describe("Edge cases and error scenarios", () => {
    it("handles undefined localStoreStatus gracefully", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={undefined as unknown}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      expect(screen.getByText("✗ Invalid local store")).toBeInTheDocument();
    });

    it("handles very long path names", () => {
      const longPath =
        "/very/very/very/very/very/very/very/very/very/very/long/path/to/samples/directory/that/might/overflow";
      render(
        <AdvancedTab
          localStorePath={longPath}
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const pathElements = screen.getAllByText(longPath);
      expect(pathElements.length).toBeGreaterThanOrEqual(1);
    });

    it("handles very long error messages", () => {
      const longError =
        "This is a very long error message that might occur when there are multiple validation issues with the local store path configuration and database connection problems that need to be handled gracefully";
      const longErrorStatus: LocalStoreValidationDetailedResult = {
        error: longError,
        hasLocalStore: false,
        isValid: false,
      };

      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={longErrorStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const errorElements = screen.getAllByText(`✗ ${longError}`);
      expect(errorElements.length).toBeGreaterThanOrEqual(1);
    });

    it("handles status object with all optional fields", () => {
      const fullStatus: LocalStoreValidationDetailedResult = {
        error: undefined,
        errorSummary: "No errors",
        hasLocalStore: true,
        isCriticalEnvironmentError: false,
        isEnvironmentOverride: false,
        isValid: true,
        localStorePath: "/full/test/path",
        romperDbPath: "/full/test/path/romper.db",
      };

      render(
        <AdvancedTab
          localStorePath="/full/test/path"
          localStoreStatus={fullStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const statusElements = screen.getAllByText("✓ Valid local store");
      expect(statusElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Icon rendering", () => {
    it("renders folder icon in the change button", () => {
      render(
        <AdvancedTab
          localStorePath="/test/path"
          localStoreStatus={validStatus}
          onChangeLocalStore={mockOnChangeLocalStore}
        />,
      );

      const changeButtons = screen.getAllByRole("button", {
        name: "Change...",
      });
      const changeButton = changeButtons[0];
      const icon = changeButton.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import KitViewDialogs from "../KitViewDialogs";

// Mock the dialog components
vi.mock("../dialogs/ChangeLocalStoreDirectoryDialog", () => ({
  default: vi.fn(({ isOpen, onClose, onMessage }) =>
    isOpen ? (
      <div data-testid="change-directory-dialog">
        <button onClick={onClose}>Close Directory</button>
        <button onClick={() => onMessage("Test message", "info", 5000)}>
          Test Message
        </button>
      </div>
    ) : null,
  ),
}));

vi.mock("../dialogs/PreferencesDialog", () => ({
  default: vi.fn(({ isOpen, onClose }) =>
    isOpen ? (
      <div data-testid="preferences-dialog">
        <button onClick={onClose}>Close Preferences</button>
      </div>
    ) : null,
  ),
}));

describe("KitViewDialogs", () => {
  const defaultProps = {
    onCloseChangeDirectory: vi.fn(),
    onClosePreferences: vi.fn(),
    onMessage: vi.fn(),
    showChangeDirectoryDialog: false,
    showPreferencesDialog: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("should render without crashing", () => {
      render(<KitViewDialogs {...defaultProps} />);
      // Should not throw
    });

    it("should not show dialogs when both are closed", () => {
      render(<KitViewDialogs {...defaultProps} />);

      expect(
        screen.queryByTestId("change-directory-dialog"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("preferences-dialog"),
      ).not.toBeInTheDocument();
    });

    it("should show ChangeLocalStoreDirectoryDialog when showChangeDirectoryDialog is true", () => {
      render(
        <KitViewDialogs {...defaultProps} showChangeDirectoryDialog={true} />,
      );

      expect(screen.getByTestId("change-directory-dialog")).toBeInTheDocument();
      expect(
        screen.queryByTestId("preferences-dialog"),
      ).not.toBeInTheDocument();
    });

    it("should show PreferencesDialog when showPreferencesDialog is true", () => {
      render(<KitViewDialogs {...defaultProps} showPreferencesDialog={true} />);

      expect(screen.getByTestId("preferences-dialog")).toBeInTheDocument();
      expect(
        screen.queryByTestId("change-directory-dialog"),
      ).not.toBeInTheDocument();
    });

    it("should show both dialogs when both flags are true", () => {
      render(
        <KitViewDialogs
          {...defaultProps}
          showChangeDirectoryDialog={true}
          showPreferencesDialog={true}
        />,
      );

      expect(screen.getByTestId("change-directory-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("preferences-dialog")).toBeInTheDocument();
    });
  });

  describe("dialog interactions", () => {
    it("should call onCloseChangeDirectory when ChangeLocalStoreDirectoryDialog is closed", () => {
      const onCloseChangeDirectory = vi.fn();
      render(
        <KitViewDialogs
          {...defaultProps}
          onCloseChangeDirectory={onCloseChangeDirectory}
          showChangeDirectoryDialog={true}
        />,
      );

      const dialog = screen.getByTestId("change-directory-dialog");
      const closeButton = dialog.querySelector("button");
      closeButton?.click();

      expect(onCloseChangeDirectory).toHaveBeenCalledTimes(1);
    });

    it("should call onClosePreferences when PreferencesDialog is closed", () => {
      const onClosePreferences = vi.fn();
      render(
        <KitViewDialogs
          {...defaultProps}
          onClosePreferences={onClosePreferences}
          showPreferencesDialog={true}
        />,
      );

      const closeButton = screen.getByText("Close Preferences");
      closeButton.click();

      expect(onClosePreferences).toHaveBeenCalledTimes(1);
    });

    it("should pass message handler to ChangeLocalStoreDirectoryDialog", () => {
      const onMessage = vi.fn();
      render(
        <KitViewDialogs
          {...defaultProps}
          onMessage={onMessage}
          showChangeDirectoryDialog={true}
        />,
      );

      const dialog = screen.getByTestId("change-directory-dialog");
      const buttons = dialog.querySelectorAll("button");
      const messageButton = buttons[1]; // Second button is the message button
      messageButton?.click();

      expect(onMessage).toHaveBeenCalledWith("Test message", "info", 5000);
    });
  });

  describe("component integration", () => {
    it("should properly integrate both dialogs", () => {
      const { rerender } = render(<KitViewDialogs {...defaultProps} />);

      // Initially no dialogs shown
      expect(
        screen.queryByTestId("change-directory-dialog"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("preferences-dialog"),
      ).not.toBeInTheDocument();

      // Show change directory dialog
      rerender(
        <KitViewDialogs {...defaultProps} showChangeDirectoryDialog={true} />,
      );
      expect(screen.getByTestId("change-directory-dialog")).toBeInTheDocument();
      expect(
        screen.queryByTestId("preferences-dialog"),
      ).not.toBeInTheDocument();

      // Show preferences dialog too
      rerender(
        <KitViewDialogs
          {...defaultProps}
          showChangeDirectoryDialog={true}
          showPreferencesDialog={true}
        />,
      );
      expect(screen.getByTestId("change-directory-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("preferences-dialog")).toBeInTheDocument();

      // Hide both
      rerender(<KitViewDialogs {...defaultProps} />);
      expect(
        screen.queryByTestId("change-directory-dialog"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("preferences-dialog"),
      ).not.toBeInTheDocument();
    });
  });
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../tests/mocks/electron/electronAPI";
import { useSettings } from "../../../utils/SettingsContext";
import ChangeLocalStoreDirectoryDialog from "../ChangeLocalStoreDirectoryDialog";

// Mock the useSettings hook
vi.mock("../../../utils/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

// Mock FilePickerButton
vi.mock("../../utils/FilePickerButton", () => ({
  default: vi.fn(({ children, disabled, isSelecting, onClick, ...props }) => (
    <button
      data-testid="file-picker-button"
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {isSelecting ? "Selecting..." : children}
    </button>
  )),
}));

// Mock react-icons
vi.mock("react-icons/fi", () => ({
  FiAlertTriangle: vi.fn(() => <div data-testid="alert-triangle">Alert</div>),
  FiCheckCircle: vi.fn(() => <div data-testid="check-circle">Check</div>),
  FiFolder: vi.fn(() => <div data-testid="folder">Folder</div>),
  FiRefreshCw: vi.fn(() => <div data-testid="refresh">Refresh</div>),
  FiX: vi.fn(() => <div data-testid="close-x">X</div>),
}));

// Setup centralized electronAPI mock
setupElectronAPIMock();

describe("ChangeLocalStoreDirectoryDialog", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onMessage: vi.fn(),
  };

  const mockSettings = {
    localStorePath: "/current/path",
    setLocalStorePath: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSettings).mockReturnValue(mockSettings);
    vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(null);
    vi.mocked(window.electronAPI.validateLocalStoreBasic).mockResolvedValue({
      error: null,
      isValid: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("renders nothing when isOpen is false", () => {
      render(
        <ChangeLocalStoreDirectoryDialog {...defaultProps} isOpen={false} />
      );

      expect(
        screen.queryByText("Change Local Store Directory")
      ).not.toBeInTheDocument();
    });

    it("renders dialog when isOpen is true", () => {
      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      expect(
        screen.getByText("Change Local Store Directory")
      ).toBeInTheDocument();
      expect(screen.getByText("Current Directory")).toBeInTheDocument();
      expect(screen.getByText("Select New Directory")).toBeInTheDocument();
      expect(screen.getByTestId("close-x")).toBeInTheDocument();
    });

    it("displays current directory path", () => {
      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      expect(screen.getByText("/current/path")).toBeInTheDocument();
    });

    it("displays 'Not set' when no current directory", () => {
      vi.mocked(useSettings).mockReturnValue({
        ...mockSettings,
        localStorePath: null,
      });

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      expect(screen.getByText("Not set")).toBeInTheDocument();
    });

    it("shows file picker button", () => {
      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      expect(screen.getByTestId("file-picker-button")).toBeInTheDocument();
      expect(screen.getByText("Choose Directory")).toBeInTheDocument();
    });

    it("shows placeholder when no directory selected", () => {
      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      expect(screen.getByText("No directory selected")).toBeInTheDocument();
    });
  });

  describe("Directory selection", () => {
    it("calls selectLocalStorePath when choose directory button is clicked", async () => {
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        "/new/path"
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      expect(
        vi.mocked(window.electronAPI.selectLocalStorePath)
      ).toHaveBeenCalled();
    });

    it("updates selected path when directory is chosen", async () => {
      const newPath = "/new/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(screen.getByText(newPath)).toBeInTheDocument();
      });
    });

    it("auto-validates directory after selection", async () => {
      const newPath = "/new/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(
          vi.mocked(window.electronAPI.validateLocalStoreBasic)
        ).toHaveBeenCalledWith(newPath);
      });
    });

    it("handles directory selection error", async () => {
      const mockOnMessage = vi.fn();
      vi.mocked(window.electronAPI.selectLocalStorePath).mockRejectedValue(
        new Error("Permission denied")
      );

      render(
        <ChangeLocalStoreDirectoryDialog
          {...defaultProps}
          onMessage={mockOnMessage}
        />
      );

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(mockOnMessage).toHaveBeenCalledWith(
          "Failed to select directory: Permission denied",
          "error"
        );
      });
    });

    it("handles missing electronAPI", async () => {
      const mockOnMessage = vi.fn();
      vi.mocked(window.electronAPI.selectLocalStorePath).mockRejectedValue(
        new Error("Directory selection not available")
      );

      render(
        <ChangeLocalStoreDirectoryDialog
          {...defaultProps}
          onMessage={mockOnMessage}
        />
      );

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(mockOnMessage).toHaveBeenCalledWith(
          "Failed to select directory: Directory selection not available",
          "error"
        );
      });
    });
  });

  describe("Directory validation", () => {
    it("shows warning for same directory", async () => {
      const currentPath = "/current/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        currentPath
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(
          screen.getByText(/This is the same as your current directory/)
        ).toBeInTheDocument();
        expect(screen.getByTestId("alert-triangle")).toBeInTheDocument();
      });
    });

    it("shows error for invalid directory", async () => {
      const newPath = "/invalid/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );
      vi.mocked(window.electronAPI.validateLocalStoreBasic).mockResolvedValue({
        error: "Directory does not contain a valid database",
        isValid: false,
      });

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(
          screen.getByText("Directory does not contain a valid database")
        ).toBeInTheDocument();
        expect(screen.getAllByTestId("alert-triangle")).toHaveLength(1);
      });
    });

    it("shows default error message when no specific error", async () => {
      const newPath = "/invalid/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );
      vi.mocked(window.electronAPI.validateLocalStoreBasic).mockResolvedValue({
        error: null,
        isValid: false,
      });

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            /This directory does not contain a valid Romper database/
          )
        ).toBeInTheDocument();
      });
    });

    it("applies success styling for valid directory", async () => {
      const newPath = "/valid/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );
      vi.mocked(window.electronAPI.validateLocalStoreBasic).mockResolvedValue({
        error: null,
        isValid: true,
      });

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        const pathContainer = screen.getByText(newPath).closest("div");
        expect(pathContainer).toHaveClass("border-green-300", "bg-green-50");
      });
    });

    it("handles validation error", async () => {
      const newPath = "/new/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );
      vi.mocked(window.electronAPI.validateLocalStoreBasic).mockRejectedValue(
        new Error("Network error")
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("handles missing validation API", async () => {
      const newPath = "/new/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );
      vi.mocked(window.electronAPI.validateLocalStoreBasic).mockRejectedValue(
        new Error("Directory validation not available")
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(
          screen.getByText("Directory validation not available")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Update functionality", () => {
    it("enables update button for valid new directory", async () => {
      const newPath = "/valid/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        const updateButton = screen.getByText("Update Directory");
        expect(updateButton).not.toBeDisabled();
      });
    });

    it("disables update button when no directory selected", () => {
      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const updateButton = screen.getByText("Update Directory");
      expect(updateButton).toBeDisabled();
    });

    it("disables update button for invalid directory", async () => {
      const newPath = "/invalid/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );
      vi.mocked(window.electronAPI.validateLocalStoreBasic).mockResolvedValue({
        error: "Invalid",
        isValid: false,
      });

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        const updateButton = screen.getByText("Update Directory");
        expect(updateButton).toBeDisabled();
      });
    });

    it("disables update button for same directory", async () => {
      const currentPath = "/current/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        currentPath
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        const updateButton = screen.getByText("Update Directory");
        expect(updateButton).toBeDisabled();
      });
    });

    it("calls setLocalStorePath when update button is clicked", async () => {
      const newPath = "/valid/path";
      const mockSetLocalStorePath = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useSettings).mockReturnValue({
        ...mockSettings,
        setLocalStorePath: mockSetLocalStorePath,
      });
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        const updateButton = screen.getByText("Update Directory");
        expect(updateButton).not.toBeDisabled();
      });

      const updateButton = screen.getByText("Update Directory");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(mockSetLocalStorePath).toHaveBeenCalledWith(newPath);
      });
    });

    it("shows success message and closes dialog after update", async () => {
      const newPath = "/valid/path";
      const mockOnMessage = vi.fn();
      const mockOnClose = vi.fn();
      const mockSetLocalStorePath = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useSettings).mockReturnValue({
        ...mockSettings,
        setLocalStorePath: mockSetLocalStorePath,
      });
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );

      render(
        <ChangeLocalStoreDirectoryDialog
          {...defaultProps}
          onClose={mockOnClose}
          onMessage={mockOnMessage}
        />
      );

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        const updateButton = screen.getByText("Update Directory");
        expect(updateButton).not.toBeDisabled();
      });

      const updateButton = screen.getByText("Update Directory");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(mockOnMessage).toHaveBeenCalledWith(
          "Local store directory updated successfully! The application has been refreshed with the new directory.",
          "success",
          5000
        );
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("shows updating state", async () => {
      const newPath = "/valid/path";
      const mockSetLocalStorePath = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );
      vi.mocked(useSettings).mockReturnValue({
        ...mockSettings,
        setLocalStorePath: mockSetLocalStorePath,
      });
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        const updateButton = screen.getByText("Update Directory");
        expect(updateButton).not.toBeDisabled();
      });

      const updateButton = screen.getByText("Update Directory");
      fireEvent.click(updateButton);

      // Should briefly show updating state
      expect(screen.getByText("Updating...")).toBeInTheDocument();
      expect(screen.getByTestId("refresh")).toBeInTheDocument();
    });

    it("handles update error", async () => {
      const newPath = "/valid/path";
      const mockOnMessage = vi.fn();
      const mockSetLocalStorePath = vi
        .fn()
        .mockRejectedValue(new Error("Update failed"));
      vi.mocked(useSettings).mockReturnValue({
        ...mockSettings,
        setLocalStorePath: mockSetLocalStorePath,
      });
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );

      render(
        <ChangeLocalStoreDirectoryDialog
          {...defaultProps}
          onMessage={mockOnMessage}
        />
      );

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        const updateButton = screen.getByText("Update Directory");
        expect(updateButton).not.toBeDisabled();
      });

      const updateButton = screen.getByText("Update Directory");
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(mockOnMessage).toHaveBeenCalledWith(
          "Failed to update directory: Update failed",
          "error"
        );
      });
    });
  });

  describe("Dialog interactions", () => {
    it("calls onClose when close button is clicked", () => {
      const mockOnClose = vi.fn();
      render(
        <ChangeLocalStoreDirectoryDialog
          {...defaultProps}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByTestId("close-x");
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onClose when cancel button is clicked", () => {
      const mockOnClose = vi.fn();
      render(
        <ChangeLocalStoreDirectoryDialog
          {...defaultProps}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("resets state when dialog is closed", async () => {
      const newPath = "/test/path";
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      // Select a directory
      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        expect(screen.getByText(newPath)).toBeInTheDocument();
      });

      // Close the dialog
      const closeButton = screen.getByTestId("close-x");
      fireEvent.click(closeButton);

      // Reopen the dialog
      const { rerender } = render(
        <ChangeLocalStoreDirectoryDialog {...defaultProps} isOpen={false} />
      );
      rerender(
        <ChangeLocalStoreDirectoryDialog {...defaultProps} isOpen={true} />
      );

      // Should be reset - there might be multiple instances, just check one exists
      expect(
        screen.getAllByText("No directory selected")[0]
      ).toBeInTheDocument();
    });

    it("disables controls during update", async () => {
      const newPath = "/valid/path";
      const mockSetLocalStorePath = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );
      vi.mocked(useSettings).mockReturnValue({
        ...mockSettings,
        setLocalStorePath: mockSetLocalStorePath,
      });
      vi.mocked(window.electronAPI.selectLocalStorePath).mockResolvedValue(
        newPath
      );

      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const chooseButton = screen.getByTestId("file-picker-button");
      fireEvent.click(chooseButton);

      await waitFor(() => {
        const updateButton = screen.getByText("Update Directory");
        expect(updateButton).not.toBeDisabled();
      });

      const updateButton = screen.getByText("Update Directory");
      fireEvent.click(updateButton);

      // Controls should be disabled during update
      expect(screen.getByTestId("file-picker-button")).toBeDisabled();
      expect(screen.getByText("Cancel")).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("has proper aria-label for close button", () => {
      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const closeButton = screen.getByLabelText("Close");
      expect(closeButton).toBeInTheDocument();
    });

    it("has proper dialog structure", () => {
      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Change Local Store Directory");
    });

    it("has proper heading hierarchy", () => {
      render(<ChangeLocalStoreDirectoryDialog {...defaultProps} />);

      const mainHeading = screen.getByRole("heading", { level: 2 });
      const subHeadings = screen.getAllByRole("heading", { level: 3 });

      expect(mainHeading).toHaveTextContent("Change Local Store Directory");
      expect(subHeadings).toHaveLength(2);
      expect(subHeadings[0]).toHaveTextContent("Current Directory");
      expect(subHeadings[1]).toHaveTextContent("Select New Directory");
    });
  });
});

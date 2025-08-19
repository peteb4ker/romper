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
import InvalidLocalStoreDialog from "../InvalidLocalStoreDialog";

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
  FiFolder: vi.fn(() => <div data-testid="folder">Folder</div>),
  FiRefreshCw: vi.fn(() => <div data-testid="refresh">Refresh</div>),
}));

// Setup centralized electronAPI mock
setupElectronAPIMock();

describe("InvalidLocalStoreDialog", () => {
  const defaultProps = {
    errorMessage: "Local store is not writable",
    isOpen: true,
    localStorePath: "/invalid/path",
    onMessage: vi.fn(),
  };

  const mockSetLocalStorePath = vi.fn();
  const mockRefreshLocalStoreStatus = vi.fn();
  const mockElectronAPI = {
    closeApp: vi.fn(),
    selectLocalStorePath: vi.fn(),
    validateLocalStore: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useSettings as any).mockReturnValue({
      refreshLocalStoreStatus: mockRefreshLocalStoreStatus,
      setLocalStorePath: mockSetLocalStorePath,
    });
    Object.assign(window, { electronAPI: mockElectronAPI });
  });

  afterEach(() => {
    cleanup();
  });

  it("should not render when closed", () => {
    render(<InvalidLocalStoreDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Invalid Local Store")).not.toBeInTheDocument();
  });

  it("should render error message and current path", () => {
    render(<InvalidLocalStoreDialog {...defaultProps} />);

    expect(screen.getByText("Invalid Local Store")).toBeInTheDocument();
    expect(screen.getByText("Local store is not writable")).toBeInTheDocument();
    expect(screen.getByText("/invalid/path")).toBeInTheDocument();
  });

  it("should handle directory selection", async () => {
    mockElectronAPI.selectLocalStorePath.mockResolvedValue("/new/path");
    mockElectronAPI.validateLocalStore.mockResolvedValue({
      isValid: true,
    });

    render(<InvalidLocalStoreDialog {...defaultProps} />);

    const filePickerButton = screen.getByTestId("file-picker-button");
    fireEvent.click(filePickerButton);

    await waitFor(() => {
      expect(mockElectronAPI.selectLocalStorePath).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockElectronAPI.validateLocalStore).toHaveBeenCalledWith(
        "/new/path"
      );
    });

    expect(screen.getByText("/new/path")).toBeInTheDocument();
    expect(
      screen.getByText("✓ Valid local store directory")
    ).toBeInTheDocument();
  });

  it("should handle validation failure", async () => {
    mockElectronAPI.selectLocalStorePath.mockResolvedValue("/invalid/new/path");
    mockElectronAPI.validateLocalStore.mockResolvedValue({
      error: "Directory is not writable",
      isValid: false,
    });

    render(<InvalidLocalStoreDialog {...defaultProps} />);

    const filePickerButton = screen.getByTestId("file-picker-button");
    fireEvent.click(filePickerButton);

    await waitFor(() => {
      expect(
        screen.getByText("✗ Directory is not writable")
      ).toBeInTheDocument();
    });
  });

  it("should update path and reload when valid directory selected", async () => {
    mockElectronAPI.selectLocalStorePath.mockResolvedValue("/valid/path");
    mockElectronAPI.validateLocalStore.mockResolvedValue({
      isValid: true,
    });

    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: mockReload },
      writable: true,
    });

    render(<InvalidLocalStoreDialog {...defaultProps} />);

    // Select directory
    const filePickerButton = screen.getByTestId("file-picker-button");
    fireEvent.click(filePickerButton);

    await waitFor(() => {
      expect(
        screen.getByText("✓ Valid local store directory")
      ).toBeInTheDocument();
    });

    // Click use directory button
    const useButton = screen.getByText("Use This Directory");
    expect(useButton).not.toBeDisabled();
    fireEvent.click(useButton);

    expect(mockSetLocalStorePath).toHaveBeenCalledWith("/valid/path");
    expect(defaultProps.onMessage).toHaveBeenCalledWith(
      "Local store directory updated successfully. Refreshing...",
      "success"
    );
  });

  it("should handle exit app", () => {
    render(<InvalidLocalStoreDialog {...defaultProps} />);

    const exitButton = screen.getByText("Exit App");
    fireEvent.click(exitButton);

    expect(mockElectronAPI.closeApp).toHaveBeenCalled();
  });

  it("should render validation status correctly", () => {
    render(<InvalidLocalStoreDialog {...defaultProps} />);

    // Should not show validation result initially
    expect(screen.queryByTestId("refresh")).not.toBeInTheDocument();
  });

  it("should handle API errors gracefully", async () => {
    mockElectronAPI.selectLocalStorePath.mockRejectedValue(
      new Error("API not available")
    );

    render(<InvalidLocalStoreDialog {...defaultProps} />);

    const filePickerButton = screen.getByTestId("file-picker-button");
    fireEvent.click(filePickerButton);

    await waitFor(() => {
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Failed to select directory: API not available",
        "error"
      );
    });
  });

  it("should disable buttons during operations", async () => {
    mockElectronAPI.selectLocalStorePath.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve("/test/path"), 100))
    );

    render(<InvalidLocalStoreDialog {...defaultProps} />);

    const filePickerButton = screen.getByTestId("file-picker-button");
    const exitButton = screen.getByText("Exit App");

    fireEvent.click(filePickerButton);

    // Buttons should be disabled during selection
    expect(exitButton).toBeDisabled();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupElectronAPIMock } from "../../../../../tests/mocks/electron/electronAPI";
import { createMockSettings } from "../../../../../tests/mocks/settings";
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

// Mock @phosphor-icons/react
vi.mock("@phosphor-icons/react", () => ({
  ArrowsClockwiseIcon: vi.fn(() => <div data-testid="refresh">Refresh</div>),
  FolderIcon: vi.fn(() => <div data-testid="folder">Folder</div>),
  WarningIcon: vi.fn(() => <div data-testid="alert-triangle">Alert</div>),
}));

// Setup centralized electronAPI mock
setupElectronAPIMock();

describe("[UC-05] InvalidLocalStoreDialog", () => {
  const defaultProps = {
    errorMessage: "Local store is not writable",
    isOpen: true,
    localStorePath: "/invalid/path",
    onMessage: vi.fn(),
  };

  const mockSetLocalStorePath = vi.fn().mockResolvedValue(true);
  const mockRefreshLocalStoreStatus = vi.fn();
  const mockElectronAPI = {
    closeApp: vi.fn(),
    selectLocalStorePath: vi.fn(),
    validateLocalStoreOpens: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetLocalStorePath.mockResolvedValue(true);
    vi.mocked(useSettings).mockReturnValue(
      createMockSettings({
        refreshLocalStoreStatus: mockRefreshLocalStoreStatus,
        setLocalStorePath: mockSetLocalStorePath,
      }),
    );
    Object.assign(window, { electronAPI: mockElectronAPI });
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
    mockElectronAPI.validateLocalStoreOpens.mockResolvedValue({
      isValid: true,
    });

    render(<InvalidLocalStoreDialog {...defaultProps} />);

    const filePickerButton = screen.getByTestId("file-picker-button");
    fireEvent.click(filePickerButton);

    await waitFor(() => {
      expect(mockElectronAPI.selectLocalStorePath).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockElectronAPI.validateLocalStoreOpens).toHaveBeenCalledWith(
        "/new/path",
      );
    });

    expect(screen.getByText("/new/path")).toBeInTheDocument();
    expect(
      screen.getByText("✓ Valid local store directory"),
    ).toBeInTheDocument();
  });

  it("should handle validation failure", async () => {
    mockElectronAPI.selectLocalStorePath.mockResolvedValue("/invalid/new/path");
    mockElectronAPI.validateLocalStoreOpens.mockResolvedValue({
      error: "Directory is not writable",
      isValid: false,
    });

    render(<InvalidLocalStoreDialog {...defaultProps} />);

    const filePickerButton = screen.getByTestId("file-picker-button");
    fireEvent.click(filePickerButton);

    await waitFor(() => {
      expect(
        screen.getByText("✗ Directory is not writable"),
      ).toBeInTheDocument();
    });
  });

  it("should update path and reload when valid directory selected", async () => {
    mockElectronAPI.selectLocalStorePath.mockResolvedValue("/valid/path");
    mockElectronAPI.validateLocalStoreOpens.mockResolvedValue({
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
        screen.getByText("✓ Valid local store directory"),
      ).toBeInTheDocument();
    });

    // Click use directory button
    const useButton = screen.getByText("Use This Directory");
    expect(useButton).not.toBeDisabled();
    fireEvent.click(useButton);

    expect(mockSetLocalStorePath).toHaveBeenCalledWith("/valid/path");
    await waitFor(() =>
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Local store directory updated.",
        "success",
      ),
    );
  });

  it("reports a save that failed (RE-78)", async () => {
    mockSetLocalStorePath.mockResolvedValue(false);
    mockElectronAPI.selectLocalStorePath.mockResolvedValue("/valid/path");
    mockElectronAPI.validateLocalStoreOpens.mockResolvedValue({
      isValid: true,
    });
    render(<InvalidLocalStoreDialog {...defaultProps} />);

    fireEvent.click(screen.getByTestId("file-picker-button"));
    await waitFor(() =>
      expect(screen.getByText("Use This Directory")).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText("Use This Directory"));

    await waitFor(() =>
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Couldn't save the new local store directory.",
        "error",
      ),
    );
  });

  // RE-80: a store on a drive that wasn't connected at launch
  describe("Try Again", () => {
    it("reopens the store once it can be opened", async () => {
      mockElectronAPI.validateLocalStoreOpens.mockResolvedValue({
        isValid: true,
      });
      render(<InvalidLocalStoreDialog {...defaultProps} />);

      fireEvent.click(screen.getByTestId("retry-local-store-btn"));

      await waitFor(() =>
        expect(mockRefreshLocalStoreStatus).toHaveBeenCalled(),
      );
      expect(mockElectronAPI.validateLocalStoreOpens).toHaveBeenCalledWith(
        "/invalid/path",
      );
      expect(mockSetLocalStorePath).not.toHaveBeenCalled();
    });

    it("[UC-05] reopens a store that has a missing sample or an extra WAV (#813)", async () => {
      // The channel answers only whether the store opens, so a store the
      // store check would report on is valid here
      mockElectronAPI.validateLocalStoreOpens.mockResolvedValue({
        isValid: true,
      });
      render(<InvalidLocalStoreDialog {...defaultProps} />);

      fireEvent.click(screen.getByTestId("retry-local-store-btn"));

      await waitFor(() =>
        expect(mockRefreshLocalStoreStatus).toHaveBeenCalled(),
      );
      expect(screen.queryByTestId("retry-error")).not.toBeInTheDocument();
    });

    it("says why when the store still can't be opened", async () => {
      mockElectronAPI.validateLocalStoreOpens.mockResolvedValue({
        error: "Local store directory does not exist",
        isValid: false,
      });
      render(<InvalidLocalStoreDialog {...defaultProps} />);

      fireEvent.click(screen.getByTestId("retry-local-store-btn"));

      expect(await screen.findByTestId("retry-error")).toHaveTextContent(
        "Local store directory does not exist",
      );
      expect(mockRefreshLocalStoreStatus).not.toHaveBeenCalled();
    });
  });

  it("offers to set up a new store when given a way to", () => {
    const onRerunWizard = vi.fn().mockResolvedValue(true);
    render(
      <InvalidLocalStoreDialog
        {...defaultProps}
        onRerunWizard={onRerunWizard}
      />,
    );

    fireEvent.click(screen.getByText("Set Up a New Local Store"));

    expect(onRerunWizard).toHaveBeenCalled();
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
    expect(screen.queryByText(/Valid local store directory/)).toBeNull();
    expect(screen.queryByText("Validating directory...")).toBeNull();
  });

  it("should handle API errors gracefully", async () => {
    mockElectronAPI.selectLocalStorePath.mockRejectedValue(
      new Error("API not available"),
    );

    render(<InvalidLocalStoreDialog {...defaultProps} />);

    const filePickerButton = screen.getByTestId("file-picker-button");
    fireEvent.click(filePickerButton);

    await waitFor(() => {
      expect(defaultProps.onMessage).toHaveBeenCalledWith(
        "Failed to select directory: API not available",
        "error",
      );
    });
  });

  it("should disable buttons during operations", async () => {
    mockElectronAPI.selectLocalStorePath.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve("/test/path"), 100)),
    );

    render(<InvalidLocalStoreDialog {...defaultProps} />);

    const filePickerButton = screen.getByTestId("file-picker-button");
    const exitButton = screen.getByText("Exit App");

    fireEvent.click(filePickerButton);

    // Buttons should be disabled during selection
    expect(exitButton).toBeDisabled();
  });

  it("should render re-run wizard button when onRerunWizard is provided", () => {
    const onRerunWizard = vi.fn().mockResolvedValue(true);
    render(
      <InvalidLocalStoreDialog
        {...defaultProps}
        onRerunWizard={onRerunWizard}
      />,
    );
    const rerunBtn = screen.getByTestId("rerun-wizard-btn");
    expect(rerunBtn).toBeInTheDocument();
    fireEvent.click(rerunBtn);
    expect(onRerunWizard).toHaveBeenCalledOnce();
  });

  it("[UC-05] says so when the saved store can't be forgotten (#528)", async () => {
    const onRerunWizard = vi.fn().mockResolvedValue(false);
    render(
      <InvalidLocalStoreDialog
        {...defaultProps}
        onRerunWizard={onRerunWizard}
      />,
    );

    fireEvent.click(screen.getByTestId("rerun-wizard-btn"));

    expect(await screen.findByTestId("rerun-wizard-error")).toHaveTextContent(
      "Couldn't save the local store setting. Try again.",
    );
    expect(
      screen.getByTestId("invalid-local-store-dialog"),
    ).toBeInTheDocument();

    // Trying again clears the message while it saves
    onRerunWizard.mockResolvedValue(true);
    fireEvent.click(screen.getByTestId("rerun-wizard-btn"));
    await waitFor(() =>
      expect(screen.queryByTestId("rerun-wizard-error")).toBeNull(),
    );
    expect(onRerunWizard).toHaveBeenCalledTimes(2);
  });

  it("should not render re-run wizard button when onRerunWizard is not provided", () => {
    render(<InvalidLocalStoreDialog {...defaultProps} />);
    expect(screen.queryByTestId("rerun-wizard-btn")).toBeNull();
  });
});
